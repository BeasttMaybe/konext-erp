import { Barcode, Banknote, CreditCard, HandCoins, QrCode } from "lucide-react";
import { deDecimal, dividirEmParcelas, formatarReais } from "@/lib/dinheiro";
import type { FormaPagamentoPdv, ParametrosCalculoPagamentoPdv } from "@/lib/pdv/pagamentos";
import type { ConfiguracaoPdvPagamentos } from "@/lib/configuracoes-pdv";

/**
 * Funções puras de formatação/rótulo/ícone do fluxo de pagamento do PDV,
 * extraídas de components/pdv/modal-pagamento.tsx (Fase PDV 3 etapas) pra
 * poderem ser compartilhadas entre o hook de estado
 * (lib/pdv/hooks/usar-pagamento-pdv.ts) e o componente de apresentação da
 * Etapa 3 (components/pdv/balcao/etapa-pagamento-pdv.tsx) sem duplicação.
 * Nenhuma lógica de cálculo/validação de venda mudou — só o formato de
 * onde essas funções moram.
 */

export const formatarMoeda = (valor: number): string => formatarReais(deDecimal(valor));

export const formatarDecimalPtBr = (valor: number): string => valor.toFixed(2).replace(".", ",");

export const sanitizarEntradaMonetaria = (valor: string): string => {
  const apenasPermitidos = valor.replace(/[^\d,\.]/g, "");
  const valorComVirgula = apenasPermitidos.replace(/\./g, ",");
  const [parteInteira, ...decimais] = valorComVirgula.split(",");
  if (decimais.length === 0) return parteInteira;
  return `${parteInteira},${decimais.join("").slice(0, 2)}`;
};

export const parseEntradaMonetaria = (valor: string): number => {
  if (!valor.trim()) return 0;
  const normalizado = valor.replace(/\./g, "").replace(",", ".").trim();
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
};

export const normalizarFormaPagamentoPdv = (formaPagamento: FormaPagamentoPdv): FormaPagamentoPdv => {
  if (formaPagamento === "CARTAO_CREDITO_AVISTA" || formaPagamento === "CARTAO_CREDITO_PARCELADO") {
    return "CARTAO_CREDITO";
  }

  return formaPagamento;
};

export function rotuloFormaPagamentoCurto(forma: FormaPagamentoPdv): string {
  if (forma === "PIX") return "PIX";
  if (forma === "DINHEIRO") return "Dinheiro";
  if (forma === "CARTAO_DEBITO") return "Cartão de Débito";
  if (forma === "CARTAO_CREDITO") return "Cartão de Crédito";
  if (forma === "BOLETO") return "Boleto";
  if (forma === "CREDIARIO") return "Crediário";
  return forma;
}

interface PropsIconeFormaPagamentoPdv {
  forma: FormaPagamentoPdv;
  className?: string;
}

/**
 * Componente (não uma função que RETORNA um componente) de propósito: a
 * regra `react-hooks/static-components` do lint deste projeto (Next.js 16)
 * proíbe resolver um componente dinamicamente dentro do render de outro
 * componente (`const Icone = resolver(...)`, depois `<Icone />`) — o ícone
 * perderia identidade estável a cada render. Um componente declarado uma
 * vez aqui, no escopo do módulo, e usado como `<IconeFormaPagamentoPdv
 * forma={...} />` não tem esse problema.
 */
export function IconeFormaPagamentoPdv({ forma, className }: PropsIconeFormaPagamentoPdv) {
  if (forma === "PIX") return <QrCode className={className} aria-hidden="true" />;
  if (forma === "DINHEIRO") return <Banknote className={className} aria-hidden="true" />;
  if (forma === "CARTAO_DEBITO") return <CreditCard className={className} aria-hidden="true" />;
  if (forma === "CARTAO_CREDITO") return <CreditCard className={className} aria-hidden="true" />;
  if (forma === "BOLETO") return <Barcode className={className} aria-hidden="true" />;
  if (forma === "CREDIARIO") return <HandCoins className={className} aria-hidden="true" />;
  return <CreditCard className={className} aria-hidden="true" />;
}

// Rotulo de parcelamento SEMPRE via dividirEmParcelas (lib/dinheiro.ts) —
// nunca "valorBruto / parcelas" direto (ponto flutuante: p.ex. R$109,90 em
// 3x vira "36,63 x 3 = R$109,89", um centavo a menos que o total real).
// Quando o resto em centavos cai nas primeiras parcelas (convencao do
// projeto) e elas ficam diferentes das demais, o rotulo precisa dizer isso
// explicitamente em vez de generalizar "3x de R$36,64" escondendo que só a
// primeira é diferente.
export function formatarRotuloParcelas(valorBruto: number, parcelas: number): string {
  const quantidadeParcelas = Math.max(1, Math.trunc(parcelas));

  if (quantidadeParcelas <= 1) {
    return formatarReais(deDecimal(valorBruto));
  }

  const partesCentavos = dividirEmParcelas(deDecimal(valorBruto), quantidadeParcelas);
  const valorMaior = partesCentavos[0];
  const valorMenor = partesCentavos[partesCentavos.length - 1];

  if (valorMaior === valorMenor) {
    return `${quantidadeParcelas}x de ${formatarReais(valorMaior)}`;
  }

  const quantidadeMaior = partesCentavos.filter((valor) => valor === valorMaior).length;
  const quantidadeMenor = quantidadeParcelas - quantidadeMaior;
  const rotuloMaior = quantidadeMaior === 1 ? "1ª" : `${quantidadeMaior}x`;

  return `${quantidadeParcelas}x — ${rotuloMaior} de ${formatarReais(valorMaior)} e ${quantidadeMenor}x de ${formatarReais(valorMenor)}`;
}

// Detalhe da forma (taxa configurada + quando o dinheiro chega) pras
// "Formas rápidas". Taxa vem da configuração real do tenant
// (parametrosCalculo), não do percentualTaxaBase estático de
// CONFIG_PAGAMENTOS_PDV. Prazo de cartão não existe como dado hoje (só
// boleto/crediário têm diasVencimento) — por isso o texto pra cartão é
// sobre onde o dinheiro cai, não "em N dias", pra não inventar um prazo que
// o sistema não rastreia.
export function detalheFormaRapida(
  forma: FormaPagamentoPdv,
  parametrosCalculo: Required<Pick<ParametrosCalculoPagamentoPdv, "taxaCartaoDebitoPercentual" | "taxaCartaoCreditoPorParcela">>,
  configuracaoAtiva: ConfiguracaoPdvPagamentos
): string {
  if (forma === "PIX") return "Sem taxa · cai na hora";
  if (forma === "DINHEIRO") return "Sem taxa · na gaveta";
  if (forma === "CARTAO_DEBITO") return `Taxa ${parametrosCalculo.taxaCartaoDebitoPercentual.toFixed(2)}% · direto na conta`;
  if (forma === "CARTAO_CREDITO") {
    const taxa1x = parametrosCalculo.taxaCartaoCreditoPorParcela[1] ?? 0;
    return `Taxa a partir de ${taxa1x.toFixed(2)}% · prazo da adquirente`;
  }
  if (forma === "BOLETO") return `Sem taxa · vence em ${configuracaoAtiva.prazoPadraoBoletoDias} dias`;
  if (forma === "CREDIARIO") return `Sem taxa · vence em ${configuracaoAtiva.prazoPadraoCrediarioDias} dias`;
  return "";
}

export const MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO =
  "Selecione um cliente para continuar: vendas com boleto ou crediário geram uma conta a receber, e não é possível cobrar do Consumidor Final.";
