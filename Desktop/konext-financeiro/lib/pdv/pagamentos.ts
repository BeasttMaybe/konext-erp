export type FormaPagamentoPdv =
  | "PIX"
  | "TED"
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_CREDITO_AVISTA"
  | "CARTAO_CREDITO_PARCELADO"
  | "CARTAO_DEBITO"
  | "BOLETO"
  | "CREDIARIO"
  | "EMPENHO_PUBLICO";

export interface EntradaPagamentoPdv {
  formaPagamento: FormaPagamentoPdv;
  valorBruto: number;
  parcelas?: number;
  diasVencimento?: number;
}

export interface ResultadoPagamentoPdv {
  formaPagamento: FormaPagamentoPdv;
  valorBruto: number;
  percentualTaxa: number;
  valorTaxa: number;
  valorLiquido: number;
  parcelas: number;
  diasVencimento: number | null;
  dataVencimento: Date | null;
}

export interface ConfigPagamentoPdv {
  formaPagamento: FormaPagamentoPdv;
  rotulo: string;
  percentualTaxaBase: number;
  permiteParcelas: boolean;
  exigePrazo: boolean;
}

export const CONFIG_PAGAMENTOS_PDV: ConfigPagamentoPdv[] = [
  {
    formaPagamento: "PIX",
    rotulo: "PIX",
    percentualTaxaBase: 0,
    permiteParcelas: false,
    exigePrazo: false,
  },
  {
    formaPagamento: "TED",
    rotulo: "TED",
    percentualTaxaBase: 0,
    permiteParcelas: false,
    exigePrazo: false,
  },
  {
    formaPagamento: "DINHEIRO",
    rotulo: "Dinheiro",
    percentualTaxaBase: 0,
    permiteParcelas: false,
    exigePrazo: false,
  },
  {
    formaPagamento: "CARTAO_DEBITO",
    rotulo: "Cartao de Debito",
    percentualTaxaBase: 1.36,
    permiteParcelas: false,
    exigePrazo: false,
  },
  {
    formaPagamento: "CARTAO_CREDITO",
    rotulo: "Cartao de Credito",
    percentualTaxaBase: 3.14,
    permiteParcelas: true,
    exigePrazo: false,
  },
  {
    formaPagamento: "CARTAO_CREDITO_AVISTA",
    rotulo: "Cartao de Credito a Vista",
    percentualTaxaBase: 3.14,
    permiteParcelas: false,
    exigePrazo: false,
  },
  {
    formaPagamento: "CARTAO_CREDITO_PARCELADO",
    rotulo: "Cartao de Credito Parcelado",
    percentualTaxaBase: 3.14,
    permiteParcelas: true,
    exigePrazo: false,
  },
  {
    formaPagamento: "BOLETO",
    rotulo: "Boleto Bancario",
    percentualTaxaBase: 0,
    permiteParcelas: false,
    exigePrazo: true,
  },
  {
    formaPagamento: "CREDIARIO",
    rotulo: "Crediario",
    percentualTaxaBase: 0,
    permiteParcelas: true,
    exigePrazo: true,
  },
  {
    formaPagamento: "EMPENHO_PUBLICO",
    rotulo: "Empenho Publico",
    percentualTaxaBase: 0,
    permiteParcelas: false,
    exigePrazo: true,
  },
];

const mapaConfiguracao = new Map(CONFIG_PAGAMENTOS_PDV.map((item) => [item.formaPagamento, item]));

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

export function obterConfigPagamento(formaPagamento: FormaPagamentoPdv): ConfigPagamentoPdv {
  const config = mapaConfiguracao.get(formaPagamento);
  if (!config) {
    throw new Error(`Forma de pagamento nao suportada: ${formaPagamento}`);
  }

  return config;
}

export function calcularPercentualTaxa(
  formaPagamento: FormaPagamentoPdv,
  parcelas: number
): number {
  const config = obterConfigPagamento(formaPagamento);

  if (formaPagamento === "CARTAO_CREDITO_PARCELADO") {
    const parcelasNorm = Math.max(1, parcelas);
    return Number((config.percentualTaxaBase + (parcelasNorm - 1) * 0.45).toFixed(2));
  }

  return config.percentualTaxaBase;
}

export function calcularPagamentoPdv(input: EntradaPagamentoPdv): ResultadoPagamentoPdv {
  const config = obterConfigPagamento(input.formaPagamento);
  const valorBruto = Math.max(0, Number(input.valorBruto || 0));
  const parcelas = config.permiteParcelas ? Math.max(1, Math.trunc(Number(input.parcelas || 1))) : 1;
  const percentualTaxa = calcularPercentualTaxa(input.formaPagamento, parcelas);
  const valorBrutoCentavos = paraCentavos(valorBruto);
  const valorTaxaCentavos = Math.round((valorBrutoCentavos * percentualTaxa) / 100);
  const valorLiquidoCentavos = valorBrutoCentavos - valorTaxaCentavos;

  const diasVencimento = config.exigePrazo
    ? Math.max(0, Math.trunc(Number(input.diasVencimento || 0)))
    : null;

  const dataVencimento = diasVencimento !== null
    ? new Date(Date.now() + diasVencimento * 24 * 60 * 60 * 1000)
    : null;

  return {
    formaPagamento: input.formaPagamento,
    valorBruto: paraMoeda(valorBrutoCentavos),
    percentualTaxa,
    valorTaxa: paraMoeda(valorTaxaCentavos),
    valorLiquido: paraMoeda(valorLiquidoCentavos),
    parcelas,
    diasVencimento,
    dataVencimento,
  };
}

export function ehPagamentoPrazo(formaPagamento: FormaPagamentoPdv): boolean {
  return formaPagamento === "BOLETO" || formaPagamento === "CREDIARIO" || formaPagamento === "EMPENHO_PUBLICO";
}

export function formatarFormaPagamento(formaPagamento: FormaPagamentoPdv): string {
  return obterConfigPagamento(formaPagamento).rotulo;
}
