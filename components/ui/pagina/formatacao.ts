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

const valorBR = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Valor monetário sem o símbolo, para colunas de tabela onde a moeda já está no contexto. */
export function formatarValor(valor: number): string {
  return valorBR.format(valor);
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

export function formatarDias(valor: number): string {
  const arredondado = Math.round(valor * 10) / 10;
  return `${numeroBR.format(arredondado)} ${arredondado === 1 ? "dia" : "dias"}`;
}

export function formatarDataCurta(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

// Superfície única: mesmo fundo e o mesmo fio de 1px em todos os blocos.
export const CLASSE_SUPERFICIE = "border-border bg-card";
