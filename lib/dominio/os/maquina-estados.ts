/**
 * Maquina de estados da Ordem de Servico — dominio puro.
 *
 * Fonte UNICA de verdade para a sequencia de status, rotulos, cores e
 * transicoes permitidas. Antes da Fase 1A essa informacao estava duplicada em
 * quatro lugares (app/actions/os.ts, components/os/tabuleiro-kanban.tsx,
 * dados/mock-os.ts e o proprio enum do Prisma), com dois esquemas de cor
 * diferentes e nenhuma regra de alcancabilidade.
 *
 * Este modulo nao importa Prisma, React nem Next: e testavel sem banco.
 */

export type StatusOS =
  | "AGUARDANDO_ORCAMENTO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADO"
  | "AGUARDANDO_PECA"
  | "EM_MANUTENCAO"
  | "GARANTIA_RETORNO"
  | "PRONTO"
  | "ENTREGUE";

/** Ordem de exibicao do Kanban e da navegacao por botoes. */
export const STATUS_OS_SEQUENCIA = [
  "AGUARDANDO_ORCAMENTO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
  "GARANTIA_RETORNO",
  "PRONTO",
  "ENTREGUE",
] as const satisfies readonly StatusOS[];

/** Status de trabalho em andamento de uma OS normal. */
export const STATUS_OS_EM_ANDAMENTO = [
  "AGUARDANDO_ORCAMENTO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
] as const satisfies readonly StatusOS[];

/** Status para os quais uma OS PRONTA pode voltar (retrabalho). */
export const STATUS_OS_RETRABALHO = ["AGUARDANDO_PECA", "EM_MANUTENCAO"] as const satisfies readonly StatusOS[];

/** Status permitidos para uma OS de retorno de garantia. */
export const STATUS_OS_RETORNO_GARANTIA = [
  "GARANTIA_RETORNO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
] as const satisfies readonly StatusOS[];

export const ROTULOS_STATUS_OS: Readonly<Record<StatusOS, string>> = {
  AGUARDANDO_ORCAMENTO: "Aguardando Orçamento",
  AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  APROVADO: "Aprovado",
  AGUARDANDO_PECA: "Aguardando Peça",
  EM_MANUTENCAO: "Em Manutenção",
  GARANTIA_RETORNO: "Garantia / Retorno",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
};

export const DESCRICOES_STATUS_OS: Readonly<Record<StatusOS, string>> = {
  AGUARDANDO_ORCAMENTO: "Entrada inicial e diagnóstico.",
  AGUARDANDO_APROVACAO: "Proposta enviada ao cliente.",
  APROVADO: "OS pronta para execução.",
  AGUARDANDO_PECA: "Dependência de fornecedor.",
  EM_MANUTENCAO: "Trabalho técnico em andamento.",
  GARANTIA_RETORNO: "Atendimento de retorno em garantia.",
  PRONTO: "Aguardando retirada.",
  ENTREGUE: "Fluxo concluído com sucesso.",
};

export type ClassesVisuaisStatusOS = {
  /** Gradiente do cabecalho da coluna do Kanban. */
  readonly coluna: string;
  /** Borda da coluna do Kanban. */
  readonly borda: string;
  /** Chip compacto usado no cartao e nas tabelas. */
  readonly chip: string;
};

