"use server";

import { Prisma } from "@prisma/client";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

type OrdemServicoCustoItem = { custoPeca?: number | null };
type OrdemServicoCustoRow = { itens?: OrdemServicoCustoItem[] };

type OrdemServicoResumoDelegate = {
  findMany?: (args: unknown) => Promise<OrdemServicoCustoRow[]>;
};

type VendaResumoItem = { custoUnitario?: number | null; quantidade?: number | null; subtotal?: number | null };
type VendaResumoPagamento = { formaPagamento?: string | null; valorBruto?: number | null };
type VendaResumoRow = {
  valorTotal?: number | null;
  formaPagamento?: string | null;
  pagamentos?: VendaResumoPagamento[];
  itens?: VendaResumoItem[];
};

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
  pagamentos?: Array<{ formaPagamento: string; valorBruto: number }>;
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
  const { prisma } = await exigirContextoTenant();

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const fimHoje = new Date();
  fimHoje.setHours(23, 59, 59, 999);

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoResumoDelegate;
    OrdemServico?: OrdemServicoResumoDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  const buscarVendasHoje = async () => {
    const vendasBase = await prisma.venda.findMany({
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
          select: {
            id: true,
            quantidade: true,
            custoUnitario: true,
            subtotal: true,
            descricao: true,
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

    const idsVenda = vendasBase.map((venda) => venda.id);
    if (idsVenda.length === 0) {
      return vendasBase.map((venda) => ({ ...venda, pagamentos: [] as VendaResumoPagamento[] }));
    }

    let pagamentos: Array<{ vendaId: string; formaPagamento: string; valorBruto: number }> = [];
    try {
      pagamentos = await prisma.$queryRaw<Array<{ vendaId: string; formaPagamento: string; valorBruto: number }>>`
        SELECT vp."vendaId" AS "vendaId", vp."formaPagamento"::text AS "formaPagamento", vp."valorBruto" AS "valorBruto"
        FROM "VendaPagamento" vp
        WHERE vp."vendaId" IN (${Prisma.join(idsVenda)})
        ORDER BY vp."criadoEm" ASC
      `;
    } catch {
      pagamentos = [];
    }

    const mapaPagamentos = new Map<string, VendaResumoPagamento[]>();
    for (const pagamento of pagamentos) {
      const listaAtual = mapaPagamentos.get(pagamento.vendaId) ?? [];
      listaAtual.push({
        formaPagamento: pagamento.formaPagamento,
        valorBruto: Number(pagamento.valorBruto ?? 0),
      });
      mapaPagamentos.set(pagamento.vendaId, listaAtual);
    }

    return vendasBase.map((venda) => ({
      ...venda,
      pagamentos: mapaPagamentos.get(venda.id) ?? [],
    }));
  };

  // Busca vendas PDV e peças de OS em paralelo para melhor performance
  const [vendasHoje, osEntreguesHoje] = await Promise.all([
    buscarVendasHoje(),
    // Custo das peças usadas em OS entregues hoje
    ordemServicoDelegate?.findMany
      ? ordemServicoDelegate.findMany({
          where: {
            status: "ENTREGUE",
            excluidaEm: null,
            atualizadoEm: { gte: inicioHoje, lte: fimHoje },
          },
          select: { itens: { select: { custoPeca: true } } },
        })
      : Promise.resolve([]),
  ]);

  const totalVendasCentavos = vendasHoje.reduce(
    (acumulado: number, venda: typeof vendasHoje[number]) => acumulado + paraCentavos(venda.valorTotal),
    0
  );

  // Custo PDV: custoUnitario * quantidade por item de venda
  const custoPdvCentavos = vendasHoje.reduce((acumuladoVendas: number, venda: typeof vendasHoje[number]) => {
    const custoVendaCentavos = venda.itens.reduce((acumuladoItens: number, item: typeof venda.itens[number]) => {
      const custoUnitarioCentavos = paraCentavos(item.custoUnitario);
      return acumuladoItens + custoUnitarioCentavos * item.quantidade;
    }, 0);

    return acumuladoVendas + custoVendaCentavos;
  }, 0);

  // Custo OS: soma de custoPeca de cada ItemOS das OS entregues hoje
  const custoOsCentavos = osEntreguesHoje.reduce((accOs: number, os: OrdemServicoCustoRow) => {
    return accOs + (os.itens ?? []).reduce(
      (accItens: number, item: OrdemServicoCustoItem) => accItens + paraCentavos(Number(item.custoPeca ?? 0)),
      0
    );
  }, 0);

  const custoTotalCentavos = custoPdvCentavos + custoOsCentavos;

  const lucroBrutoCentavos = totalVendasCentavos - custoTotalCentavos;

  const vendas: VendaResumoDiario[] = vendasHoje.map((venda) => ({
    id: venda.id,
    criadoEm: venda.criadoEm,
    valorTotal: venda.valorTotal,
    formaPagamento: venda.formaPagamento || "NAO_INFORMADO",
    pagamentos: (venda.pagamentos ?? []).map((pagamento) => ({
      formaPagamento: pagamento.formaPagamento || "NAO_INFORMADO",
      valorBruto: Number(pagamento.valorBruto ?? 0),
    })),
    nomeCliente: venda.cliente?.nomeRazaoSocial ?? null,
    itens: venda.itens.map((item) => ({
      id: item.id,
      quantidade: item.quantidade,
      custoUnitario: item.custoUnitario,
      subtotal: item.subtotal,
      nomeProduto: item.descricao || item.produto?.nome || "Item sem descricao",
    })),
  }));

  const mapaTotaisPorForma = new Map<string, number>();

  for (const venda of vendasHoje) {
    if ((venda.pagamentos?.length ?? 0) > 0) {
      for (const pagamento of venda.pagamentos ?? []) {
        const formaPagamento = pagamento.formaPagamento || "NAO_INFORMADO";
        const acumuladoAtual = mapaTotaisPorForma.get(formaPagamento) ?? 0;
        mapaTotaisPorForma.set(
          formaPagamento,
          acumuladoAtual + paraCentavos(Number(pagamento.valorBruto ?? 0))
        );
      }
      continue;
    }

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

// ── Histórico de Fechamentos ──────────────────────────────────────────────────

export interface ItemHistoricoFechamento {
  id: string;
  /** Data de fechamento da sessão (usada como chave do dia). */
  dataFechamento: Date;
  /** Valor informado pelo operador no momento do fechamento. */
  valorFechamento: number;
  /** Total de vendas vinculadas a esta sessão. */
  totalVendas: number;
  /** Diferença entre valor informado e esperado (positivo = sobra, negativo = falta). */
  diferenca: number;
}

/**
 * Retorna as sessões de caixa fechadas de forma paginada, ordenadas da mais recente
 * para a mais antiga. Usado para popular o histórico de fechamentos.
 */
export async function obterHistoricoFechamentos(
  page: number = 1,
  limit: number = 15
): Promise<{ data: ItemHistoricoFechamento[]; total: number; page: number; totalPages: number }> {
  const { prisma } = await exigirContextoTenant();
  const offset = (page - 1) * limit;

  // Total de sessões fechadas (para calcular totalPages)
  const totalRaw = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM "CaixaSession"
    WHERE status::text = 'FECHADO'
      AND "dataFechamento" IS NOT NULL
  `;
  const total = Number(totalRaw[0]?.count ?? 0);

  const linhas = await prisma.$queryRaw<
    Array<{
      id: string;
      dataFechamento: Date;
      valorAbertura: number;
      valorFechamento: number;
      totalVendasSessao: number;
    }>
  >`
    SELECT
      c.id,
      c."dataFechamento",
      c."valorAbertura",
      COALESCE(c."valorFechamento", 0) AS "valorFechamento",
      COALESCE(SUM(v."valorTotal"), 0) AS "totalVendasSessao"
    FROM "CaixaSession" c
    LEFT JOIN "Venda" v ON v."caixaSessionId" = c.id
    WHERE c.status::text = 'FECHADO'
      AND c."dataFechamento" IS NOT NULL
    GROUP BY c.id, c."dataFechamento", c."valorAbertura", c."valorFechamento"
    ORDER BY c."dataFechamento" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const data = linhas.map((row) => {
    const valorAberturaCentavos = paraCentavos(Number(row.valorAbertura ?? 0));
    const totalVendasCentavos = paraCentavos(Number(row.totalVendasSessao ?? 0));
    const valorFechamentoCentavos = paraCentavos(Number(row.valorFechamento ?? 0));
    const valorEsperadoCentavos = valorAberturaCentavos + totalVendasCentavos;

    return {
      id: String(row.id),
      dataFechamento: new Date(row.dataFechamento),
      valorFechamento: paraMoeda(valorFechamentoCentavos),
      totalVendas: paraMoeda(totalVendasCentavos),
      diferenca: paraMoeda(valorFechamentoCentavos - valorEsperadoCentavos),
    };
  });

  return {
    data,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ── Relatório detalhado de uma data específica ────────────────────────────────

export interface ResumoDataEspecifica {
  totalVendas: number;
  custoTotal: number;
  lucroBruto: number;
  totaisPorFormaPagamento: TotalPorFormaPagamentoDiario[];
}

/**
 * Reproduz o resumo financeiro consolidado para uma data específica.
 * Calcula vendas PDV e custo de peças de OS entregues naquele dia.
 */
export async function obterResumoDataEspecifica(
  data: Date
): Promise<ResumoDataEspecifica> {
  const { prisma } = await exigirContextoTenant();

  const inicioData = new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0);
  const fimData = new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59, 999);

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoResumoDelegate;
    OrdemServico?: OrdemServicoResumoDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  const buscarVendasData = async () => {
    const vendasBase = await prisma.venda.findMany({
      where: { criadoEm: { gte: inicioData, lte: fimData } },
      select: {
        id: true,
        valorTotal: true,
        formaPagamento: true,
        itens: { select: { custoUnitario: true, quantidade: true, subtotal: true } },
      },
    });

    const idsVenda = vendasBase.map((venda) => venda.id);
    if (idsVenda.length === 0) {
      return vendasBase.map((venda) => ({ ...venda, pagamentos: [] as VendaResumoPagamento[] }));
    }

    let pagamentos: Array<{ vendaId: string; formaPagamento: string; valorBruto: number }> = [];
    try {
      pagamentos = await prisma.$queryRaw<Array<{ vendaId: string; formaPagamento: string; valorBruto: number }>>`
        SELECT vp."vendaId" AS "vendaId", vp."formaPagamento"::text AS "formaPagamento", vp."valorBruto" AS "valorBruto"
        FROM "VendaPagamento" vp
        WHERE vp."vendaId" IN (${Prisma.join(idsVenda)})
        ORDER BY vp."criadoEm" ASC
      `;
    } catch {
      pagamentos = [];
    }

    const mapaPagamentos = new Map<string, VendaResumoPagamento[]>();
    for (const pagamento of pagamentos) {
      const listaAtual = mapaPagamentos.get(pagamento.vendaId) ?? [];
      listaAtual.push({
        formaPagamento: pagamento.formaPagamento,
        valorBruto: Number(pagamento.valorBruto ?? 0),
      });
      mapaPagamentos.set(pagamento.vendaId, listaAtual);
    }

    return vendasBase.map((venda) => ({
      ...venda,
      pagamentos: mapaPagamentos.get(venda.id) ?? [],
    }));
  };

  const [vendasData, osEntreguesData] = await Promise.all([
    buscarVendasData(),
    ordemServicoDelegate?.findMany
      ? ordemServicoDelegate.findMany({
          where: { status: "ENTREGUE", excluidaEm: null, atualizadoEm: { gte: inicioData, lte: fimData } },
          select: { itens: { select: { custoPeca: true } } },
        })
      : Promise.resolve([]),
  ]);

  const totalVendasCentavos = vendasData.reduce((acc: number, v: VendaResumoRow) => {
    return acc + paraCentavos(Number(v.valorTotal ?? 0));
  }, 0);

  const custoPdvCentavos = vendasData.reduce((accV: number, v: VendaResumoRow) => {
    return accV + (v.itens ?? []).reduce(
      (accI: number, item: VendaResumoItem) =>
        accI + paraCentavos(Number(item.custoUnitario ?? 0)) * Number(item.quantidade ?? 1),
      0
    );
  }, 0);

  const custoOsCentavos = osEntreguesData.reduce((accOs: number, os: OrdemServicoCustoRow) => {
    return accOs + (os.itens ?? []).reduce(
      (accI: number, item: OrdemServicoCustoItem) => accI + paraCentavos(Number(item.custoPeca ?? 0)),
      0
    );
  }, 0);

  const custoTotalCentavos = custoPdvCentavos + custoOsCentavos;

  // Agrupa por forma de pagamento
  const mapaFormas: Record<string, number> = {};
  vendasData.forEach((v: VendaResumoRow) => {
    if ((v.pagamentos?.length ?? 0) > 0) {
      v.pagamentos?.forEach((pagamento) => {
        const forma = String(pagamento.formaPagamento ?? "OUTROS");
        mapaFormas[forma] = (mapaFormas[forma] ?? 0) + paraCentavos(Number(pagamento.valorBruto ?? 0));
      });
      return;
    }

    const forma = String(v.formaPagamento ?? "OUTROS");
    mapaFormas[forma] = (mapaFormas[forma] ?? 0) + paraCentavos(Number(v.valorTotal ?? 0));
  });

  const totaisPorFormaPagamento: TotalPorFormaPagamentoDiario[] = Object.entries(mapaFormas)
    .map(([formaPagamento, centavos]) => ({
      formaPagamento,
      total: paraMoeda(centavos),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalVendas: paraMoeda(totalVendasCentavos),
    custoTotal: paraMoeda(custoTotalCentavos),
    lucroBruto: paraMoeda(totalVendasCentavos - custoTotalCentavos),
    totaisPorFormaPagamento,
  };
}

