export type ConfiguracaoPdvPagamentos = {
  permitirPagamentoMisto: boolean;
  permitirDescontoPDV: boolean;
  descontoMaximoPDVPercentual: number;
  permitirVendaSemEstoque: boolean;
  permitirVendaFiado: boolean;
  habilitarPix: boolean;
  habilitarDinheiro: boolean;
  habilitarCartaoDebito: boolean;
  habilitarCartaoCredito: boolean;
  habilitarBoleto: boolean;
  habilitarCrediario: boolean;
  taxaCartaoDebitoPercentual: number;
  taxaCartaoCredito1xPercentual: number;
  taxaCartaoCredito2xPercentual: number;
  taxaCartaoCredito3xPercentual: number;
  taxaCartaoCredito4xPercentual: number;
  taxaCartaoCredito5xPercentual: number;
  taxaCartaoCredito6xPercentual: number;
  taxaCartaoCredito7xPercentual: number;
  taxaCartaoCredito8xPercentual: number;
  taxaCartaoCredito9xPercentual: number;
  taxaCartaoCredito10xPercentual: number;
  taxaCartaoCredito11xPercentual: number;
  taxaCartaoCredito12xPercentual: number;
  prazoPadraoBoletoDias: number;
  prazoPadraoCrediarioDias: number;
  maxParcelasCartaoCredito: number;
};

export function obterDefaultsConfiguracaoPdv(): ConfiguracaoPdvPagamentos {
  return {
    permitirPagamentoMisto: true,
    permitirDescontoPDV: true,
    descontoMaximoPDVPercentual: 0,
    permitirVendaSemEstoque: false,
    permitirVendaFiado: false,
    habilitarPix: true,
    habilitarDinheiro: true,
    habilitarCartaoDebito: true,
    habilitarCartaoCredito: true,
    habilitarBoleto: false,
    habilitarCrediario: false,
    taxaCartaoDebitoPercentual: 0,
    taxaCartaoCredito1xPercentual: 0,
    taxaCartaoCredito2xPercentual: 0,
    taxaCartaoCredito3xPercentual: 0,
    taxaCartaoCredito4xPercentual: 0,
    taxaCartaoCredito5xPercentual: 0,
    taxaCartaoCredito6xPercentual: 0,
    taxaCartaoCredito7xPercentual: 0,
    taxaCartaoCredito8xPercentual: 0,
    taxaCartaoCredito9xPercentual: 0,
    taxaCartaoCredito10xPercentual: 0,
    taxaCartaoCredito11xPercentual: 0,
    taxaCartaoCredito12xPercentual: 0,
    prazoPadraoBoletoDias: 7,
    prazoPadraoCrediarioDias: 30,
    maxParcelasCartaoCredito: 12,
  };
}

function normalizarPercentual(valor: unknown, fallback: number): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return fallback;
  return Math.max(0, Number(numero.toFixed(2)));
}

function normalizarInteiro(valor: unknown, fallback: number, minimo: number, maximo: number): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return fallback;
  const inteiro = Math.trunc(numero);
  return Math.min(maximo, Math.max(minimo, inteiro));
}

