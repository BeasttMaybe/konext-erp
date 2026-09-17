/**
 * Regras de finalizacao da Ordem de Servico — dominio puro.
 *
 * Avalia TODAS as regras aplicaveis de uma vez e devolve a lista completa de
 * pendencias. O comportamento anterior parava na primeira falha, obrigando o
 * operador a descobrir os bloqueios um por um: adicionava um item, tentava de
 * novo, descobria que faltava diagnostico, tentava de novo (AUDIT_REPORT 16.7-f).
 *
 * Nao importa Prisma, React nem Next: quem chama faz as consultas e passa os
 * fatos ja resolvidos.
 */

import type { StatusOS } from "./maquina-estados";

export type CodigoPendenciaFinalizacao =
  | "OS_EXCLUIDA"
  | "STATUS_INVALIDO"
  | "JA_FINALIZADA"
  | "SEM_ITENS"
  | "SEM_DIAGNOSTICO"
  | "SEM_PAGAMENTO"
  | "PRAZO_GARANTIA_INVALIDO";

export type PendenciaFinalizacao = {
  codigo: CodigoPendenciaFinalizacao;
  mensagem: string;
};

export type RegrasConfiguracaoFinalizacao = {
  exigirItemParaGarantia: boolean;
  exigirDiagnosticoParaFinalizar: boolean;
  permitirFinalizarSemPagamento: boolean;
  prazoGarantiaPadraoDias: number;
  prazoMinimoGarantiaDias: number;
  prazoMaximoGarantiaDias: number;
};

export type EntradaAvaliacaoFinalizacao = {
  status: StatusOS;
  ehRetornoGarantia: boolean;
  excluidaEm: Date | null;
  archivedAt: Date | null;
  possuiTermoGarantia: boolean;
  quantidadeItens: number;
  observacoes: string | null;
  possuiPagamentoConfirmado: boolean;
  /** Prazo informado pelo operador. Ausente => usa o padrao da configuracao. */
  prazoGarantiaDiasInformado?: number | null;
  regras: RegrasConfiguracaoFinalizacao;
};

export type ResultadoAvaliacaoFinalizacao = {
  podeFinalizar: boolean;
  pendencias: PendenciaFinalizacao[];
  /** OS ja ENTREGUE a que falta termo e/ou arquivamento. */
  ehResgate: boolean;
  /** true quando a finalizacao precisa criar o termo de garantia. */
  deveGerarTermo: boolean;
  /** true quando a finalizacao precisa gravar archivedAt. */
  deveArquivar: boolean;
  /** Prazo efetivo em dias, ou null quando a OS nao gera termo. */
  prazoGarantiaEfetivo: number | null;
};

/**
 * Uma OS de retorno de garantia nao emite termo novo: ela consome a garantia
 * da OS de origem. Tudo que depende de garantia e dispensado nesse caso.
 */
function emiteTermoDeGarantia(entrada: EntradaAvaliacaoFinalizacao): boolean {
  return !entrada.ehRetornoGarantia;
}

function resolverPrazoGarantia(entrada: EntradaAvaliacaoFinalizacao): number | null {
  if (!emiteTermoDeGarantia(entrada)) {
    return null;
  }

  const informado = entrada.prazoGarantiaDiasInformado;

  if (informado === undefined || informado === null) {
    return entrada.regras.prazoGarantiaPadraoDias;
  }

  return informado;
}

