import type { TipoPeca } from "@prisma/client";
import { deDecimal, multiplicarPorQuantidade, paraMoeda, somar } from "@/lib/dinheiro";

/** `custo + custo * fator` (markup multiplicativo) — centavo-exato via lib/dinheiro.ts. */
function comMarkupMultiplicativo(custoCentavos: number, fator: number): number {
  return multiplicarPorQuantidade(custoCentavos, 1 + fator);
}

/** `custo + acrescimoReais` (markup fixo em reais) — centavo-exato via lib/dinheiro.ts. */
function comMarkupFixo(custoCentavos: number, acrescimoReais: number): number {
  return somar(custoCentavos, deDecimal(acrescimoReais));
}

export function calcularPrecoVendaPeca(tipoPeca: TipoPeca, custo: number): number {
  if (!Number.isFinite(custo) || custo < 0) {
    throw new Error("O custo da peca deve ser um numero valido e maior ou igual a zero.");
  }

  const custoCentavos = deDecimal(custo);

  switch (tipoPeca) {
    case "TELA": {
      if (custo <= 150) return paraMoeda(comMarkupMultiplicativo(custoCentavos, 2.0));
      if (custo <= 250) return paraMoeda(comMarkupMultiplicativo(custoCentavos, 1.75));
      return paraMoeda(comMarkupMultiplicativo(custoCentavos, 1.5));
    }

    case "BATERIA": {
      if (custo <= 80) return paraMoeda(comMarkupMultiplicativo(custoCentavos, 2.0));
      if (custo <= 140) return paraMoeda(comMarkupMultiplicativo(custoCentavos, 1.75));
      return paraMoeda(comMarkupMultiplicativo(custoCentavos, 1.5));
    }

    case "CONECTOR_CARGA":
      return paraMoeda(comMarkupFixo(custoCentavos, 100));

    case "TAMPA_IPHONE":
      return paraMoeda(comMarkupFixo(custoCentavos, 200));

    case "TAMPA_ANDROID":
      return paraMoeda(comMarkupFixo(custoCentavos, 80));

    case "OUTROS":
      return 0;

    default:
      return 0;
  }
}