export const CLASSES_STATUS_OS: Readonly<Record<StatusOS, ClassesVisuaisStatusOS>> = {
  AGUARDANDO_ORCAMENTO: {
    coluna: "from-sky-50 via-white to-white dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-sky-200/80 dark:border-sky-900/60",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  AGUARDANDO_APROVACAO: {
    coluna: "from-cyan-50 via-white to-white dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-cyan-200/80 dark:border-cyan-900/60",
    chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  },
  APROVADO: {
    coluna: "from-amber-50 via-white to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-amber-200/80 dark:border-amber-900/60",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  AGUARDANDO_PECA: {
    coluna: "from-orange-50 via-white to-white dark:from-orange-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-orange-200/80 dark:border-orange-900/60",
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  },
  EM_MANUTENCAO: {
    coluna: "from-violet-50 via-white to-white dark:from-violet-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-violet-200/80 dark:border-violet-900/60",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  GARANTIA_RETORNO: {
    coluna: "from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-indigo-200/80 dark:border-indigo-900/60",
    chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  PRONTO: {
    coluna: "from-emerald-50 via-white to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-emerald-200/80 dark:border-emerald-900/60",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  ENTREGUE: {
    coluna: "from-rose-50 via-white to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900",
    borda: "border-rose-200/80 dark:border-rose-900/60",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

export type ContextoTransicaoOS = {
  ehRetornoGarantia: boolean;
};

export function ehStatusOS(valor: string): valor is StatusOS {
  return (STATUS_OS_SEQUENCIA as readonly string[]).includes(valor);
}

function pertence(lista: readonly StatusOS[], status: StatusOS): boolean {
  return lista.includes(status);
}

/**
 * Status em que uma OS do tipo informado pode legitimamente estar.
 * ENTREGUE aparece aqui porque e um estado valido — mas so se chega nele pela
 * finalizacao, nunca por mudanca generica de status.
 */
export function statusPermitidosParaTipo(contexto: ContextoTransicaoOS): readonly StatusOS[] {
  return contexto.ehRetornoGarantia
    ? ([...STATUS_OS_RETORNO_GARANTIA, "PRONTO", "ENTREGUE"] as const)
    : ([...STATUS_OS_EM_ANDAMENTO, "PRONTO", "ENTREGUE"] as const);
}

/**
 * Regra central. Cobre APENAS mudanca generica de status.
 *
 * Duas transicoes ficam de fora por definicao e sao tratadas por acoes
 * dedicadas, com regras e auditoria proprias:
 *   - qualquer -> ENTREGUE  ....... finalizarOrdemServico (Parte 2)
 *   - ENTREGUE -> qualquer  ....... reabrirOrdemServico   (Parte 3)
 */
export function podeTransicionar(
  de: StatusOS,
  para: StatusOS,
  contexto: ContextoTransicaoOS
): boolean {
  if (de === para) {
    return false;
  }

  // ENTREGUE so entra pela finalizacao e so sai pela reabertura.
  if (para === "ENTREGUE" || de === "ENTREGUE") {
    return false;
  }

  if (contexto.ehRetornoGarantia) {
    // Numa OS de retorno, GARANTIA_RETORNO / AGUARDANDO_PECA / EM_MANUTENCAO
    // conversam livremente entre si e todas levam a PRONTO.
    if (pertence(STATUS_OS_RETORNO_GARANTIA, de)) {
      return pertence(STATUS_OS_RETORNO_GARANTIA, para) || para === "PRONTO";
    }

    if (de === "PRONTO") {
      return pertence(STATUS_OS_RETRABALHO, para);
    }

    return false;
  }

  // OS normal: GARANTIA_RETORNO nunca participa.
  if (de === "GARANTIA_RETORNO" || para === "GARANTIA_RETORNO") {
    return false;
  }

  if (pertence(STATUS_OS_EM_ANDAMENTO, de)) {
    // Pular etapas e permitido de proposito: a oficina nem sempre orca antes de
    // consertar, e forcar o caminho longo foi o que levou operadores a arrastar
    // o cartao por todas as colunas (ver AUDIT_REPORT secao 16.7-d).
    return pertence(STATUS_OS_EM_ANDAMENTO, para) || para === "PRONTO";
  }

  if (de === "PRONTO") {
    return pertence(STATUS_OS_RETRABALHO, para);
  }

  return false;
}

/** Todos os destinos alcancaveis a partir de `de`, na ordem do Kanban. */
export function destinosPermitidos(
  de: StatusOS,
  contexto: ContextoTransicaoOS
): readonly StatusOS[] {
  return STATUS_OS_SEQUENCIA.filter((destino) => podeTransicionar(de, destino, contexto));
}

/**
 * Mensagem em pt-BR explicando por que a transicao foi negada.
 * Retorna null quando a transicao e permitida.
 */
export function motivoTransicaoNegada(
  de: StatusOS,
  para: StatusOS,
  contexto: ContextoTransicaoOS
): string | null {
  if (podeTransicionar(de, para, contexto)) {
    return null;
  }

  if (de === para) {
    return `A OS já está em "${ROTULOS_STATUS_OS[para]}".`;
  }

  if (para === "ENTREGUE") {
    return 'Para entregar a OS, use a ação "Finalizar": ela gera o termo de garantia e arquiva a OS na mesma operação.';
  }

  if (de === "ENTREGUE") {
    return 'Esta OS já foi entregue. Para movê-la novamente, use a ação "Reabrir OS" e informe o motivo.';
  }

  if (contexto.ehRetornoGarantia) {
    if (para === "AGUARDANDO_ORCAMENTO" || para === "AGUARDANDO_APROVACAO" || para === "APROVADO") {
      return `OS de retorno de garantia não passa por "${ROTULOS_STATUS_OS[para]}". Use Garantia / Retorno, Aguardando Peça ou Em Manutenção.`;
    }

    return `Não é possível mover uma OS de retorno de garantia de "${ROTULOS_STATUS_OS[de]}" para "${ROTULOS_STATUS_OS[para]}".`;
  }

  if (para === "GARANTIA_RETORNO") {
    return 'A coluna "Garantia / Retorno" é exclusiva de OS abertas como retorno de garantia. Para registrar um retorno, use a ação de garantia da OS original.';
  }

  if (de === "GARANTIA_RETORNO") {
    return 'Esta OS está em "Garantia / Retorno" mas não está marcada como retorno de garantia. Corrija o cadastro antes de movê-la.';
  }

  if (de === "PRONTO") {
    return 'Uma OS pronta só pode voltar para "Aguardando Peça" ou "Em Manutenção" (retrabalho).';
  }

  return `Não é possível mover a OS de "${ROTULOS_STATUS_OS[de]}" para "${ROTULOS_STATUS_OS[para]}".`;
}
