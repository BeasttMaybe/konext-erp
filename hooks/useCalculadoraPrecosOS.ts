import { useCallback } from "react";
import type { TipoPeca } from "@prisma/client";
import { TipoPecaOrcamento } from "@/types/os";
import { calcularPrecoVendaPeca } from "@/lib/utils/precificacao";

/**
 * Hook para cálculo automático de preço baseado em regras de negócio
 */
export function useCalculadoraPrecosOS() {
  /**
   * Calcula o valor a cobrar baseado no tipo de peça e custo
   */
  const calcularValorCobrado = useCallback(
    (tipo: TipoPecaOrcamento, custoPeca: number): number => {
      if (custoPeca <= 0) return 0;
      return calcularPrecoVendaPeca(tipo as TipoPeca, custoPeca);
    },
    []
  );

  /**
   * Calcula o total do orçamento a partir de um array de itens
   */
  const calcularTotalOrcamento = useCallback(
    (itens: Array<{ valorCobrado: number }>): number => {
      return itens.reduce((total, item) => total + item.valorCobrado, 0);
    },
    []
  );

  /**
   * Calcula o markup em porcentagem
   */
  const calcularMarkupPercentual = useCallback(
    (custoPeca: number, valorCobrado: number): number => {
      if (custoPeca <= 0) return 0;
      return ((valorCobrado - custoPeca) / custoPeca) * 100;
    },
    []
  );

  return {
    calcularValorCobrado,
    calcularTotalOrcamento,
    calcularMarkupPercentual,
  };
}
