/**
 * Quanto cada produto da nota custou DE VERDADE.
 *
 * O preço que o fornecedor imprime na linha não é o custo do produto: falta
 * o frete, que vem como um valor único do documento, e sobra o desconto, que
 * normalmente também vem só no rodapé. Um item comprado a R$ 6,50 numa nota
 * com 5% de frete custa R$ 6,83 — e é esse número, não o da linha, que
 * decide margem, markup e preço de venda.
 *
 * Lançar o custo sem o frete é o erro mais caro e mais invisível desta tela:
 * ele não quebra nada, só faz toda a margem da loja parecer melhor do que é,
 * em todo relatório, para sempre.
 */

import { multiplicarPorQuantidade, ratearProporcionalmente, somar, subtrair } from "@/lib/dinheiro";

import type { ItemLidoDaNota } from "./nota";

/**
 * Por qual critério o frete se divide entre os itens.
 *
 * Não existe resposta certa, existe resposta adequada à carga. Transportadora
 * cobra por peso e volume, e a nota não traz nem um nem outro — então o que
 * dá pra fazer é escolher a aproximação menos ruim pro que está na caixa:
 *
 * - `VALOR`: o item mais caro carrega mais frete. É a convenção de mercado e
 *   a aproximação certa quando o que é caro também é grande — carregador,
 *   power bank, caixa de som.
 * - `QUANTIDADE`: cada unidade carrega a mesma fatia. É melhor quando a caixa
 *   é de coisas pequenas e parecidas, onde o preço não diz nada sobre o peso:
 *   cem películas ocupam o mesmo espaço custando R$ 1,50 ou R$ 15,00.
 */
export type CriterioDeRateio = "VALOR" | "QUANTIDADE";

export const CRITERIOS_DE_RATEIO: ReadonlyArray<{
  valor: CriterioDeRateio;
  rotulo: string;
  ajuda: string;
}> = [
  {
    valor: "VALOR",
    rotulo: "Pelo valor",
    ajuda: "O item mais caro absorve mais frete. Bom quando o caro também é o grande.",
  },
  {
    valor: "QUANTIDADE",
    rotulo: "Pela quantidade",
    ajuda: "Cada unidade carrega a mesma fatia. Bom pra caixa de item pequeno e parecido.",
  },
];

/**
 * Como o custo do produto é atualizado quando ele já existia no catálogo.
 *
 * Não é detalhe contábil — muda a margem que a loja vê em todo relatório:
 *
 * - `MEDIA_PONDERADA` mistura o saldo que já estava na prateleira com o que
 *   chegou agora. Dez capas a R$ 6,50 mais duas a R$ 20,00 dão um custo de
 *   R$ 8,75 pras doze. É a resposta certa pra margem, porque as dez antigas
 *   continuam tendo custado R$ 6,50.
 * - `ULTIMO_PRECO` grava o preço desta compra e pronto. É o que a maioria
 *   das pessoas espera ver, e o certo quando o preço do fornecedor mudou de
 *   vez e o saldo antigo é resíduo.
 */
export type RegraDeCusto = "MEDIA_PONDERADA" | "ULTIMO_PRECO";

export const REGRAS_DE_CUSTO: ReadonlyArray<{
  valor: RegraDeCusto;
  rotulo: string;
  ajuda: string;
}> = [
  {
    valor: "MEDIA_PONDERADA",
    rotulo: "Média ponderada",
    ajuda: "Mistura o que já estava em estoque com o que chegou. Margem mais fiel.",
  },
  {
    valor: "ULTIMO_PRECO",
    rotulo: "Último preço pago",
    ajuda: "Grava o custo desta compra. Use quando o preço do fornecedor mudou de vez.",
  },
];

/**
 * O novo custo unitário de um produto depois da entrada.
 *
 * Saldo zerado (ou negativo, que acontece em loja que vende sem estoque) cai
 * no custo da compra em qualquer uma das duas regras: não existe média a
 * fazer com uma prateleira vazia, e tentar fazê-la devolveria um custo
 * menor que qualquer um dos dois lados.
 */
export function custoAposEntrada({
  regra,
  saldoAtual,
  custoAtualCentavos,
  quantidadeComprada,
  custoDaCompraCentavos,
}: {
  regra: RegraDeCusto;
  saldoAtual: number;
  custoAtualCentavos: number;
  quantidadeComprada: number;
  custoDaCompraCentavos: number;
}): number {
  if (regra === "ULTIMO_PRECO") return custoDaCompraCentavos;
  if (saldoAtual <= 0 || custoAtualCentavos <= 0) return custoDaCompraCentavos;
  if (quantidadeComprada <= 0) return custoAtualCentavos;

  const totalDeUnidades = saldoAtual + quantidadeComprada;

  const valorDoQueJaTinha = multiplicarPorQuantidade(custoAtualCentavos, saldoAtual);
  const valorDoQueChegou = multiplicarPorQuantidade(custoDaCompraCentavos, quantidadeComprada);

  return multiplicarPorQuantidade(somar(valorDoQueJaTinha, valorDoQueChegou), 1 / totalDeUnidades);
}

export type CustoDoItem = {
  ordem: number;
  /** O que a linha da nota diz. */
  valorDaLinhaCentavos: number;
  rateioDeFreteCentavos: number;
  rateioDeDescontoCentavos: number;
  /** Linha + frete − desconto. */
  custoTotalCentavos: number;
  /** O que vai pro campo `custo` do produto. */
  custoUnitarioCentavos: number;
};

/**
 * Divide frete e desconto entre as linhas e devolve o custo final de cada uma.
 *
 * O rateio usa `ratearProporcionalmente`, que fecha no centavo: a soma das
 * fatias é exatamente o frete da nota, nunca um centavo a mais nem a menos.
 * Isso importa porque a conferência da tela mostra os dois números lado a
 * lado, e "frete R$ 25,00, rateado R$ 24,99" é o tipo de diferença que
 * destrói a confiança numa tela inteira.
 */
export function calcularCustos({
  itens,
  freteCentavos,
  descontoCentavos,
  criterio,
}: {
  itens: ItemLidoDaNota[];
  freteCentavos: number;
  descontoCentavos: number;
  criterio: CriterioDeRateio;
}): CustoDoItem[] {
  if (itens.length === 0) return [];

  const pesos = itens.map((item) =>
    criterio === "QUANTIDADE" ? item.quantidade : item.valorTotalCentavos
  );

  const fretes = ratearProporcionalmente(freteCentavos, pesos);
  const descontos = ratearProporcionalmente(descontoCentavos, pesos);

  return itens.map((item, indice) => {
    const rateioDeFreteCentavos = fretes[indice];
    const rateioDeDescontoCentavos = descontos[indice];

    const custoTotalCentavos = subtrair(
      somar(item.valorTotalCentavos, rateioDeFreteCentavos),
      rateioDeDescontoCentavos
    );

    // O custo unitário é um valor POR UNIDADE: ele é arredondado, e
    // `unitário × quantidade` pode não reproduzir o total exato da linha.
    // Isso é da natureza do campo, não defeito — `Produto.custo` guarda o
    // custo de uma unidade, e o total da compra fica na nota.
    const custoUnitarioCentavos =
      item.quantidade > 0
        ? multiplicarPorQuantidade(custoTotalCentavos, 1 / item.quantidade)
        : custoTotalCentavos;

    return {
      ordem: item.ordem,
      valorDaLinhaCentavos: item.valorTotalCentavos,
      rateioDeFreteCentavos,
      rateioDeDescontoCentavos,
      custoTotalCentavos,
      custoUnitarioCentavos,
    };
  });
}
