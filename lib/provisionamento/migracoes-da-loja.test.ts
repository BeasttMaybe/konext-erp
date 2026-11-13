import path from "node:path";
import { describe, expect, it } from "vitest";

import { aplicarMigracoes, listarMigracoes, type Executor } from "./migracoes-da-loja";

const pasta = path.resolve(__dirname, "../../prisma/migrations");

/** Banco de mentira: guarda as linhas de _prisma_migrations e os SQLs rodados. */
function bancoFalso(falharEm?: string) {
  const linhas: Array<Record<string, unknown>> = [];
  const rodados: string[] = [];
  const executar: Executor = async (sql, p = []) => {
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS \"_prisma_migrations\"")) return { rows: [] };
    if (sql.startsWith("SELECT migration_name")) return { rows: linhas.map((l) => ({ ...l })) };
    if (sql.startsWith("INSERT INTO \"_prisma_migrations\"")) {
      linhas.push({ id: p[0], checksum: p[1], migration_name: p[2], finished_at: null, rolled_back_at: null });
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE \"_prisma_migrations\" SET finished_at")) {
      linhas.find((l) => l.id === p[0])!.finished_at = new Date();
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE \"_prisma_migrations\" SET logs")) {
      linhas.find((l) => l.id === p[0])!.rolled_back_at = new Date();
      return { rows: [] };
    }
    if (falharEm && sql === falharEm) throw new Error("boom");
    rodados.push(sql);
    return { rows: [] };
  };
  return { executar, linhas, rodados };
}

describe("migracoes da loja", () => {
  const migracoes = listarMigracoes(pasta);

  it("le todas as migrations em ordem, com checksum", () => {
    expect(migracoes[0].nome).toBe("0_baseline");
    expect(migracoes.length).toBeGreaterThan(30);
    expect(migracoes.every((m) => /^[0-9a-f]{64}$/.test(m.checksum))).toBe(true);
    expect([...migracoes.map((m) => m.nome)].sort()).toEqual(migracoes.map((m) => m.nome));
  });

  it("aplica tudo num banco vazio e, de novo, nao aplica nada", async () => {
    const banco = bancoFalso();
    const primeira = await aplicarMigracoes(banco.executar, migracoes);
    expect(primeira.aplicadas.length).toBe(migracoes.length);
    expect(banco.rodados.length).toBe(migracoes.length);
    const segunda = await aplicarMigracoes(banco.executar, migracoes);
    expect(segunda.aplicadas).toEqual([]);
    expect(segunda.ultima).toBe(migracoes.at(-1)!.nome);
  });

  it("falha no meio: para ali, e a proxima tentativa continua de onde parou", async () => {
    const banco = bancoFalso(migracoes[3].sql);
    await expect(aplicarMigracoes(banco.executar, migracoes)).rejects.toThrow(migracoes[3].nome);
    expect(banco.rodados.length).toBe(3);
    const semFalha = bancoFalso();
    semFalha.linhas.push(...banco.linhas);
    const retomada = await aplicarMigracoes(semFalha.executar, migracoes);
    expect(retomada.aplicadas[0]).toBe(migracoes[3].nome);
    expect(retomada.aplicadas.length).toBe(migracoes.length - 3);
  });

  it("linha sem fim e sem desfazer (outro processo no meio) bloqueia", async () => {
    const banco = bancoFalso();
    banco.linhas.push({ id: "x", checksum: "c", migration_name: "m", finished_at: null, rolled_back_at: null });
    await expect(aplicarMigracoes(banco.executar, migracoes)).rejects.toThrow("interrompida");
  });

  it("recusa migration alterada depois de aplicada", async () => {
    const banco = bancoFalso();
    await aplicarMigracoes(banco.executar, migracoes.slice(0, 2));
    const alterada = [{ ...migracoes[0], checksum: "0".repeat(64) }, migracoes[1]];
    await expect(aplicarMigracoes(banco.executar, alterada)).rejects.toThrow("alterada");
  });
});
