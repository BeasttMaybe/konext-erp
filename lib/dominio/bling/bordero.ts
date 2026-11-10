/**
 * O borderô do Bling: o lote de baixa.
 *
 * POR QUE PRECISOU IR TÃO FUNDO
 *
 * A pergunta era simples — "quando esta conta foi paga?" — e o Bling não
 * responde nem na lista nem no detalhe da conta. O detalhe de uma conta
 * recebida traz `vencimento`, `dataEmissao`, `competencia` e
 * `vencimentoOriginal`, todos definidos na CRIAÇÃO, e `saldo: 0`, que
 * confirma que foi quitada sem dizer quando.
 *
 * A data mora aqui, no borderô, que o detalhe referencia por id.
 *
 * E O ATALHO TERIA ERRADO
 *
 * O caminho curto seria usar o vencimento como se fosse a data do pagamento.
 * A primeira conta real que o dono mandou vencia em 08/01 e o borderô dela
 * diz 15/01: paga uma semana depois. Numa conta que vence dia 28 e é paga
 * dia 3, o atalho jogaria a receita para o mês errado — que é exatamente o
 * defeito que ele já pegou uma vez, no faturamento de R$ 97.692,45.
 */

import { dataDeCalendario } from "@/lib/datas";

export type BorderoLido = {
  /** O dia em que o dinheiro entrou. */
  data: Date;
  /** Soma do que foi efetivamente pago neste lote, em reais. */
  valorPagoReais: number;
};

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function numero(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : 0;
  }
  return 0;
}

/**
 * Os ids de borderô que uma conta referencia.
 *
 * Vem do DETALHE da conta — a lista de contas não traz este campo, e é por
 * isso que descobrir a data custa duas chamadas por conta.
 */
export function borderosDaConta(respostaDoDetalhe: unknown): string[] {
  const envelope = objeto(respostaDoDetalhe);
  const dados = objeto(envelope?.data);
  const borderos = dados?.borderos;

  if (!Array.isArray(borderos)) return [];

  return borderos
    .filter((id): id is number | string => typeof id === "number" || typeof id === "string")
    .map((id) => String(id))
    .filter((id) => id !== "");
}

export function lerBordero(resposta: unknown): BorderoLido | null {
  const envelope = objeto(resposta);
  const dados = objeto(envelope?.data);
  if (!dados) return null;

  // O campo chama-se `data` — o mesmo nome do envelope, o que é fácil de
  // confundir ao ler o JSON de cima. Daí a leitura em dois passos.
  const data = typeof dados.data === "string" ? dataDeCalendario(dados.data) : null;
  if (!data) return null;

  const pagamentos = Array.isArray(dados.pagamentos) ? dados.pagamentos : [];

  // `valorPago`, e não o valor da conta: são diferentes quando há juros,
  // desconto, acréscimo ou tarifa — e o que entrou no caixa foi o pago.
  const valorPagoReais = pagamentos.reduce((total: number, bruto: unknown) => {
    const pagamento = objeto(bruto);
    return total + (pagamento ? numero(pagamento.valorPago) : 0);
  }, 0);

  return { data, valorPagoReais };
}
