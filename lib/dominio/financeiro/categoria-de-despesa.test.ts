import { describe, expect, it } from "vitest";

import {
  CATEGORIAS_DE_DESPESA,
  categoriaDaDespesa,
  FORNECEDOR_DE_PECA_DE_OS,
  rotuloDaCategoriaDeDespesa,
} from "./categoria-de-despesa";

describe("categoria da despesa", () => {
  it("o fornecedor fixo de peça é peça de OS", () => {
    expect(categoriaDaDespesa(FORNECEDOR_DE_PECA_DE_OS)).toBe("PECA_OS");
  });

  it("qualquer outro fornecedor é conta da loja", () => {
    for (const fornecedor of ["VIVO", "Imobiliária", "Contador", ""]) {
      expect(categoriaDaDespesa(fornecedor), fornecedor).toBe("LOJA");
    }
  });

  it("fornecedor ausente não vira peça de OS por acidente", () => {
    expect(categoriaDaDespesa(null)).toBe("LOJA");
    expect(categoriaDaDespesa(undefined)).toBe("LOJA");
  });

  it("a comparação é exata — não acha peça por semelhança", () => {
    // "Custo de peça" sem o "(OS)" é uma despesa que alguém digitou à mão, e
    // classificá-la como peça de OS a esconderia do filtro de contas da loja.
    expect(categoriaDaDespesa("Custo de peça")).toBe("LOJA");
    expect(categoriaDaDespesa("custo de peça (os)")).toBe("LOJA");
  });

  it("todo rótulo da lista de filtro tem texto", () => {
    expect(CATEGORIAS_DE_DESPESA.map((c) => c.valor)).toEqual(["TODAS", "LOJA", "PECA_OS"]);
    for (const categoria of CATEGORIAS_DE_DESPESA) {
      expect(categoria.rotulo.length, categoria.valor).toBeGreaterThan(0);
    }
  });

  it("os rótulos de linha existem pros dois casos", () => {
    expect(rotuloDaCategoriaDeDespesa("PECA_OS")).toBe("Peça de OS");
    expect(rotuloDaCategoriaDeDespesa("LOJA")).toBe("Despesa da loja");
  });
});
