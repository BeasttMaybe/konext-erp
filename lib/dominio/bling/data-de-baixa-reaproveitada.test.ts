import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dataDeBaixaJaConhecida } from "./bordero";

const PAGA_EM = new Date("2026-01-15T00:00:00.000Z");

describe("dataDeBaixaJaConhecida", () => {
  it("conta recebida que ja tinha data: reaproveita, sem ir ao Bling", () => {
    expect(dataDeBaixaJaConhecida("RECEBIDO", { status: "RECEBIDO", dataRecebimento: PAGA_EM })).toBe(PAGA_EM);
  });

  it("conta nova: nao ha o que reaproveitar", () => {
    expect(dataDeBaixaJaConhecida("RECEBIDO", null)).toBeNull();
  });

  it("recebida no Bling, mas gravada sem data (sincronizacao antiga ou falha): busca", () => {
    expect(dataDeBaixaJaConhecida("RECEBIDO", { status: "RECEBIDO", dataRecebimento: null })).toBeNull();
  });

  it("estava em aberto e agora foi recebida: busca, a data e nova", () => {
    expect(dataDeBaixaJaConhecida("RECEBIDO", { status: "PENDENTE", dataRecebimento: null })).toBeNull();
  });

  it("baixa estornada no Bling: a data guardada nao vale mais", () => {
    // O chamador grava null quando a conta nao esta recebida; na proxima
    // baixa, a data e buscada de novo — pode ser outra.
    expect(dataDeBaixaJaConhecida("PENDENTE", { status: "RECEBIDO", dataRecebimento: PAGA_EM })).toBeNull();
  });
});

describe("sincronizacao do Bling", () => {
  const fonte = readFileSync(join(process.cwd(), "app/actions/bling-sincronizar.ts"), "utf8");

  it("consulta a data guardada antes de ir ao Bling", () => {
    expect(fonte).toContain("dataDeBaixaJaConhecida(conta.status, existente)");
    expect(fonte).toMatch(/select: \{ id: true, status: true, dataRecebimento: true \}/);
  });
});
