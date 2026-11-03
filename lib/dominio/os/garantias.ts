/**
 * Regras puras das garantias de OS.
 *
 * Existe porque a constante de "vencendo" morava em `app/actions/garantias.ts`,
 * que é um arquivo `"use server"` — e ali só é permitido exportar função
 * assíncrona. Exportar uma `const` de lá derruba o módulo inteiro no build, com
 * uma mensagem que fala do tipo exportado logo abaixo e não da constante.
 * Regra de domínio não pertence a um arquivo de action de qualquer forma.
 */

/**
 * Dias antes do fim em que a garantia entra em "vencendo".
 *
 * Sete dias é o que dá para o cliente conseguir trazer o aparelho de volta
 * dentro do prazo depois de ser avisado — uma janela menor avisa tarde demais
 * para ser útil, e uma maior transforma metade da lista em alerta.
 */
export const DIAS_PARA_VENCIMENTO_PROXIMO = 7;

/** Espelha `StatusGarantia` da action — os estados que a pílula da linha mostra. */
export type EstadoDaGarantia =
  | "ATIVA"
  | "PERTO_DO_VENCIMENTO"
  | "VENCIDA"
  | "RETORNO_EM_ANDAMENTO"
  | "RETORNO_FINALIZADO"
  | "SEM_COBERTURA"
  | "CANCELADA";

/**
 * Abas de triagem da tela de Garantias.
 *
 * São recortes por DATA e por cancelamento, e não pelo estado da pílula. A
 * razão é a ordem da máquina de status: ela decide "teve retorno" ANTES de
 * olhar o vencimento, então uma garantia vencida que já teve retorno nunca
 * aparece como VENCIDA. Quem pergunta "o que já expirou?" está perguntando
 * sobre a data, e a resposta tem que ser sobre a data.
 */
export type SituacaoGarantia =
  | "VIGENTES"
  | "VENCENDO"
  | "VENCIDAS"
  | "COM_RETORNO"
  | "CANCELADAS"
  | "TODAS";

export const ABAS_DE_GARANTIA: ReadonlyArray<{
  valor: SituacaoGarantia;
  rotulo: string;
  ajuda: string;
}> = [
  { valor: "VIGENTES", rotulo: "Vigentes", ajuda: "A garantia ainda está valendo." },
  {
    valor: "VENCENDO",
    rotulo: "Vencendo",
    ajuda: `Acaba nos próximos ${DIAS_PARA_VENCIMENTO_PROXIMO} dias.`,
  },
  {
    valor: "VENCIDAS",
    rotulo: "Vencidas",
    ajuda: "O prazo já passou — a loja não deve mais cobertura.",
  },
  {
    valor: "COM_RETORNO",
    rotulo: "Com retorno",
    ajuda: "O aparelho voltou pelo menos uma vez.",
  },
  { valor: "CANCELADAS", rotulo: "Canceladas", ajuda: "Termo cancelado, ou OS excluída." },
  { valor: "TODAS", rotulo: "Todas", ajuda: "Sem recorte." },
];

export function ajudaDaSituacao(situacao: SituacaoGarantia): string {
  return ABAS_DE_GARANTIA.find((aba) => aba.valor === situacao)?.ajuda ?? "";
}

/**
 * A frase da coluna "Garantia até".
 *
 * Separada da tabela porque o caso de um dia tem forma própria em português
 * ("vence amanhã", "venceu ontem"), e um `${n} dia(s)` genérico é a marca de
 * texto que ninguém escreveu de verdade.
 */
export function descricaoDeVencimento(diasRestantes: number): string {
  if (diasRestantes === 0) return "Vence hoje";
  if (diasRestantes === 1) return "Vence amanhã";
  if (diasRestantes > 1) return `Faltam ${diasRestantes} dias`;
  if (diasRestantes === -1) return "Venceu ontem";
  return `Venceu há ${Math.abs(diasRestantes)} dias`;
}

export type UrgenciaDoVencimento = "VENCIDA" | "PERTO" | "TRANQUILA";

/** Decide o destaque da data na linha, sem a tela repetir os limites. */
export function urgenciaDoVencimento(diasRestantes: number): UrgenciaDoVencimento {
  if (diasRestantes < 0) return "VENCIDA";
  if (diasRestantes <= DIAS_PARA_VENCIMENTO_PROXIMO) return "PERTO";
  return "TRANQUILA";
}
