import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { INTERVALO_MINIMO_ENTRE_REGISTROS_DE_USO_MS, precisaRegistrarUso } from "./uso-da-sessao";

const AGORA = new Date("2026-11-11T15:00:00.000Z");
const haMs = (ms: number) => new Date(AGORA.getTime() - ms);

describe("precisaRegistrarUso", () => {
  it("sessao que nunca registrou uso registra na primeira vez", () => {
    expect(precisaRegistrarUso(null, AGORA)).toBe(true);
  });

  it("dentro da folga nao grava de novo — e o caso de toda requisicao seguida", () => {
    expect(precisaRegistrarUso(haMs(0), AGORA)).toBe(false);
    expect(precisaRegistrarUso(haMs(30_000), AGORA)).toBe(false);
    expect(precisaRegistrarUso(haMs(INTERVALO_MINIMO_ENTRE_REGISTROS_DE_USO_MS - 1), AGORA)).toBe(false);
  });

  it("passada a folga, grava", () => {
    expect(precisaRegistrarUso(haMs(INTERVALO_MINIMO_ENTRE_REGISTROS_DE_USO_MS), AGORA)).toBe(true);
    expect(precisaRegistrarUso(haMs(60 * 60 * 1000), AGORA)).toBe(true);
  });

  it("registro no futuro (relogio adiantado em outra instancia) nao provoca escrita", () => {
    expect(precisaRegistrarUso(new Date(AGORA.getTime() + 10_000), AGORA)).toBe(false);
  });

  it("a folga e curta o bastante para a tela de usuarios continuar util", () => {
    expect(INTERVALO_MINIMO_ENTRE_REGISTROS_DE_USO_MS).toBeLessThanOrEqual(10 * 60 * 1000);
  });
});

/**
 * GUARDA: a sessao e o contexto sao resolvidos uma vez por requisicao.
 *
 * Tirar o `cache()` nao quebra nada visivel — so volta a multiplicar por
 * cinco as consultas de toda tela. Regressao de desempenho nao aparece em
 * teste de comportamento; por isso este le o codigo.
 */
describe("resolucao por requisicao", () => {
  const ler = (caminho: string) => readFileSync(join(process.cwd(), caminho), "utf8");

  it("a sessao e memorizada pelo hash do token", () => {
    const fonte = ler("lib/auth/sessao-central.ts");

    expect(fonte).toMatch(/const resolverSessaoPeloHash = cache\(async \(tokenHash: string\)/);
    expect(fonte).toContain("return resolverSessaoPeloHash(gerarHashToken(token));");
  });

  it("o ultimo uso so e gravado quando a folga passou, e nunca derruba a requisicao", () => {
    const fonte = ler("lib/auth/sessao-central.ts");

    expect(fonte).toContain("if (precisaRegistrarUso(sessao.ultimoUsoEm, agora))");
    expect(fonte).toMatch(/data: \{ ultimoUsoEm: agora \} \}\)\s*\.catch\(/);
  });

  it("o contexto do tenant e memorizado", () => {
    const fonte = ler("lib/tenant/exigir-contexto-tenant.ts");

    expect(fonte).toMatch(/const resolverContextoDaRequisicao = cache\(async \(\)/);
  });
});
