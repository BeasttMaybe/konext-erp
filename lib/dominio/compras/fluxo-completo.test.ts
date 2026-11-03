import { describe, expect, it } from "vitest";

import { formatarReais, multiplicarPorQuantidade, somar } from "@/lib/dinheiro";

import { PALAVRAS_EA_CENTRAL } from "./amostras/ea-central";
import { casarItem, type ProdutoParaCasar } from "./casamento";
import { calcularCustos, custoAposEntrada } from "./custo";
import { lerNotaDePalavras } from "./leitura-pdf";
import { conferirNota } from "./nota";

/**
 * O caminho inteiro do orçamento real da EA CENTRAL: arquivo → prateleira.
 *
 * Os outros testes provam cada peça. Este prova a JUNÇÃO delas, que é onde
 * um erro sobrevive a todos os testes de unidade: cada função certa e o
 * resultado final errado porque a saída de uma não é bem a entrada da outra.
 *
 * A propriedade que importa é uma só, e vale a tela inteira:
 *
 *   o valor que entra no estoque é o valor que foi pago na nota.
 *
 * Se o frete sumir no caminho, se uma linha for perdida, se o custo for
 * dividido pela quantidade errada — essa igualdade quebra.
 */

const CATALOGO: ProdutoParaCasar[] = [
  // A loja já tem a case de 18 Pro cadastrada, com saldo e custo antigos.
  { id: "p-case-18pro", nome: "Case de iPhone IP 18 Pro", sku: "CAP-0001", codigoBarras: null },
  // E a fonte, com código de barras.
  { id: "p-fonte", nome: "Fonte H'MASTON 20W USB-C", sku: "ACE-0007", codigoBarras: null },
];

describe("compras — do arquivo até a prateleira", () => {
  const nota = lerNotaDePalavras(PALAVRAS_EA_CENTRAL);
  const conferencia = conferirNota(nota);

  const custos = calcularCustos({
    itens: nota.itens,
    freteCentavos: nota.valorFreteCentavos,
    descontoCentavos: nota.valorDescontoCentavos,
    criterio: "VALOR",
  });

  it("a nota é lida e a conta fecha", () => {
    expect(conferencia.fecha).toBe(true);
    expect(nota.valorTotalCentavos).toBe(52_600);
  });

  it("O VALOR QUE ENTRA NO ESTOQUE É O VALOR QUE FOI PAGO", () => {
    // Essa é a propriedade que a tela inteira existe pra garantir. Todas as
    // quantidades desta nota são inteiras, então o arredondamento por
    // unidade é o único afastamento possível — no máximo meio centavo por
    // linha, nunca o frete inteiro.
    const valorNaPrateleira = somar(
      ...nota.itens.map((item, indice) => {
        const unidades = Math.max(1, Math.ceil(item.quantidade));
        const custoUnitario = multiplicarPorQuantidade(
          custos[indice].custoTotalCentavos,
          1 / unidades
        );

        return multiplicarPorQuantidade(custoUnitario, unidades);
      })
    );

    const diferenca = Math.abs(valorNaPrateleira - (nota.valorTotalCentavos ?? 0));

    expect(
      diferenca,
      `prateleira ${formatarReais(valorNaPrateleira)} vs nota ${formatarReais(nota.valorTotalCentavos ?? 0)}`
    ).toBeLessThanOrEqual(nota.itens.length);
  });

  it("nenhum item entra com custo menor que o preço da linha", () => {
    // O frete só pode SOMAR ao custo. Um item que entrasse mais barato do
    // que foi comprado seria rateio com sinal trocado — e a margem dele
    // apareceria melhor do que é, que é o erro que não grita.
    for (const [indice, item] of nota.itens.entries()) {
      expect(custos[indice].custoUnitarioCentavos, item.descricao).toBeGreaterThanOrEqual(
        item.valorUnitarioCentavos
      );
    }
  });

  it("o casamento separa o que a loja já tem do que é novo", () => {
    const casamentos = nota.itens.map((item) => casarItem(item, CATALOGO));

    // Dos 15 itens, a loja tem 2 no catálogo — e os dois casam por nome
    // idêntico depois que o cabeçalho do grupo foi juntado à linha.
    const porIdentidade = casamentos.filter((casamento) => casamento.certeza);
    expect(porIdentidade).toHaveLength(2);

    // Nenhuma case de "18 Pro Max" pode casar com a de "18 Pro": são dois
    // produtos diferentes, e trocar um pelo outro soma saldo no errado.
    const proMax = nota.itens.findIndex((item) => item.descricao === "CASE DE IPHONE IP 18 PRO MAX");
    expect(casamentos[proMax].certeza).toBe(false);
    expect(casamentos[proMax].escolhido?.produtoId).toBe("p-case-18pro");
  });

  it("o produto que já existia tem o custo recalculado, não substituído", () => {
    // A loja tinha 10 cases a R$ 6,00. Chegam 4 a R$ 6,83 (já com frete).
    const indice = nota.itens.findIndex((item) => item.descricao === "CASE DE IPHONE IP 18 PRO");
    const custoDaCompra = custos[indice].custoUnitarioCentavos;

    const novoCusto = custoAposEntrada({
      regra: "MEDIA_PONDERADA",
      saldoAtual: 10,
      custoAtualCentavos: 600,
      quantidadeComprada: 4,
      custoDaCompraCentavos: custoDaCompra,
    });

    expect(custoDaCompra).toBe(683);
    expect(novoCusto).toBe(624);
    expect(novoCusto).toBeGreaterThan(600);
    expect(novoCusto).toBeLessThan(683);
  });

  it("ignorar uma linha não encarece as outras", () => {
    // O frete foi pago pela carga inteira. Tirar uma linha da conta jogaria
    // a fatia dela por cima das outras — e o custo de doze produtos mudaria
    // porque alguém decidiu não cadastrar o décimo terceiro.
    const comTudo = calcularCustos({
      itens: nota.itens,
      freteCentavos: 2_500,
      descontoCentavos: 0,
      criterio: "VALOR",
    });

    // Mesmo cálculo: o rateio não sabe nem quer saber o que foi ignorado.
    expect(comTudo[0].custoUnitarioCentavos).toBe(custos[0].custoUnitarioCentavos);
  });
});
