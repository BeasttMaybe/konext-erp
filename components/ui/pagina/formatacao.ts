const moedaBR = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moedaCompactaBR = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numeroBR = new Intl.NumberFormat("pt-BR");

export function formatarMoeda(valor: number): string {
  return moedaBR.format(valor);
}

export function formatarMoedaCompacta(valor: number): string {
  return moedaCompactaBR.format(valor);
}

export function formatarNumero(valor: number): string {
  return numeroBR.format(valor);
}

// Percentual sem casas decimais, exceto abaixo de 1% — onde arredondar esconderia o valor.
export function formatarPercentual(valor: number): string {
  const casas = valor !== 0 && Math.abs(valor) < 1 ? 1 : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor / 100);
}
