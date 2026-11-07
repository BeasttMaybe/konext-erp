import { describe, expect, it } from "vitest";

import { ORIGENS_DE_RECEITA, rotuloDaOrigemDeReceita } from "./origem-de-receita";

describe("origem da conta a receber", () => {
  it("traduz cada origem conhecida", () => {
    expect(rotuloDaOrigemDeReceita("ORDEM_SERVICO")).toBe("Ordem de serviço");
    expect(rotuloDaOrigemDeReceita("VENDA_PDV")).toBe("Venda no balcão");
  });

  it("origem nova no banco aparece crua em vez de sumir", () => {
    // Travessão esconderia a informação; o rótulo feio faz alguém corrigir.
    expect(rotuloDaOrigemDeReceita("CONSIGNACAO")).toBe("CONSIGNACAO");
  });

  it("conta sem origem não vira texto vazio", () => {
    expect(rotuloDaOrigemDeReceita(null)).toBe("Sem origem");
    expect(rotuloDaOrigemDeReceita("")).toBe("Sem origem");
  });

  it("a lista do filtro começa em TODAS e cobre o enum inteiro", () => {
    expect(ORIGENS_DE_RECEITA[0].valor).toBe("TODAS");
    expect(ORIGENS_DE_RECEITA.map((o) => o.valor)).toEqual([
      "TODAS",
      "VENDA_PDV",
      "ORDEM_SERVICO",
      "CONTRATO_RECORRENTE",
      "LICITACAO",
      "AVULSO",
    ]);
  });
});
