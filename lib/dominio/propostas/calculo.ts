/**
 * A conta de uma proposta: itens, descontos e totais.
 *
 * POR QUE ISTO SAIU DE DENTRO DA ACTION
 *
 * A conta morava dentro de `createProposta`. Quando a edição passou a existir,
 * havia duas saídas: copiar a conta para a action de editar, ou tirá-la de
 * dentro das duas. Copiada, ela discordaria um dia — e o dia em que o total
 * de uma proposta editada não bate com o total da mesma proposta criada é o
 * dia em que o cliente recebe dois números diferentes pelo mesmo serviço.
 *
 * Aqui não há banco, nem sessão, nem Prisma: entra o que o formulário validou,
 * sai o que vai ser gravado. É por isso que dá para testar linha a linha.
 *
 * DINHEIRO EM CENTAVOS INTEIROS, sempre por `lib/dinheiro.ts` — o subtotal
 * gravado tem que bater, item a item, com a soma dos subtotais de cada linha,
 * e ponto flutuante não garante isso.
 */

import {
  aplicarPercentual,
  deDecimal,
  multiplicarPorQuantidade,
  somar,
  subtrair,
} from "@/lib/dinheiro";

export type ItemDeProposta = {
  descricao: string;
  quantidade: number;
  /** Em reais, como vem do formulário. */
  precoUnitario: number;
  descontoPercentual: number;
};

export type ItemCalculado = {
  descricao: string;
  quantidade: number;
  descontoPercentual: number;
  precoUnitarioCentavos: number;
  linhaBrutaCentavos: number;
  linhaDescontoCentavos: number;
  linhaSubtotalCentavos: number;
};

export type PropostaCalculada = {
  itens: ItemCalculado[];
  subtotalBrutoCentavos: number;
  descontoTotalCentavos: number;
  valorTotalCentavos: number;
};

/**
 * Item sem descrição não é item — é linha que o usuário começou e abandonou.
 * Some antes da conta, para não entrar no documento como linha vazia.
 */
export function normalizarItensDaProposta(itens: ItemDeProposta[]): ItemDeProposta[] {
  return itens
    .map((item) => ({
      descricao: item.descricao.trim(),
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
      descontoPercentual: item.descontoPercentual,
    }))
    .filter((item) => item.descricao !== "");
}

export function calcularProposta(itens: ItemDeProposta[]): PropostaCalculada {
  const calculados = itens.map((item) => {
    const precoUnitarioCentavos = deDecimal(item.precoUnitario);
    const linhaBrutaCentavos = multiplicarPorQuantidade(precoUnitarioCentavos, item.quantidade);
    // O desconto é LIMITADO ao valor da linha, e é aqui que ele é limitado —
    // não só no subtotal.
    //
    // O código antigo fazia `Math.max(0, bruto - desconto)` no subtotal da
    // linha, mas somava o desconto CHEIO no total da proposta. Com desconto
    // de 150% num item, a linha aparecia zerada no documento e o excedente
    // abatia os OUTROS itens: um item pagava outro, e o total impresso não
    // batia com a soma das linhas impressas.
    const linhaDescontoCentavos = Math.min(
      linhaBrutaCentavos,
      aplicarPercentual(linhaBrutaCentavos, item.descontoPercentual)
    );
    const linhaSubtotalCentavos = subtrair(linhaBrutaCentavos, linhaDescontoCentavos);

    return {
      descricao: item.descricao,
      quantidade: item.quantidade,
      descontoPercentual: item.descontoPercentual,
      precoUnitarioCentavos,
      linhaBrutaCentavos,
      linhaDescontoCentavos,
      linhaSubtotalCentavos,
    };
  });

  const subtotalBrutoCentavos = somar(...calculados.map((item) => item.linhaBrutaCentavos));
  const descontoTotalCentavos = somar(...calculados.map((item) => item.linhaDescontoCentavos));

  return {
    itens: calculados,
    subtotalBrutoCentavos,
    descontoTotalCentavos,
    valorTotalCentavos: Math.max(0, subtrair(subtotalBrutoCentavos, descontoTotalCentavos)),
  };
}

/**
 * Junta condição de pagamento e detalhe num texto só, que é como a coluna
 * `condicoesPagamento` guarda e como o PDF lê.
 */
export function montarResumoDePagamento(
  condicoesPagamento: string | null | undefined,
  detalhesPagamento: string | null | undefined
): string | null {
  const resumo = [condicoesPagamento, detalhesPagamento]
    .filter((valor): valor is string => Boolean(valor && valor.trim().length > 0))
    .join(" | ");

  return resumo || null;
}
