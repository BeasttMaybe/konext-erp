import { somar, subtrair } from "@/lib/dinheiro";

/**
 * Regra de estorno de venda (Fase 2A-3).
 *
 * O problema que ela resolve: o fechamento de caixa de uma sessao e
 * CONFERIDO A MAO. A pessoa conta o dinheiro na gaveta, digita o valor, e o
 * sistema compara com o esperado — que ele calcula na hora, somando as
 * vendas daquela sessao (ver `obterResumoCaixaDiario`). Se um estorno
 * mexesse na venda original, o esperado de uma sessao JA FECHADA mudaria
 * depois do fato: a diferenca de fechamento que a pessoa conferiu e assinou
 * passaria a mostrar outro numero, dias depois, sem nada explicando.
 *
 * Entao a regra e uma so, e nao olha o status da sessao pra fazer a conta:
 *
 *   a venda NUNCA sai da sessao em que aconteceu, e o estorno e um
 *   movimento SEPARADO, que cai na sessao que estiver aberta na hora do
 *   estorno.
 *
 * Os dois casos que o dono descreveu caem dela sozinhos:
 *
 * - Sessao da venda ainda ABERTA: a sessao que absorve o estorno e a mesma,
 *   entao `+valor` e `-valor` se anulam ali e o esperado volta ao que era.
 *   E o "reverte imediatamente".
 * - Sessao da venda JA FECHADA: o `+valor` fica onde estava (fechamento
 *   conciliado intacto) e o `-valor` cai na sessao de hoje, onde o dinheiro
 *   de fato vai sair da gaveta.
 *
 * Fora do caixa, apuracao de receita e outra pergunta e tem outra resposta:
 * venda estornada nao e receita em periodo nenhum, e sai das queries de
 * receita por `estornadaEm IS NULL`. Gaveta e apuracao nao sao a mesma
 * conta, e tratar as duas junto foi o que deixou o `cancelarPedido`
 * apagando conta a receber sem deixar rastro.
 */

/** Status de sessao de caixa, como o enum `CaixaStatus` do schema. */
export type StatusSessaoCaixa = "ABERTO" | "FECHADO";

export type SessaoCaixa = {
  id: string;
  status: StatusSessaoCaixa;
};

export type DestinoDoEstorno = {
  /**
   * Sessao que absorve o estorno, ou `null` quando nao ha caixa aberto. O
   * estorno acontece de qualquer forma: travar o cancelamento de uma venda
   * porque a gaveta esta fechada seria pior, porque o cliente ja foi
   * embora com o dinheiro. O `null` fica registrado e aparece no resumo
   * como estorno sem caixa aberto, em vez de desaparecer.
   */
  sessaoDestinoId: string | null;
  /** Por que caiu ali — vai pro log de auditoria, em portugues. */
  motivo: string;
};

/**
 * Decide qual sessao de caixa absorve o estorno.
 *
 * `sessaoDaVenda` e a sessao em que a venda foi registrada (`null` em venda
 * antiga ou feita fora do caixa). `sessaoAberta` e a sessao aberta no
 * momento do estorno, se houver.
 */
export function decidirDestinoDoEstorno(
  sessaoDaVenda: SessaoCaixa | null,
  sessaoAberta: SessaoCaixa | null
): DestinoDoEstorno {
  if (sessaoDaVenda && sessaoDaVenda.status === "ABERTO") {
    return {
      sessaoDestinoId: sessaoDaVenda.id,
      motivo: "Caixa da venda ainda aberto: estorno anulado na mesma sessao.",
    };
  }

  if (sessaoAberta) {
    return {
      sessaoDestinoId: sessaoAberta.id,
      motivo: sessaoDaVenda
        ? "Caixa da venda ja fechado: estorno lancado no caixa aberto, sem alterar o fechamento conferido."
        : "Venda sem caixa vinculado: estorno lancado no caixa aberto.",
    };
  }

  return {
    sessaoDestinoId: null,
    motivo: "Nenhum caixa aberto no momento do estorno: lancado sem sessao.",
  };
}

/**
 * Esperado de fechamento de uma sessao, em CENTAVOS INTEIROS.
 *
 * `estornosAbsorvidosCentavos` sao os estornos que caíram NESTA sessao —
 * nao os estornos das vendas dela. A distincao e o ponto todo da regra: uma
 * venda desta sessao estornada semanas depois sai do caixa de semanas
 * depois, nao deste.
 */
export function calcularEsperadoFechamento(parametros: {
  aberturaCentavos: number;
  vendasDaSessaoCentavos: number;
  estornosAbsorvidosCentavos: number;
}): number {
  const { aberturaCentavos, vendasDaSessaoCentavos, estornosAbsorvidosCentavos } = parametros;

  return subtrair(somar(aberturaCentavos, vendasDaSessaoCentavos), estornosAbsorvidosCentavos);
}

/** Status de pedido que pode ser estornado. */
export function pedidoPodeSerEstornado(status: string): boolean {
  return status === "APROVADO";
}
