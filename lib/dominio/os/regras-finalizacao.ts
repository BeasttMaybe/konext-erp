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
  | "ITEM_SEM_CUSTO"
  | "ITEM_SEM_PRECO_VENDA"
  | "SEM_DIAGNOSTICO"
  | "SEM_PAGAMENTO"
  | "SEM_VENDA_VINCULADA"
  | "PRAZO_GARANTIA_INVALIDO";

export type PendenciaFinalizacao = {
  codigo: CodigoPendenciaFinalizacao;
  mensagem: string;
  /**
   * So presente nas pendencias por item (ITEM_SEM_CUSTO / ITEM_SEM_PRECO_VENDA)
   * — a UI usa para o atalho "editar este item".
   */
  itemId?: string;
};

export type RegrasConfiguracaoFinalizacao = {
  exigirDiagnosticoParaFinalizar: boolean;
  permitirFinalizarSemPagamento: boolean;
  prazoGarantiaPadraoDias: number;
  prazoMinimoGarantiaDias: number;
  prazoMaximoGarantiaDias: number;
};

export type ItemParaAvaliacaoFinalizacao = {
  id: string;
  descricao: string;
  custo: number;
  precoVenda: number;
};

export type EntradaAvaliacaoFinalizacao = {
  status: StatusOS;
  ehRetornoGarantia: boolean;
  excluidaEm: Date | null;
  archivedAt: Date | null;
  possuiTermoGarantia: boolean;
  itens: readonly ItemParaAvaliacaoFinalizacao[];
  observacoes: string | null;
  possuiPagamentoConfirmado: boolean;
  /** Existe um ContaReceber com venda vinculada (origem ORDEM_SERVICO) para esta OS — "pedido gerado no PDV". */
  possuiVendaVinculada: boolean;
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
 * da OS de origem. As exigencias "comerciais" de uma entrega normal — item
 * com custo e preco de venda, pedido gerado no PDV — tambem nao se aplicam a
 * ela pelo mesmo motivo: o retorno nao e uma venda nova.
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

  // --- 3. Itens, custo/preço de cada item e pedido no PDV --------------------
  // Uma entrega NORMAL (nao retorno de garantia) exige: pelo menos um item;
  // cada item com custo e preço de venda informados; e um pedido ja gerado no
  // PDV para esta OS. Uma OS sem nenhum item so pode ser encerrada por
  // finalizarSemServico — nao por aqui.
  if (emiteTermo) {
    if (entrada.itens.length === 0) {
      pendencias.push({
        codigo: "SEM_ITENS",
        mensagem:
          'Esta OS não tem nenhuma peça ou serviço vinculado. Para entregar mesmo assim, use "Encerrar sem serviço".',
      });
    } else {
      for (const item of entrada.itens) {
        const rotulo = item.descricao.trim() || "sem descrição";

        if (!(item.custo > 0)) {
          pendencias.push({
            codigo: "ITEM_SEM_CUSTO",
            mensagem: `Informe o custo da peça em "${rotulo}".`,
            itemId: item.id,
          });
        }

        if (!(item.precoVenda > 0)) {
          pendencias.push({
            codigo: "ITEM_SEM_PRECO_VENDA",
            mensagem: `Informe o preço de venda da peça em "${rotulo}".`,
            itemId: item.id,
          });
        }
      }
    }

    if (!entrada.possuiVendaVinculada) {
      pendencias.push({
        codigo: "SEM_VENDA_VINCULADA",
        mensagem: "Gere o pedido no PDV para esta OS antes de entregar.",
      });
    }
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

export type EntradaAvaliacaoSemServico = {
  status: StatusOS;
  excluidaEm: Date | null;
  quantidadeItens: number;
};

export type ResultadoAvaliacaoSemServico =
  | { podeFinalizar: true }
  | { podeFinalizar: false; erro: string };

/**
 * Encerramento sem serviço vinculado: caminho dedicado para a OS que nunca
 * teve peça ou serviço lançado (ex.: cliente desistiu, aparelho irreparável
 * sem custo cobrado). Não gera termo de garantia nem exige pedido no PDV —
 * é o oposto de `avaliarFinalizacao`, cuja exigência de itens torna esse
 * caso impossível de finalizar pelo caminho normal.
 */
export function avaliarFinalizacaoSemServico(
  entrada: EntradaAvaliacaoSemServico
): ResultadoAvaliacaoSemServico {
  if (entrada.excluidaEm !== null) {
    return { podeFinalizar: false, erro: "Esta OS foi excluída e não pode ser finalizada." };
  }

  if (entrada.status === "ENTREGUE") {
    return { podeFinalizar: false, erro: "Esta OS já está entregue." };
  }

  if (entrada.status !== "PRONTO") {
    return { podeFinalizar: false, erro: 'Mova a OS para "Pronto" antes de encerrar sem serviço.' };
  }

  if (entrada.quantidadeItens > 0) {
    return {
      podeFinalizar: false,
      erro:
        'Esta OS tem peça ou serviço vinculado — use a finalização normal em vez de "Encerrar sem serviço".',
    };
  }

  return { podeFinalizar: true };
}
