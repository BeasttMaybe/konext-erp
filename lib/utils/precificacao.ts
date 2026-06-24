import type { TipoPeca } from "@prisma/client";

function arredondarParaMoeda(valor: number): number {
  return Number(valor.toFixed(2));
}

export function calcularPrecoVendaPeca(tipoPeca: TipoPeca, custo: number): number {
  if (!Number.isFinite(custo) || custo < 0) {
    throw new Error("O custo da peca deve ser um numero valido e maior ou igual a zero.");
  }

  switch (tipoPeca) {
    case "TELA": {
      if (custo <= 150) return arredondarParaMoeda(custo + custo * 2.0);
      if (custo <= 250) return arredondarParaMoeda(custo + custo * 1.75);
      return arredondarParaMoeda(custo + custo * 1.5);
    }

    case "BATERIA": {
      if (custo <= 80) return arredondarParaMoeda(custo + custo * 2.0);
      if (custo <= 140) return arredondarParaMoeda(custo + custo * 1.75);
      return arredondarParaMoeda(custo + custo * 1.5);
    }

    case "CONECTOR_CARGA":
      return arredondarParaMoeda(custo + 100);

    case "TAMPA_IPHONE":
      return arredondarParaMoeda(custo + 200);

    case "TAMPA_ANDROID":
      return arredondarParaMoeda(custo + 80);

    case "OUTROS":
      return 0;

    default:
      return 0;
  }
}
