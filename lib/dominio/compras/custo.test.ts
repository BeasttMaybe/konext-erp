import { describe, expect, it } from "vitest";

import { ratearProporcionalmente, somar } from "@/lib/dinheiro";

import { PALAVRAS_EA_CENTRAL } from "./amostras/ea-central";
import { calcularCustos, custoAposEntrada } from "./custo";
import { lerNotaDePalavras } from "./leitura-pdf";
import type { ItemLidoDaNota } from "./nota";

function item(ordem: number, quantidade: number, totalCentavos: number): ItemLidoDaNota {
  return {
    ordem,
    descricao: `Item ${ordem}`,
    grupo: null,
    codigoFornecedor: null,
    ean: null,
    ncm: null,
    unidade: null,
    quantidade,
    valorUnitarioCentavos: Math.round(totalCentavos / quantidade),
    valorTotalCentavos: totalCentavos,
  };
}

describe("dinheiro — rateio proporcional", () => {
  it("as fatias somam exatamente o valor rateado", () => {
    // É a propriedade que importa: "frete R$ 25,00, rateado R$ 24,99" numa
    // tela de conferência destrói a confiança na tela inteira.
    for (const total of [2_500, 1, 99, 100_000, 7]) {
      const partes = ratearProporcionalmente(total, [2_600, 2_600, 1_950, 900, 4_400]);
      expect(somar(...partes), `total ${total}`).toBe(total);
    }
  });

  it("respeita a proporção", () => {
    // 100 reais entre pesos 1:3 → 25 e 75.
    expect(ratearProporcionalmente(10_000, [1, 3])).toEqual([2_500, 7_500]);
  });

  it("o centavo órfão vai pro maior resto, não pro primeiro da fila", () => {
    // 10 centavos entre três iguais: 3,33 cada, sobra 1. Com restos iguais o
    // desempate é a ordem — mas o resto maior sempre ganha primeiro.
    expect(ratearProporcionalmente(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(ratearProporcionalmente(100, [1, 1, 98])).toEqual([1, 1, 98]);
  });

  it("com todos os pesos zerados, divide igual em vez de estourar", () => {
    expect(ratearProporcionalmente(900, [0, 0, 0])).toEqual([300, 300, 300]);
  });

  it("lista vazia não vira divisão por zero", () => {
    expect(ratearProporcionalmente(500, [])).toEqual([]);
  });

  it("peso negativo é recusado em vez de produzir fatia negativa", () => {
    expect(() => ratearProporcionalmente(500, [1, -1])).toThrow(/não negativo/i);
  });
});

describe("compras/custo — frete na nota real da EA CENTRAL", () => {
  const nota = lerNotaDePalavras(PALAVRAS_EA_CENTRAL);

  it("o frete rateado soma o frete da nota, no centavo", () => {
    for (const criterio of ["VALOR", "QUANTIDADE"] as const) {
      const custos = calcularCustos({
        itens: nota.itens,
        freteCentavos: nota.valorFreteCentavos,
        descontoCentavos: 0,
        criterio,
      });

      expect(somar(...custos.map((custo) => custo.rateioDeFreteCentavos)), criterio).toBe(2_500);
    }
  });

  it("o custo total da compra bate com o total geral da nota", () => {
    const custos = calcularCustos({
      itens: nota.itens,
      freteCentavos: nota.valorFreteCentavos,
      descontoCentavos: nota.valorDescontoCentavos,
      criterio: "VALOR",
    });

    expect(somar(...custos.map((custo) => custo.custoTotalCentavos))).toBe(52_600);
  });

  it("o frete muda o custo o bastante pra mudar a margem", () => {
    // Esta é a razão de o rateio existir. A case comprada a R$ 6,50 custa
    // R$ 6,83 de verdade — 5% a mais, que é exatamente o que some da margem
    // de quem lança o custo sem frete.
    const custos = calcularCustos({
      itens: nota.itens,
      freteCentavos: 2_500,
      descontoCentavos: 0,
      criterio: "VALOR",
    });

    expect(custos[0].custoUnitarioCentavos).toBe(683);
    expect(custos[0].custoUnitarioCentavos).toBeGreaterThan(650);
  });

  it("os dois critérios distribuem o mesmo frete de formas diferentes", () => {
    const porValor = calcularCustos({
      itens: nota.itens, freteCentavos: 2_500, descontoCentavos: 0, criterio: "VALOR",
    });
    const porQuantidade = calcularCustos({
      itens: nota.itens, freteCentavos: 2_500, descontoCentavos: 0, criterio: "QUANTIDADE",
    });

    // O power bank (2 unidades, R$ 44,00) carrega mais frete por valor;
    // a película (6 unidades, R$ 9,00) carrega mais por quantidade.
    const powerBankPorValor = porValor.at(-1)!.rateioDeFreteCentavos;
    const powerBankPorQuantidade = porQuantidade.at(-1)!.rateioDeFreteCentavos;

    expect(powerBankPorValor).toBeGreaterThan(powerBankPorQuantidade);
    expect(somar(...porValor.map((c) => c.rateioDeFreteCentavos))).toBe(
      somar(...porQuantidade.map((c) => c.rateioDeFreteCentavos))
    );
  });
});

describe("compras/custo — desconto e casos de borda", () => {
  it("desconto baixa o custo e também fecha no centavo", () => {
    const custos = calcularCustos({
      itens: [item(1, 2, 1_000), item(2, 1, 1_000)],
      freteCentavos: 0,
      descontoCentavos: 333,
      criterio: "VALOR",
    });

    expect(somar(...custos.map((c) => c.rateioDeDescontoCentavos))).toBe(333);
    expect(somar(...custos.map((c) => c.custoTotalCentavos))).toBe(2_000 - 333);
  });

  it("nota sem frete nenhum mantém o custo da linha", () => {
    const custos = calcularCustos({
      itens: [item(1, 4, 2_600)],
      freteCentavos: 0,
      descontoCentavos: 0,
      criterio: "VALOR",
    });

    expect(custos[0].custoUnitarioCentavos).toBe(650);
    expect(custos[0].rateioDeFreteCentavos).toBe(0);
  });

  it("nota sem itens não estoura", () => {
    expect(
      calcularCustos({ itens: [], freteCentavos: 2_500, descontoCentavos: 0, criterio: "VALOR" })
    ).toEqual([]);
  });

  it("item de valor zero ainda recebe fatia quando o rateio é por quantidade", () => {
    // Brinde na nota: valor zero, mas ocupa espaço no caminhão.
    const custos = calcularCustos({
      itens: [item(1, 1, 0), item(2, 1, 10_000)],
      freteCentavos: 1_000,
      descontoCentavos: 0,
      criterio: "QUANTIDADE",
    });

    expect(custos[0].rateioDeFreteCentavos).toBe(500);
  });
});

describe("compras/custo — atualização do custo de quem já existia", () => {
  it("média ponderada mistura prateleira e chegada", () => {
    // Dez capas a R$ 6,50 mais duas a R$ 20,00: as dez antigas continuam
    // tendo custado R$ 6,50, e fingir que custaram R$ 20,00 destrói a
    // margem delas em todo relatório.
    expect(
      custoAposEntrada({
        regra: "MEDIA_PONDERADA",
        saldoAtual: 10,
        custoAtualCentavos: 650,
        quantidadeComprada: 2,
        custoDaCompraCentavos: 2_000,
      })
    ).toBe(875);
  });

  it("último preço ignora o que estava na prateleira", () => {
    expect(
      custoAposEntrada({
        regra: "ULTIMO_PRECO",
        saldoAtual: 10,
        custoAtualCentavos: 650,
        quantidadeComprada: 2,
        custoDaCompraCentavos: 2_000,
      })
    ).toBe(2_000);
  });

  it("prateleira vazia cai no custo da compra nas duas regras", () => {
    // Não existe média a fazer com saldo zero, e tentar fazê-la devolveria
    // um custo menor que os dois lados.
    for (const regra of ["MEDIA_PONDERADA", "ULTIMO_PRECO"] as const) {
      expect(
        custoAposEntrada({
          regra,
          saldoAtual: 0,
          custoAtualCentavos: 650,
          quantidadeComprada: 5,
          custoDaCompraCentavos: 900,
        }),
        regra
      ).toBe(900);
    }
  });

  it("saldo negativo (venda sem estoque) também cai no custo da compra", () => {
    expect(
      custoAposEntrada({
        regra: "MEDIA_PONDERADA",
        saldoAtual: -3,
        custoAtualCentavos: 650,
        quantidadeComprada: 5,
        custoDaCompraCentavos: 900,
      })
    ).toBe(900);
  });

  it("produto sem custo cadastrado não arrasta o zero pra média", () => {
    expect(
      custoAposEntrada({
        regra: "MEDIA_PONDERADA",
        saldoAtual: 10,
        custoAtualCentavos: 0,
        quantidadeComprada: 2,
        custoDaCompraCentavos: 2_000,
      })
    ).toBe(2_000);
  });

  it("o custo médio fica entre os dois, sempre", () => {
    for (const saldo of [1, 7, 50, 999]) {
      const medio = custoAposEntrada({
        regra: "MEDIA_PONDERADA",
        saldoAtual: saldo,
        custoAtualCentavos: 650,
        quantidadeComprada: 3,
        custoDaCompraCentavos: 2_000,
      });

      expect(medio, `saldo ${saldo}`).toBeGreaterThanOrEqual(650);
      expect(medio, `saldo ${saldo}`).toBeLessThanOrEqual(2_000);
    }
  });
});
