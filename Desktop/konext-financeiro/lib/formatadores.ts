/**
 * Utilitários de Formatação
 */

/**
 * Formata um número como moeda brasileira
 */
export const formatarMoedaBrasileira = (valor: number): string => {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Formata uma data para o padrão brasileiro
 */
export const formatarDataBrasileira = (data: Date): string => {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

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

/**
 * Calcula o percentual de variação
 */
export const calcularVariacao = (
  valorAtual: number,
  valorAnterior: number
): number => {
  if (valorAnterior === 0) return 0;
  return ((valorAtual - valorAnterior) / valorAnterior) * 100;
};
