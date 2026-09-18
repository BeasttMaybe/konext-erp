/**
 * Reconstrucao da entrega real de uma OS a partir da trilha de auditoria —
 * dominio puro, sem Prisma: quem chama consulta `LogAuditoria` e passa os
 * eventos ja carregados.
 *
 * Existia como a MESMA regra escrita duas vezes — uma em
 * app/actions/os.ts:obterMomentoEntregaAuditado, outra em
 * scripts/lib/reparo-os.mjs:buscarUltimaTransicaoEntregue — e as duas erradas
 * do mesmo jeito: pegavam o evento `dadosDepois.status = 'ENTREGUE'` mais
 * RECENTE, sem checar `dadosAntes.status`. Isso confunde uma entrega real com
 * o eco de auditoria que `finalizarOrdemServico` grava ao completar um
 * resgate (arquivar uma OS que ja estava ENTREGUE) — o eco tambem tem
 * `dadosDepois.status = 'ENTREGUE'`, so que sem transicao nenhuma por tras.
 * Um caso real: a OS #16 foi entregue em 26/06, arquivada meses depois via
 * "Arquivar OS", e o recalculo do Grupo C passou a sugerir reiniciar a
 * garantia dela na data do arquivamento.
 */

export type EventoAuditoriaOS = {
  id: string;
  criadoEm: Date;
  /** `dadosAntes.status` do evento, extraido do JSON da auditoria. */
  statusAntes: string | null;
  /** `dadosDepois.status` do evento, extraido do JSON da auditoria. */
  statusDepois: string | null;
  /** `dadosDepois.tipoFinalizacao` quando o evento veio de finalizarOrdemServico/finalizarSemServico. */
  tipoFinalizacao?: string | null;
};

export type ResultadoEntregaAuditada =
  | { encontrada: true; momento: Date; logId: string }
  | { encontrada: false };

/**
 * A entrega real e a PRIMEIRA transicao para ENTREGUE: um evento cujo status
 * ANTES nao era ENTREGUE e cujo status DEPOIS e ENTREGUE. Um evento de
 * resgate — a OS ja estava ENTREGUE, so foi arquivada/completada — nunca
 * conta, seja porque `statusAntes` ja e ENTREGUE, seja porque o proprio
 * evento se marca `tipoFinalizacao: "RESGATE"`.
 *
 * Pega a mais ANTIGA, nao a mais recente: uma OS reaberta e entregue de novo
 * nao pode ter a garantia reiniciada por uma acao administrativa (arquivar,
 * resgatar) que aconteca depois — nem pela segunda entrega em si. A entrega
 * original e que define o inicio da garantia.
 */
export function encontrarEntregaAuditada(
  eventos: readonly EventoAuditoriaOS[]
): ResultadoEntregaAuditada {
  const transicoesReais = eventos
    .filter(
      (evento) =>
        evento.statusDepois === "ENTREGUE" &&
        evento.statusAntes !== "ENTREGUE" &&
        evento.tipoFinalizacao !== "RESGATE"
    )
    .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());

  const primeira = transicoesReais[0];

  if (!primeira) {
    return { encontrada: false };
  }

  return { encontrada: true, momento: primeira.criadoEm, logId: primeira.id };
}
