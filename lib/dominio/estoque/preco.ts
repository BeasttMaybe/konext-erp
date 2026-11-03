/**
 * Margem do produto, a partir do custo e do preço de venda.
 *
 * Todo valor entra e sai em CENTAVOS inteiros (ver lib/dinheiro.ts). A margem
 * em si é um percentual e volta como número, não como dinheiro.
 */

/**
 * Margem sobre o PREÇO DE VENDA: (preço − custo) ÷ preço.
 *
 * É a definição que a referência aprovada usa — custo R$ 12,00 e preço
 * R$ 34,90 aparecem como "Margem 65%", e 22,90 ÷ 34,90 = 65,6%. Vale deixar
 * escrito porque a outra conta possível com os mesmos dois números, o markup
 * ((preço − custo) ÷ custo), dá 190% para esse mesmo produto. Mostrar 190%
 * onde o dono espera 65% faria qualquer decisão de preço sair errada.
 *
 * `null` quando o preço é zero ou negativo: sem preço não há margem, e exibir
 * 0% ou −100% nesse caso seria inventar um número para um produto que ainda
 * não tem preço definido.
 */
export function margemPercentual(custoCentavos: number, precoCentavos: number): number | null {
  if (precoCentavos <= 0) return null;
  return ((precoCentavos - custoCentavos) / precoCentavos) * 100;
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
