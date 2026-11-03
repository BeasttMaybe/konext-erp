import { describe, expect, it } from "vitest";

import {
  MARGEM_APERTADA_ATE,
  ehUnidadeValida,
  lucroPorUnidadeCentavos,
  margemPercentual,
  markupPercentual,
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

describe("estoque/preco — markup", () => {
  /**
   * O par clássico: o MESMO produto tem markup 190% e margem líquida 65%. Os
   * dois números estão certos e respondem perguntas diferentes — markup é
   * "multipliquei por quanto sobre o que paguei", margem líquida é "de cada
   * real que entra, quanto sobra".
   */
  it("o mesmo produto dá 190% de markup e 65% de margem líquida", () => {
    expect(markupPercentual(1200, 3490)).toBeCloseTo(190.83, 1);
    expect(margemPercentual(1200, 3490)).toBeCloseTo(65.61, 1);
  });

  it("dobrar o preço do custo é markup de 100% e margem de 50%", () => {
    expect(markupPercentual(1000, 2000)).toBe(100);
    expect(margemPercentual(1000, 2000)).toBe(50);
  });

  it("preço igual ao custo é zero nas duas contas", () => {
    expect(markupPercentual(1000, 1000)).toBe(0);
    expect(margemPercentual(1000, 1000)).toBe(0);
  });

  it("vender abaixo do custo é negativo nas duas", () => {
    expect(markupPercentual(2000, 1000)).toBe(-50);
    expect(margemPercentual(2000, 1000)).toBe(-100);
  });

  it("sem custo não existe markup, mas a margem líquida existe", () => {
    // Brinde e mão de obra não têm custo de compra. "Markup infinito" ali não
    // é informação; margem líquida de 100% é verdade.
    expect(markupPercentual(0, 3490)).toBeNull();
    expect(margemPercentual(0, 3490)).toBe(100);
  });

  it("sem preço não existe nenhuma das duas", () => {
    // A conta de markup até funcionaria aqui (daria −100%), mas preço zero na
    // prática é "ainda não preenchi", não "decidi dar de graça".
    expect(markupPercentual(1200, 0)).toBeNull();
    expect(margemPercentual(1200, 0)).toBeNull();
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
