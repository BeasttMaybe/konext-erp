/**
 * Margem do produto, a partir do custo e do preço de venda.
 *
 * Todo valor entra e sai em CENTAVOS inteiros (ver lib/dinheiro.ts). A margem
 * em si é um percentual e volta como número, não como dinheiro.
 */

/**
 * Margem LÍQUIDA, sobre o preço de venda: (preço − custo) ÷ preço.
 *
 * É a definição que a referência aprovada usa — custo R$ 12,00 e preço
 * R$ 34,90 aparecem como "Margem 65%", e 22,90 ÷ 34,90 = 65,6%. É também a
 * conta que responde "de cada real que entra, quanto sobra".
 *
 * Não confundir com `markupPercentual`, que é a outra conta possível com os
 * mesmos dois números e dá 190% para este mesmo produto. A tela mostra as
 * duas, lado a lado e nomeadas, porque são perguntas diferentes.
 *
 * `null` quando o preço é zero ou negativo: sem preço não há margem, e exibir
 * 0% ou −100% nesse caso seria inventar um número para um produto que ainda
 * não tem preço definido.
 */
export function margemPercentual(custoCentavos: number, precoCentavos: number): number | null {
  if (precoCentavos <= 0) return null;
  return ((precoCentavos - custoCentavos) / precoCentavos) * 100;
}

/**
 * Markup, sobre o CUSTO: (preço − custo) ÷ custo.
 *
 * É a conta de quem forma preço a partir do que pagou — "multipliquei por
 * quanto". O mesmo produto de custo R$ 12,00 vendido a R$ 34,90 tem markup de
 * 190% e margem líquida de 65%: os dois números estão certos e respondem
 * coisas diferentes, e é por isso que a tela mostra ambos nomeados. Um número
 * de margem sem dizer qual é a base é um número que não dá pra usar.
 *
 * `null` em dois casos, por motivos diferentes:
 *
 * - **custo zero ou negativo**: dividir por zero daria infinito, e "markup
 *   infinito" num brinde ou numa mão de obra sem custo de compra não é
 *   informação, é ruído. A margem líquida desse mesmo produto é 100%, e essa
 *   sim é verdadeira.
 * - **preço zero ou negativo**: aqui a conta até funciona e dá −100%, mas o
 *   caso real por trás de preço zero é "ainda não preenchi o preço", não
 *   "decidi dar de graça". Mostrar −100% ali seria responder uma pergunta que
 *   ninguém fez — e é o mesmo motivo de `margemPercentual` devolver `null`.
 */
export function markupPercentual(custoCentavos: number, precoCentavos: number): number | null {
  if (custoCentavos <= 0) return null;
  if (precoCentavos <= 0) return null;
  return ((precoCentavos - custoCentavos) / custoCentavos) * 100;
}

/** Quanto sobra, em centavos, por unidade vendida. */
export function lucroPorUnidadeCentavos(custoCentavos: number, precoCentavos: number): number {
  return precoCentavos - custoCentavos;
}

export type SaudeDaMargem = "SEM_PRECO" | "PREJUIZO" | "APERTADA" | "SAUDAVEL";

/**
 * Abaixo disto a margem é apertada o suficiente pra merecer aviso na tela.
 *
 * 15% é o ponto em que, numa assistência, a margem já não cobre a parte do
 * custo que não está no custo do produto — cartão, imposto, o tempo de quem
 * atende. Não é uma regra contábil: é um aviso visual, e o dono vê o número
 * exato ao lado.
 */
export const MARGEM_APERTADA_ATE = 15;

export function saudeDaMargem(margem: number | null): SaudeDaMargem {
  if (margem === null) return "SEM_PRECO";
  if (margem < 0) return "PREJUIZO";
  if (margem < MARGEM_APERTADA_ATE) return "APERTADA";
  return "SAUDAVEL";
}

/**
 * Unidades de medida. Lista fixa de propósito: unidade de medida é padrão de
 * mercado, não cadastro do dono. Deixar livre produziria "un", "UN", "Unidade"
 * e "unid" no mesmo estoque — e é justamente o tipo de divergência que a
 * normalização de nome existe pra evitar nos cadastros que SÃO dele.
 */
export const UNIDADES_DE_MEDIDA = [
  { valor: "UN", rotulo: "Unidade" },
  { valor: "CX", rotulo: "Caixa" },
  { valor: "PCT", rotulo: "Pacote" },
  { valor: "PAR", rotulo: "Par" },
  { valor: "M", rotulo: "Metro" },
  { valor: "KG", rotulo: "Quilo" },
  { valor: "L", rotulo: "Litro" },
  { valor: "SV", rotulo: "Serviço" },
] as const;

export type UnidadeDeMedida = (typeof UNIDADES_DE_MEDIDA)[number]["valor"];

export const UNIDADE_PADRAO: UnidadeDeMedida = "UN";

export function ehUnidadeValida(valor: string): valor is UnidadeDeMedida {
  return UNIDADES_DE_MEDIDA.some((unidade) => unidade.valor === valor);
}

export function rotuloDaUnidade(valor: string): string {
  return UNIDADES_DE_MEDIDA.find((unidade) => unidade.valor === valor)?.rotulo ?? valor;
}
