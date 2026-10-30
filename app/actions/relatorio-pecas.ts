"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { deDecimal, somar, subtrair } from "@/lib/dinheiro";
import { fimDoDia, inicioDoDia, inicioDoMes } from "@/lib/datas";

/**
 * Relatório de peças usadas nas OS, por tipo e marca.
 *
 * É o motivo de o cadastro de marcas existir. Peça de conserto não é item de
 * estoque neste negócio — é comprada por serviço, sem entrada por nota —, então
 * não há saldo nem movimentação para relatar: o que existe é o custo lançado na
 * OS e o valor cobrado do cliente. Cruzar `tipoPeca` (enum) com a marca
 * cadastrada é o que transforma isso numa pergunta respondível ("quanto gastei
 * em tela da marca X, e quanto sobrou").
 *
 * Toda soma acontece aqui, no servidor, em CENTAVOS INTEIROS. Isso não é
 * preciosismo: `Decimal` do Prisma chega ao cliente como string, e somar string
 * com `+` concatena em vez de somar — "110" + "10" vira "11010". O cliente
 * recebe número pronto e só formata.
 */

export type LinhaRelatorioPecas = {
  tipoPeca: string;
  /** `null` nos itens lançados antes de o cadastro de marcas existir. */
  marcaNome: string | null;
  quantidade: number;
  /** Em centavos inteiros. */
  custoTotalCentavos: number;
  cobradoTotalCentavos: number;
  margemCentavos: number;
  /** `null` quando o valor cobrado é zero — margem percentual não existiria. */
  margemPercentual: number | null;
};

export type RelatorioPecas = {
  inicio: string;
  fim: string;
  linhas: LinhaRelatorioPecas[];
  totais: {
    quantidade: number;
    custoTotalCentavos: number;
    cobradoTotalCentavos: number;
    margemCentavos: number;
    margemPercentual: number | null;
  };
  /** Itens sem marca no período — o que ainda falta completar no histórico. */
  itensSemMarca: number;
};

function calcularMargemPercentual(margemCentavos: number, cobradoCentavos: number): number | null {
  if (cobradoCentavos === 0) return null;
  // Percentual sobre o valor cobrado (margem de contribuição), não sobre o
  // custo: é o número que responde "quanto deste serviço sobrou pra loja".
  return Math.round((margemCentavos / cobradoCentavos) * 10000) / 100;
}

export async function obterRelatorioPecas(
  inicioIso?: string,
  fimIso?: string
): Promise<RelatorioPecas> {
  const contexto = await exigirContextoTenant();
  // Custo e margem de peça são dado sensível: mesma permissão que esconde a
  // coluna de custo no detalhe da OS (F-41).
  exigirPermissao(contexto, "os.ver_custos");

  const fuso = contexto.fusoHorario;
  const inicio = inicioIso ? inicioDoDia(new Date(inicioIso), fuso) : inicioDoMes(new Date(), fuso);
  const fim = fimIso ? fimDoDia(new Date(fimIso), fuso) : fimDoDia(new Date(), fuso);

  const itens = await contexto.prisma.itemOS.findMany({
    where: {
      criadoEm: { gte: inicio, lte: fim },
      // OS excluída (soft delete) não entra em relatório de custo: o serviço
      // não aconteceu.
      ordemServico: { excluidaEm: null },
    },
    select: {
      tipoPeca: true,
      custoPeca: true,
      valorCobrado: true,
      marcaPeca: { select: { nome: true } },
    },
  });

  const agrupado = new Map<string, LinhaRelatorioPecas>();
  let itensSemMarca = 0;

  for (const item of itens) {
    const marcaNome = item.marcaPeca?.nome ?? null;
    if (marcaNome === null) itensSemMarca += 1;

    const chave = `${item.tipoPeca}\u0000${marcaNome ?? ""}`;
    const linha = agrupado.get(chave) ?? {
      tipoPeca: String(item.tipoPeca),
      marcaNome,
      quantidade: 0,
      custoTotalCentavos: 0,
      cobradoTotalCentavos: 0,
      margemCentavos: 0,
      margemPercentual: null,
    };

    linha.quantidade += 1;
    linha.custoTotalCentavos = somar(linha.custoTotalCentavos, deDecimal(item.custoPeca));
    linha.cobradoTotalCentavos = somar(linha.cobradoTotalCentavos, deDecimal(item.valorCobrado));

    agrupado.set(chave, linha);
  }

  const linhas = [...agrupado.values()].map((linha) => {
    const margemCentavos = subtrair(linha.cobradoTotalCentavos, linha.custoTotalCentavos);

    return {
      ...linha,
      margemCentavos,
      margemPercentual: calcularMargemPercentual(margemCentavos, linha.cobradoTotalCentavos),
    };
  });

  // Maior gasto primeiro: é a ordem em que a pergunta costuma ser feita.
  linhas.sort((a, b) => b.custoTotalCentavos - a.custoTotalCentavos);

  const custoTotalCentavos = somar(...linhas.map((linha) => linha.custoTotalCentavos));
  const cobradoTotalCentavos = somar(...linhas.map((linha) => linha.cobradoTotalCentavos));
  const margemCentavos = subtrair(cobradoTotalCentavos, custoTotalCentavos);

  return {
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    linhas,
    totais: {
      quantidade: linhas.reduce((total, linha) => total + linha.quantidade, 0),
      custoTotalCentavos,
      cobradoTotalCentavos,
      margemCentavos,
      margemPercentual: calcularMargemPercentual(margemCentavos, cobradoTotalCentavos),
    },
    itensSemMarca,
  };
}
