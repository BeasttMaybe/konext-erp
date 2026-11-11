// `paraCentavos`/`paraMoeda` viviam neste arquivo antes da Fase 2A-2. A
// fórmula de arredondamento de centavo agora tem UMA única implementação em
// lib/dinheiro.ts (o módulo de dinheiro da fase); este arquivo só reexporta
// os dois nomes, pra não quebrar nenhum import existente (app/actions/pdv.ts,
// lib/dominio/pdv/calcular-venda.ts, etc.).
import { paraCentavos, paraMoeda } from "@/lib/dinheiro";
export { paraCentavos, paraMoeda };

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

export interface ParametrosCalculoPagamentoPdv {
  taxaCartaoDebitoPercentual?: number;
  taxaCartaoCreditoPorParcela?: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12, number>>;
  maxParcelasCartaoCredito?: number;
  prazoPadraoBoletoDias?: number;
  prazoPadraoCrediarioDias?: number;
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

/**
 * Trecho fixo usado em toda mensagem de erro do PDV causada por dados
 * desatualizados no carrinho do cliente (preco mudou, produto foi
 * desativado, soma dos pagamentos nao bate mais, etc.). O cliente
 * (pdv/page.tsx) reconhece este texto para mostrar um aviso especifico e
 * recarregar o catalogo, em vez do toast de erro generico.
 */
export const MENSAGEM_ATUALIZAR_CARRINHO_PDV = "Atualize o carrinho e tente novamente.";

export function obterConfigPagamento(formaPagamento: FormaPagamentoPdv): ConfigPagamentoPdv {
  const config = mapaConfiguracao.get(formaPagamento);
  if (!config) {
    throw new Error(`Forma de pagamento nao suportada: ${formaPagamento}`);
  }

  return config;
}

export function calcularPercentualTaxa(
  formaPagamento: FormaPagamentoPdv,
  parcelas: number,
  parametros?: ParametrosCalculoPagamentoPdv
): number {
  const taxaDebitoConfig = Number(parametros?.taxaCartaoDebitoPercentual);
  const taxaCreditoMap = parametros?.taxaCartaoCreditoPorParcela;
  const config = obterConfigPagamento(formaPagamento);

  if (formaPagamento === "CARTAO_DEBITO" && Number.isFinite(taxaDebitoConfig) && taxaDebitoConfig >= 0) {
    return Number(taxaDebitoConfig.toFixed(2));
  }

  if (
    (formaPagamento === "CARTAO_CREDITO" ||
      formaPagamento === "CARTAO_CREDITO_AVISTA" ||
      formaPagamento === "CARTAO_CREDITO_PARCELADO") &&
    taxaCreditoMap
  ) {
    const parcela = Math.min(12, Math.max(1, Math.trunc(parcelas)));
    const taxaConfig = Number(taxaCreditoMap[parcela as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12]);
    if (Number.isFinite(taxaConfig) && taxaConfig >= 0) {
      return Number(taxaConfig.toFixed(2));
    }
  }

  if (formaPagamento === "CARTAO_CREDITO_PARCELADO") {
    const parcelasNorm = Math.max(1, parcelas);
    return Number((config.percentualTaxaBase + (parcelasNorm - 1) * 0.45).toFixed(2));
  }

  return config.percentualTaxaBase;
}

export function calcularPagamentoPdv(
  input: EntradaPagamentoPdv,
  parametros?: ParametrosCalculoPagamentoPdv
): ResultadoPagamentoPdv {
  const config = obterConfigPagamento(input.formaPagamento);
  const valorBruto = Math.max(0, Number(input.valorBruto || 0));
  const maxParcelasCredito = Math.min(12, Math.max(1, Math.trunc(Number(parametros?.maxParcelasCartaoCredito ?? 12))));
  const parcelas = config.permiteParcelas
    ? Math.min(maxParcelasCredito, Math.max(1, Math.trunc(Number(input.parcelas || 1))))
    : 1;
  const percentualTaxa = calcularPercentualTaxa(input.formaPagamento, parcelas, parametros);
  const valorBrutoCentavos = paraCentavos(valorBruto);
  const valorTaxaCentavos = Math.round((valorBrutoCentavos * percentualTaxa) / 100);
  const valorLiquidoCentavos = valorBrutoCentavos - valorTaxaCentavos;

  const prazoPadrao =
    input.formaPagamento === "BOLETO"
      ? Math.max(1, Math.trunc(Number(parametros?.prazoPadraoBoletoDias ?? 7)))
      : input.formaPagamento === "CREDIARIO"
        ? Math.max(1, Math.trunc(Number(parametros?.prazoPadraoCrediarioDias ?? 30)))
        : 0;

  const diasVencimento = config.exigePrazo
    ? Math.max(1, Math.trunc(Number(input.diasVencimento || prazoPadrao || 1)))
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