export function normalizarConfiguracaoPdv(
  parcial: Partial<Record<keyof ConfiguracaoPdvPagamentos, unknown>> | null | undefined
): ConfiguracaoPdvPagamentos {
  const defaults = obterDefaultsConfiguracaoPdv();

  return {
    permitirPagamentoMisto:
      typeof parcial?.permitirPagamentoMisto === "boolean"
        ? Boolean(parcial.permitirPagamentoMisto)
        : defaults.permitirPagamentoMisto,
    permitirDescontoPDV:
      typeof parcial?.permitirDescontoPDV === "boolean"
        ? Boolean(parcial.permitirDescontoPDV)
        : defaults.permitirDescontoPDV,
    descontoMaximoPDVPercentual: normalizarPercentual(
      parcial?.descontoMaximoPDVPercentual,
      defaults.descontoMaximoPDVPercentual
    ),
    permitirVendaSemEstoque:
      typeof parcial?.permitirVendaSemEstoque === "boolean"
        ? Boolean(parcial.permitirVendaSemEstoque)
        : defaults.permitirVendaSemEstoque,
    permitirVendaFiado:
      typeof parcial?.permitirVendaFiado === "boolean"
        ? Boolean(parcial.permitirVendaFiado)
        : defaults.permitirVendaFiado,
    habilitarPix:
      typeof parcial?.habilitarPix === "boolean" ? Boolean(parcial.habilitarPix) : defaults.habilitarPix,
    habilitarDinheiro:
      typeof parcial?.habilitarDinheiro === "boolean"
        ? Boolean(parcial.habilitarDinheiro)
        : defaults.habilitarDinheiro,
    habilitarCartaoDebito:
      typeof parcial?.habilitarCartaoDebito === "boolean"
        ? Boolean(parcial.habilitarCartaoDebito)
        : defaults.habilitarCartaoDebito,
    habilitarCartaoCredito:
      typeof parcial?.habilitarCartaoCredito === "boolean"
        ? Boolean(parcial.habilitarCartaoCredito)
        : defaults.habilitarCartaoCredito,
    habilitarBoleto:
      typeof parcial?.habilitarBoleto === "boolean"
        ? Boolean(parcial.habilitarBoleto)
        : defaults.habilitarBoleto,
    habilitarCrediario:
      typeof parcial?.habilitarCrediario === "boolean"
        ? Boolean(parcial.habilitarCrediario)
        : defaults.habilitarCrediario,
    taxaCartaoDebitoPercentual: normalizarPercentual(
      parcial?.taxaCartaoDebitoPercentual,
      defaults.taxaCartaoDebitoPercentual
    ),
    taxaCartaoCredito1xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito1xPercentual,
      defaults.taxaCartaoCredito1xPercentual
    ),
    taxaCartaoCredito2xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito2xPercentual,
      defaults.taxaCartaoCredito2xPercentual
    ),
    taxaCartaoCredito3xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito3xPercentual,
      defaults.taxaCartaoCredito3xPercentual
    ),
    taxaCartaoCredito4xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito4xPercentual,
      defaults.taxaCartaoCredito4xPercentual
    ),
    taxaCartaoCredito5xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito5xPercentual,
      defaults.taxaCartaoCredito5xPercentual
    ),
    taxaCartaoCredito6xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito6xPercentual,
      defaults.taxaCartaoCredito6xPercentual
    ),
    taxaCartaoCredito7xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito7xPercentual,
      defaults.taxaCartaoCredito7xPercentual
    ),
    taxaCartaoCredito8xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito8xPercentual,
      defaults.taxaCartaoCredito8xPercentual
    ),
    taxaCartaoCredito9xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito9xPercentual,
      defaults.taxaCartaoCredito9xPercentual
    ),
    taxaCartaoCredito10xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito10xPercentual,
      defaults.taxaCartaoCredito10xPercentual
    ),
    taxaCartaoCredito11xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito11xPercentual,
      defaults.taxaCartaoCredito11xPercentual
    ),
    taxaCartaoCredito12xPercentual: normalizarPercentual(
      parcial?.taxaCartaoCredito12xPercentual,
      defaults.taxaCartaoCredito12xPercentual
    ),
    prazoPadraoBoletoDias: normalizarInteiro(
      parcial?.prazoPadraoBoletoDias,
      defaults.prazoPadraoBoletoDias,
      1,
      365
    ),
    prazoPadraoCrediarioDias: normalizarInteiro(
      parcial?.prazoPadraoCrediarioDias,
      defaults.prazoPadraoCrediarioDias,
      1,
      365
    ),
    maxParcelasCartaoCredito: normalizarInteiro(
      parcial?.maxParcelasCartaoCredito,
      defaults.maxParcelasCartaoCredito,
      1,
      12
    ),
  };
}

export function possuiFormaPagamentoHabilitada(configuracao: ConfiguracaoPdvPagamentos): boolean {
  return (
    configuracao.habilitarPix ||
    configuracao.habilitarDinheiro ||
    configuracao.habilitarCartaoDebito ||
    configuracao.habilitarCartaoCredito ||
    configuracao.habilitarBoleto ||
    configuracao.habilitarCrediario
  );
}
