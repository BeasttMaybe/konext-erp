import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Aplica as migrations do banco da LOJA (prisma/migrations) num banco novo —
 * o que `prisma migrate deploy` faria, sem depender do binario do Prisma
 * (o master roda na Vercel, onde ele nao existe).
 *
 * Grava a tabela _prisma_migrations no MESMO formato do Prisma (checksum =
 * SHA-256 do migration.sql), entao depois o runner de sempre (banco.yml ->
 * migrar-aplicar, com `prisma migrate deploy`) enxerga esta loja como em dia
 * e aplica so as proximas. O CI confere isso: aplica com este codigo num banco
 * vazio e roda `prisma migrate status` + diff contra o schema.
 *
 * Cada arquivo vai numa consulta so, como o Prisma faz. Idempotente: o que
 * ja consta em _prisma_migrations e pulado, e uma migration que falhou fica
 * marcada como desfeita — da para continuar uma criacao interrompida.
 *
 * SEM IMPORTS do projeto: o master e os scripts leem este arquivo.
 */

export type Migracao = { nome: string; sql: string; checksum: string };

export function listarMigracoes(pasta: string): Migracao[] {
  return readdirSync(pasta, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(pasta, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort()
    .map((nome) => {
      const sql = readFileSync(path.join(pasta, nome, "migration.sql"), "utf8");
      return { nome, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

export type Executor = (sql: string, parametros?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

const TABELA = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
)`;

export async function aplicarMigracoes(
  executar: Executor,
  migracoes: Migracao[]
): Promise<{ aplicadas: string[]; jaEstavam: number; ultima: string | null }> {
  await executar(TABELA);
  const { rows } = await executar(
    `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`
  );
  const feitas = new Map(
    rows
      .filter((r) => r.finished_at !== null && r.rolled_back_at === null)
      .map((r) => [String(r.migration_name), String(r.checksum)])
  );
  const pendentesComFalha = rows.filter((r) => r.finished_at === null && r.rolled_back_at === null);
  if (pendentesComFalha.length > 0) {
    throw new Error(`migration interrompida no banco: ${pendentesComFalha.map((r) => r.migration_name).join(", ")}`);
  }

  const aplicadas: string[] = [];
  for (const migracao of migracoes) {
    const checksum = feitas.get(migracao.nome);
    if (checksum !== undefined) {
      if (checksum !== migracao.checksum) throw new Error(`migration ${migracao.nome} foi alterada depois de aplicada`);
      continue;
    }
    const id = randomUUID();
    await executar(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count) VALUES ($1, $2, $3, now(), 0)`,
      [id, migracao.checksum, migracao.nome]
    );
    try {
      await executar(migracao.sql);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      // O arquivo roda numa consulta so = uma transacao implicita: se falhou,
      // nada dele ficou. Marcar como desfeita (rolled_back_at) deixa a proxima
      // tentativa rodar de novo — o mesmo que `prisma migrate resolve --rolled-back`.
      await executar(`UPDATE "_prisma_migrations" SET logs = $2, rolled_back_at = now() WHERE id = $1`, [id, mensagem.slice(0, 2000)]);
      throw new Error(`migration ${migracao.nome} falhou: ${mensagem}`);
    }
    await executar(`UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`, [id]);
    aplicadas.push(migracao.nome);
  }
  return { aplicadas, jaEstavam: feitas.size, ultima: migracoes.at(-1)?.nome ?? null };
}
