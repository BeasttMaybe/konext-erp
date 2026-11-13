import { describe, expect, it } from "vitest";

import { montarRelatorioDeTaxas, rotuloDaForma } from "./taxas-de-cartao";

describe("taxas de cartao", () => {
  it("rotulos por forma e parcelas", () => {
    expect(rotuloDaForma("CARTAO_DEBITO", 1)).toBe("Débito");
    expect(rotuloDaForma("CARTAO_CREDITO_PARCELADO", 3)).toBe("Crédito 3x");
    expect(rotuloDaForma("CARTAO_CREDITO", 1)).toBe("Crédito à vista");
    expect(rotuloDaForma("CARTAO_CREDITO_AVISTA", 1)).toBe("Crédito à vista");
  });

  it("agrupa, soma em centavos, calcula percentual e ordena", () => {
    const r = montarRelatorioDeTaxas([
      { forma: "CARTAO_CREDITO_PARCELADO", parcelas: 10, bruto: "1000.00", taxa: "89.90", quantidade: 1 },
      { forma: "CARTAO_DEBITO", parcelas: 1, bruto: "200.00", taxa: "2.98", quantidade: 2 },
      { forma: "CARTAO_CREDITO_AVISTA", parcelas: 1, bruto: "100.00", taxa: "3.49", quantidade: 1 },
      { forma: "CARTAO_CREDITO", parcelas: 1, bruto: "100.00", taxa: "3.49", quantidade: 1 },
    ]);
    expect(r.grupos.map((g) => g.rotulo)).toEqual(["Débito", "Crédito à vista", "Crédito 10x"]);
    expect(r.grupos[1]).toMatchObject({ bruto: 200, taxa: 6.98, quantidade: 2, percentual: 3.49 });
    expect(r.totalTaxa).toBe(99.86);
    expect(r.totalBrutoNoCartao).toBe(1400);
    expect(r.percentualMedio).toBe(7.13);
    expect(r.quantidade).toBe(5);
  });

  it("sem vendas no cartao", () => {
    expect(montarRelatorioDeTaxas([])).toEqual({ totalTaxa: 0, totalBrutoNoCartao: 0, percentualMedio: 0, quantidade: 0, grupos: [] });
  });
});
