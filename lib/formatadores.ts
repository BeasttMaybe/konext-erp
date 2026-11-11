/**
 * Utilitários de Formatação
 */

/**
 * Formata uma data e hora para o padrão brasileiro
 */
export const formatarDataHoraBrasileira = (data: Date): string => {
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
