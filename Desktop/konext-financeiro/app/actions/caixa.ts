"use server";

import { prisma } from "@/lib/prisma";

export interface ItemVendaResumoDiario {
  id: string;
  quantidade: number;
  custoUnitario: number;
  subtotal: number;
  nomeProduto: string;
}

export interface VendaResumoDiario {
  id: string;
  criadoEm: Date;
  valorTotal: number;
  formaPagamento: string;
  nomeCliente: string | null;
  itens: ItemVendaResumoDiario[];
}

export interface TotalPorFormaPagamentoDiario {
  formaPagamento: string;
  total: number;
}

export interface ResumoCaixaDiario {
  totalVendas: number;
  custoTotal: number;
  lucroBruto: number;
  totaisPorFormaPagamento: TotalPorFormaPagamentoDiario[];
  vendas: VendaResumoDiario[];
  sessoesFechadasHoje: SessaoFechadaResumoDiario[];
}

export interface SessaoFechadaResumoDiario {
  id: string;
  dataAbertura: Date;
  dataFechamento: Date;
  valorAbertura: number;
  valorFechamento: number;
  totalVendasSessao: number;
  valorEsperadoFechamento: number;
  diferencaFechamento: number;
}

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

export async function obterResumoCaixaDiario(): Promise<ResumoCaixaDiario> {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const fimHoje = new Date();
  fimHoje.setHours(23, 59, 59, 999);

  const vendasHoje = await prisma.venda.findMany({
    where: {
      criadoEm: {
        gte: inicioHoje,
        lte: fimHoje,
      },
    },
    include: {
      cliente: {
        select: {
          nomeRazaoSocial: true,
        },
      },
      itens: {
        include: {
          produto: {
            select: {
              nome: true,
            },
          },
        },
      },
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  const totalVendasCentavos = vendasHoje.reduce(
    (acumulado, venda) => acumulado + paraCentavos(venda.valorTotal),
    0
  );

  const custoTotalCentavos = vendasHoje.reduce((acumuladoVendas, venda) => {
    const custoVendaCentavos = venda.itens.reduce((acumuladoItens, item) => {
      const custoUnitarioCentavos = paraCentavos(item.custoUnitario);
      return acumuladoItens + custoUnitarioCentavos * item.quantidade;
    }, 0);

    return acumuladoVendas + custoVendaCentavos;
  }, 0);

  const lucroBrutoCentavos = totalVendasCentavos - custoTotalCentavos;

  const vendas: VendaResumoDiario[] = vendasHoje.map((venda) => ({
    id: venda.id,
    criadoEm: venda.criadoEm,
    valorTotal: venda.valorTotal,
    formaPagamento: venda.formaPagamento || "NAO_INFORMADO",
    nomeCliente: venda.cliente?.nomeRazaoSocial ?? null,
    itens: venda.itens.map((item) => ({
      id: item.id,
      quantidade: item.quantidade,
      custoUnitario: item.custoUnitario,
      subtotal: item.subtotal,
      nomeProduto: item.produto.nome,
    })),
  }));

  const mapaTotaisPorForma = new Map<string, number>();

  for (const venda of vendasHoje) {
    const formaPagamento = venda.formaPagamento || "NAO_INFORMADO";
    const acumuladoAtual = mapaTotaisPorForma.get(formaPagamento) ?? 0;
    mapaTotaisPorForma.set(formaPagamento, acumuladoAtual + paraCentavos(venda.valorTotal));
  }

  const totaisPorFormaPagamento: TotalPorFormaPagamentoDiario[] = Array.from(
    mapaTotaisPorForma.entries()
  ).map(([formaPagamento, totalCentavos]) => ({
    formaPagamento,
    total: paraMoeda(totalCentavos),
  }));

  const sessoesFechadasRaw = await prisma.$queryRaw<
    Array<{
      id: string;
      dataAbertura: Date;
      dataFechamento: Date;
      valorAbertura: number;
      valorFechamento: number;
      totalVendasSessao: number;
    }>
  >`
    SELECT
      c.id,
      c."dataAbertura",
      c."dataFechamento",
      c."valorAbertura",
      COALESCE(c."valorFechamento", 0) AS "valorFechamento",
      COALESCE(SUM(v."valorTotal"), 0) AS "totalVendasSessao"
    FROM "CaixaSession" c
    LEFT JOIN "Venda" v ON v."caixaSessionId" = c.id
    WHERE c.status::text = 'FECHADO'
      AND c."dataFechamento" >= ${inicioHoje}
      AND c."dataFechamento" <= ${fimHoje}
    GROUP BY c.id, c."dataAbertura", c."dataFechamento", c."valorAbertura", c."valorFechamento"
    ORDER BY c."dataFechamento" DESC
  `;

  const sessoesFechadasHoje: SessaoFechadaResumoDiario[] = sessoesFechadasRaw.map((sessao) => {
    const valorAberturaCentavos = paraCentavos(Number(sessao.valorAbertura ?? 0));
    const totalVendasSessaoCentavos = paraCentavos(Number(sessao.totalVendasSessao ?? 0));
    const valorFechamentoCentavos = paraCentavos(Number(sessao.valorFechamento ?? 0));
    const valorEsperadoCentavos = valorAberturaCentavos + totalVendasSessaoCentavos;

    return {
      id: String(sessao.id),
      dataAbertura: new Date(sessao.dataAbertura),
      dataFechamento: new Date(sessao.dataFechamento),
      valorAbertura: paraMoeda(valorAberturaCentavos),
      valorFechamento: paraMoeda(valorFechamentoCentavos),
      totalVendasSessao: paraMoeda(totalVendasSessaoCentavos),
      valorEsperadoFechamento: paraMoeda(valorEsperadoCentavos),
      diferencaFechamento: paraMoeda(valorFechamentoCentavos - valorEsperadoCentavos),
    };
  });

  return {
    totalVendas: paraMoeda(totalVendasCentavos),
    custoTotal: paraMoeda(custoTotalCentavos),
    lucroBruto: paraMoeda(lucroBrutoCentavos),
    totaisPorFormaPagamento,
    vendas,
    sessoesFechadasHoje,
  };
}
