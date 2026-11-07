/**
 * De onde a despesa veio: custo de peça de OS ou conta da loja.
 *
 * O dono reportou que a lista de Contas a Pagar "polui muito" com as peças de
 * OS. Ele está certo e é estrutural: cada ordem de serviço que consome peça
 * gera uma despesa, então numa loja que roda dezenas de OS por mês elas são a
 * maioria absoluta das linhas — e o boleto da internet fica enterrado no meio.
 *
 * As duas coisas precisam existir no mesmo lugar (as duas são dinheiro que
 * sai, e o total do mês tem que incluir as duas), mas quase nunca precisam
 * ser OLHADAS juntas: peça de OS se confere pela OS, conta da loja se paga
 * no vencimento. Daí o filtro.
 *
 * A classificação é pelo nome do fornecedor porque é assim que a despesa de
 * peça nasce hoje — `app/actions/os.ts` grava esse fornecedor fixo ao
 * consumir peça. Não é o desenho que eu escolheria (uma coluna `origem`, como
 * `ContaReceber` tem, seria explícita), mas trocar isso mexeria em dado
 * existente sem ganho pro dono agora. O que não podia continuar é a string
 * solta em dois arquivos: estava copiada em `financeiro-hub.ts` e na tela, e
 * no dia em que o rótulo mudasse num lugar, o indicador e o filtro passariam
 * a discordar em silêncio.
 */

export const FORNECEDOR_DE_PECA_DE_OS = "Custo de peça (OS)";

export type CategoriaDeDespesa = "PECA_OS" | "LOJA";

export const CATEGORIAS_DE_DESPESA: ReadonlyArray<{
  valor: CategoriaDeDespesa | "TODAS";
  rotulo: string;
}> = [
  { valor: "TODAS", rotulo: "Todas as categorias" },
  { valor: "LOJA", rotulo: "Despesas da loja" },
  { valor: "PECA_OS", rotulo: "Peças de OS" },
];

export function categoriaDaDespesa(fornecedor: string | null | undefined): CategoriaDeDespesa {
  return fornecedor === FORNECEDOR_DE_PECA_DE_OS ? "PECA_OS" : "LOJA";
}

export function rotuloDaCategoriaDeDespesa(categoria: CategoriaDeDespesa): string {
  return categoria === "PECA_OS" ? "Peça de OS" : "Despesa da loja";
}
