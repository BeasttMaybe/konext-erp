import { useCallback } from "react";
import { TipoPecaOrcamento } from "@/types/os";

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

      switch (tipo) {
        case "TELA": {
          if (custoPeca <= 150) return custoPeca * 3; // 200% markup
          if (custoPeca <= 250) return custoPeca * 2.75; // 175% markup
          return custoPeca * 2.5; // 150% markup
        }

        case "BATERIA": {
          if (custoPeca <= 80) return custoPeca * 3; // 200% markup
          if (custoPeca <= 140) return custoPeca * 2.75; // 175% markup
          return custoPeca * 2.5; // 150% markup
        }

        case "CONECTOR_CARGA": {
          return custoPeca + 100; // R$ 100 de mão de obra fixa
        }

        case "TAMPA_IPHONE": {
          return custoPeca + 200; // R$ 200 de mão de obra fixa
        }

        case "TAMPA_ANDROID": {
          return custoPeca + 80; // R$ 80 de mão de obra fixa
        }

        case "OUTROS": {
          // Sem cálculo automático - deixa para avaliação manual
          return 0;
        }

        default:
          return 0;
      }
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
