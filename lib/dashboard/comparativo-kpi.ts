/**
 * Regra de comparação de um KPI com o período anterior (Fase 3-2A) — módulo
 * puro (sem Prisma, sem I/O), extraído de `app/actions/dashboard.ts` pra
 * poder ser testado isoladamente (`app/actions/dashboard.ts` importa Prisma
 * e exige contexto de tenant no import, então não dá pra testar a regra
 * direto ali sem subir todo esse aparato).
 */

/** Para qual lado a variação é boa. Nunca inferido do sinal. */
export type DirecaoBoaKpi = "cima" | "baixo";

export type ComparativoKpi = {
  valor: number | null;
  anterior: number | null;
  variacaoPercentual: number | null;
  direcaoBoa: DirecaoBoaKpi;
};

/**
 * Comparação com o período anterior. Sem base (valor nulo, anterior nulo OU
 * anterior zero) a variação fica nula e a tela mostra "—"/nada — NUNCA
 * "−100,0%". `anterior === 0` conta como "sem base" de propósito: dividir
 * por zero não é o problema (`anterior` é sempre um `number` de verdade, as
 * consultas de receita fazem `COALESCE(SUM(...), 0)` — nunca `null`), o
 * problema é semântico. Sem nenhuma venda no período anterior não é "caiu
 * 100%", é "não há com o que comparar".
 */
export function montarComparativo(
  valor: number | null,
  anterior: number | null,
  direcaoBoa: DirecaoBoaKpi
): ComparativoKpi {
  const temBase = valor !== null && anterior !== null && anterior !== 0;

  return {
    valor,
    anterior,
    variacaoPercentual: temBase ? ((valor - anterior) / Math.abs(anterior)) * 100 : null,
    direcaoBoa,
  };
}
