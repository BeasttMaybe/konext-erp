import { describe, expect, it } from "vitest";

import {
  MARGEM_APERTADA_ATE,
  ehUnidadeValida,
  lucroPorUnidadeCentavos,
  margemPercentual,
  rotuloDaUnidade,
  saudeDaMargem,
} from "./preco";

describe("estoque/preco — margem", () => {
  /**
   * O caso da referência aprovada: custo R$ 12,00, preço R$ 34,90, "Margem 65%".
   * Serve de âncora porque a outra conta possível com os mesmos dois números
   * (markup, sobre o custo) daria 190% — e mostrar 190% onde o dono espera 65%
   * faria qualquer decisão de preço sair errada.
   */
  it("é sobre o preço de venda, como na referência", () => {
    expect(margemPercentual(1200, 3490)).toBeCloseTo(65.61, 1);
  });

  it("preço igual ao custo é margem zero", () => {
    expect(margemPercentual(1000, 1000)).toBe(0);
  });

  it("preço abaixo do custo é margem negativa", () => {
    expect(margemPercentual(1500, 1000)).toBe(-50);
  });

  it("sem preço não existe margem", () => {
    // 0% ou −100% aqui seria inventar número pra produto sem preço definido.
    expect(margemPercentual(1200, 0)).toBeNull();
    expect(margemPercentual(1200, -100)).toBeNull();
  });

  it("custo zero é margem cheia", () => {
    expect(margemPercentual(0, 3490)).toBe(100);
  });

  it("o lucro por unidade sai em centavos", () => {
    expect(lucroPorUnidadeCentavos(1200, 3490)).toBe(2290);
    expect(lucroPorUnidadeCentavos(3490, 1200)).toBe(-2290);
  });
});

describe("estoque/preco — saúde da margem", () => {
  it("classifica cada faixa", () => {
    expect(saudeDaMargem(null)).toBe("SEM_PRECO");
    expect(saudeDaMargem(-5)).toBe("PREJUIZO");
    expect(saudeDaMargem(0)).toBe("APERTADA");
    expect(saudeDaMargem(MARGEM_APERTADA_ATE - 0.1)).toBe("APERTADA");
    expect(saudeDaMargem(MARGEM_APERTADA_ATE)).toBe("SAUDAVEL");
    expect(saudeDaMargem(65)).toBe("SAUDAVEL");
  });
});

describe("estoque/preco — unidades", () => {
  it("reconhece as da lista e recusa o resto", () => {
    expect(ehUnidadeValida("UN")).toBe(true);
    expect(ehUnidadeValida("CX")).toBe(true);
    // Lista fixa de propósito: livre produziria "un", "UN" e "unid" no mesmo
    // estoque.
    expect(ehUnidadeValida("un")).toBe(false);
    expect(ehUnidadeValida("DUZIA")).toBe(false);
  });

  it("devolve o rótulo, e o próprio valor quando não conhece", () => {
    expect(rotuloDaUnidade("UN")).toBe("Unidade");
    expect(rotuloDaUnidade("XYZ")).toBe("XYZ");
  });
});
