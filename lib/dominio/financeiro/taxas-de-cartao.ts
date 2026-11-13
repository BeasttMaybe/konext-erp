import { deDecimal, paraMoeda, somar } from "@/lib/dinheiro";

/**
 * Taxas de cartao (maquininha) — quanto a loja deixou com a operadora.
 *
 * A taxa ja era calculada e gravada em cada pagamento de venda
 * (VendaPagamento.valorTaxa, pela tabela de taxas das Configuracoes), mas so
 * aparecia no "quanto sobrou por OS". Entradas contam o valor BRUTO da venda
 * e saidas so contavam despesas pagas: o resultado do mes saia maior do que o
 * dinheiro que de fato entrou. Agora a taxa entra como SAIDA no resultado e no
 * fluxo, e tem relatorio proprio.
 *
 * Data da taxa = data da venda (e quando a operadora desconta). Venda
 * estornada nao conta.
 */

export type LinhaDeTaxa = { forma: string; parcelas: number; bruto: unknown; taxa: unknown; quantidade: number };

export type GrupoDeTaxa = { rotulo: string; bruto: number; taxa: number; percentual: number; quantidade: number };

export type RelatorioDeTaxas = {
  totalTaxa: number;
  totalBrutoNoCartao: number;
  percentualMedio: number;
  quantidade: number;
  grupos: GrupoDeTaxa[];
};

export function rotuloDaForma(forma: string, parcelas: number): string {
  switch (forma) {
    case "CARTAO_DEBITO":
      return "Débito";
    case "CARTAO_CREDITO_AVISTA":
      return "Crédito à vista";
    case "CARTAO_CREDITO":
    case "CARTAO_CREDITO_PARCELADO":
      return parcelas > 1 ? `Crédito ${parcelas}x` : "Crédito à vista";
    case "PIX":
      return "PIX";
    default:
      return forma.charAt(0) + forma.slice(1).toLowerCase().replace(/_/g, " ");
  }
}

/** Ordem: debito, credito a vista, credito 2x..12x, resto. */
function pesoDoRotulo(rotulo: string): number {
  if (rotulo === "Débito") return 0;
  if (rotulo === "Crédito à vista") return 1;
  const parcelado = rotulo.match(/^Crédito (\d+)x$/);
  if (parcelado) return 1 + Number(parcelado[1]);
  return 100;
}

const percentual = (taxa: number, bruto: number) => (bruto > 0 ? Math.round((taxa / bruto) * 10000) / 100 : 0);

export function montarRelatorioDeTaxas(linhas: ReadonlyArray<LinhaDeTaxa>): RelatorioDeTaxas {
  const porRotulo = new Map<string, { bruto: number; taxa: number; quantidade: number }>();
  for (const linha of linhas) {
    const rotulo = rotuloDaForma(linha.forma, Number(linha.parcelas) || 1);
    const atual = porRotulo.get(rotulo) ?? { bruto: 0, taxa: 0, quantidade: 0 };
    porRotulo.set(rotulo, {
      bruto: somar(atual.bruto, deDecimal(linha.bruto as number)),
      taxa: somar(atual.taxa, deDecimal(linha.taxa as number)),
      quantidade: atual.quantidade + Number(linha.quantidade),
    });
  }
  const grupos = [...porRotulo.entries()]
    .sort(([a], [b]) => pesoDoRotulo(a) - pesoDoRotulo(b) || a.localeCompare(b))
    .map(([rotulo, g]) => ({
      rotulo,
      bruto: paraMoeda(g.bruto),
      taxa: paraMoeda(g.taxa),
      percentual: percentual(g.taxa, g.bruto),
      quantidade: g.quantidade,
    }));
  const taxaCentavos = somar(...[...porRotulo.values()].map((g) => g.taxa));
  const brutoCentavos = somar(...[...porRotulo.values()].map((g) => g.bruto));
  return {
    totalTaxa: paraMoeda(taxaCentavos),
    totalBrutoNoCartao: paraMoeda(brutoCentavos),
    percentualMedio: percentual(taxaCentavos, brutoCentavos),
    quantidade: grupos.reduce((t, g) => t + g.quantidade, 0),
    grupos,
  };
}
