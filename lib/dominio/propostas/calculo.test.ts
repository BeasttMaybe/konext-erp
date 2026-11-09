import { describe, expect, it } from "vitest";

import {
  calcularProposta,
  montarResumoDePagamento,
  normalizarItensDaProposta,
} from "./calculo";

/**
 * A conta de uma proposta vale para a criação E para a edição. Estes testes
 * são o que garante que ela continue sendo a mesma conta nos dois caminhos.
 */

function item(parcial: Partial<Parameters<typeof calcularProposta>[0][number]> = {}) {
  return {
    descricao: "Troca de tela",
    quantidade: 1,
    precoUnitario: 480,
    descontoPercentual: 0,
    ...parcial,
  };
}

describe("normalizarItensDaProposta", () => {
  it("descarta linha sem descrição e apara espaços", () => {
    const itens = normalizarItensDaProposta([
      item({ descricao: "  Troca de tela  " }),
      item({ descricao: "   " }),
      item({ descricao: "" }),
    ]);

    expect(itens).toHaveLength(1);
    expect(itens[0]?.descricao).toBe("Troca de tela");
  });
});

describe("calcularProposta", () => {
  it("soma as linhas em centavos exatos", () => {
    const { subtotalBrutoCentavos, descontoTotalCentavos, valorTotalCentavos } = calcularProposta([
      item({ precoUnitario: 480, quantidade: 1 }),
      item({ descricao: "Película", precoUnitario: 39.9, quantidade: 2 }),
    ]);

    expect(subtotalBrutoCentavos).toBe(48000 + 3990 * 2);
    expect(descontoTotalCentavos).toBe(0);
    expect(valorTotalCentavos).toBe(55980);
  });

  it("o total bate com a soma dos subtotais de linha, com desconto quebrado", () => {
    // 33,33% sobre R$ 99,99 é o tipo de número que ponto flutuante erra por
    // um centavo — e um centavo de diferença entre o total e a soma das
    // linhas é o que o cliente enxerga no documento.
    const calculada = calcularProposta([
      item({ precoUnitario: 99.99, quantidade: 3, descontoPercentual: 33.33 }),
      item({ descricao: "Bateria", precoUnitario: 149.9, quantidade: 1, descontoPercentual: 7.5 }),
    ]);

    const somaDasLinhas = calculada.itens.reduce(
      (total, linha) => total + linha.linhaSubtotalCentavos,
      0
    );

    expect(calculada.valorTotalCentavos).toBe(somaDasLinhas);
  });

  it("desconto maior que o preço não vira crédito contra os outros itens", () => {
    const calculada = calcularProposta([
      item({ precoUnitario: 100, descontoPercentual: 150 }),
      item({ descricao: "Bateria", precoUnitario: 200 }),
    ]);

    expect(calculada.itens[0]?.linhaSubtotalCentavos).toBe(0);
    // Sem a trava, a primeira linha (-50,00) abateria a segunda e o total
    // sairia 150,00 em vez de 200,00.
    expect(calculada.valorTotalCentavos).toBe(20000);
  });

  it("proposta sem itens tem total zero, e não NaN", () => {
    expect(calcularProposta([])).toMatchObject({
      subtotalBrutoCentavos: 0,
      descontoTotalCentavos: 0,
      valorTotalCentavos: 0,
    });
  });
});

describe("montarResumoDePagamento", () => {
  it("junta os dois quando há os dois", () => {
    expect(montarResumoDePagamento("50% entrada", "restante na retirada")).toBe(
      "50% entrada | restante na retirada"
    );
  });

  it("não deixa separador solto quando só um tem conteúdo", () => {
    expect(montarResumoDePagamento("À vista", "   ")).toBe("À vista");
    expect(montarResumoDePagamento(null, "Pix")).toBe("Pix");
  });

  it("vazio vira null, não string vazia", () => {
    expect(montarResumoDePagamento(null, undefined)).toBeNull();
    expect(montarResumoDePagamento("  ", "")).toBeNull();
  });
});