export function avaliarFinalizacao(
  entrada: EntradaAvaliacaoFinalizacao
): ResultadoAvaliacaoFinalizacao {
  const pendencias: PendenciaFinalizacao[] = [];
  const emiteTermo = emiteTermoDeGarantia(entrada);
  const prazoGarantiaEfetivo = resolverPrazoGarantia(entrada);

  const faltaTermo = emiteTermo && !entrada.possuiTermoGarantia;
  const faltaArquivar = entrada.archivedAt === null;
  const ehResgate = entrada.status === "ENTREGUE" && (faltaTermo || faltaArquivar);

  // --- 1. OS excluida logicamente ------------------------------------------
  if (entrada.excluidaEm !== null) {
    pendencias.push({
      codigo: "OS_EXCLUIDA",
      mensagem: "Esta OS foi excluída e não pode ser finalizada. Restaure a OS antes de continuar.",
    });
  }

  // --- 2. Status ------------------------------------------------------------
  // Aceita PRONTO (fluxo normal) e ENTREGUE incompleta (resgate).
  if (entrada.status === "ENTREGUE") {
    if (!ehResgate) {
      pendencias.push({
        codigo: "JA_FINALIZADA",
        mensagem: "Esta OS já está entregue, arquivada e com o termo de garantia emitido. Nada a finalizar.",
      });
    }
  } else if (entrada.status !== "PRONTO") {
    pendencias.push({
      codigo: "STATUS_INVALIDO",
      mensagem: 'Mova a OS para "Pronto" antes de finalizar a entrega.',
    });
  }

  // --- 3. Itens -------------------------------------------------------------
  if (emiteTermo && entrada.regras.exigirItemParaGarantia && entrada.quantidadeItens <= 0) {
    pendencias.push({
      codigo: "SEM_ITENS",
      mensagem: "Adicione ao menos um item à OS para gerar a garantia.",
    });
  }

  // --- 4. Diagnostico -------------------------------------------------------
  if (entrada.regras.exigirDiagnosticoParaFinalizar && String(entrada.observacoes ?? "").trim() === "") {
    pendencias.push({
      codigo: "SEM_DIAGNOSTICO",
      mensagem: "Preencha o diagnóstico técnico da OS antes de finalizar.",
    });
  }

  // --- 5. Pagamento ---------------------------------------------------------
  if (!entrada.regras.permitirFinalizarSemPagamento && !entrada.possuiPagamentoConfirmado) {
    pendencias.push({
      codigo: "SEM_PAGAMENTO",
      mensagem:
        "Registre o recebimento desta OS antes de finalizar. Você pode cobrar pelo PDV ou lançar a conta a receber como paga.",
    });
  }

  // --- 6. Prazo de garantia -------------------------------------------------
  if (emiteTermo && faltaTermo && prazoGarantiaEfetivo !== null) {
    const { prazoMinimoGarantiaDias, prazoMaximoGarantiaDias } = entrada.regras;

    const prazoEhInteiroValido =
      Number.isFinite(prazoGarantiaEfetivo) && Number.isInteger(prazoGarantiaEfetivo);

    if (!prazoEhInteiroValido) {
      pendencias.push({
        codigo: "PRAZO_GARANTIA_INVALIDO",
        mensagem: "Informe o prazo de garantia em dias inteiros.",
      });
    } else if (
      prazoGarantiaEfetivo < prazoMinimoGarantiaDias ||
      prazoGarantiaEfetivo > prazoMaximoGarantiaDias
    ) {
      pendencias.push({
        codigo: "PRAZO_GARANTIA_INVALIDO",
        mensagem: `Informe um prazo de garantia entre ${prazoMinimoGarantiaDias} e ${prazoMaximoGarantiaDias} dias.`,
      });
    }
  }

  return {
    podeFinalizar: pendencias.length === 0,
    pendencias,
    ehResgate,
    deveGerarTermo: faltaTermo,
    deveArquivar: faltaArquivar,
    prazoGarantiaEfetivo,
  };
}

/** Mensagem curta para o toast, quando a finalizacao e bloqueada. */
export function resumirPendencias(pendencias: readonly PendenciaFinalizacao[]): string {
  if (pendencias.length === 0) {
    return "";
  }

  if (pendencias.length === 1) {
    return pendencias[0].mensagem;
  }

  return `A OS não pode ser finalizada: ${pendencias.length} pendências. ${pendencias[0].mensagem}`;
}
