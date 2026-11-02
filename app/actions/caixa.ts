"use server";

import { Prisma } from "@prisma/client";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { escopoCaixaSession } from "@/lib/auth/escopos";
import { fimDoDia, inicioDoDia } from "@/lib/datas";
import { deDecimal, type EntradaDecimal, paraMoeda, somar, subtrair } from "@/lib/dinheiro";
import { calcularEsperadoFechamento } from "@/lib/dominio/financeiro/estorno";

type OrdemServicoCustoItem = { custoPeca?: EntradaDecimal | null };
type OrdemServicoCustoRow = { itens?: OrdemServicoCustoItem[] };

type OrdemServicoResumoDelegate = {
  findMany?: (args: unknown) => Promise<OrdemServicoCustoRow[]>;
};

type VendaResumoItem = { custoUnitario?: EntradaDecimal | null; quantidade?: number | null; subtotal?: EntradaDecimal | null };
type VendaResumoPagamento = { formaPagamento?: string | null; valorBruto?: EntradaDecimal | null };
type VendaResumoRow = {
  id: string;
  valorTotal?: EntradaDecimal | null;
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

export async function obterResumoCaixaDiario(): Promise<ResumoCaixaDiario> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "pdv.vender");
  const { prisma } = contexto;

  const inicioHoje = inicioDoDia(new Date(), contexto.fusoHorario);
  const fimHoje = fimDoDia(new Date(), contexto.fusoHorario);

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoResumoDelegate;
    OrdemServico?: OrdemServicoResumoDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  const buscarVendasHoje = async () => {
    const vendasBase = await prisma.venda.findMany({
      where: {
        // Fase 2A-3: venda estornada nao e venda. Sai do total do dia, da
        // lista e dos totais por forma de pagamento. O dinheiro que sai da
        // gaveta por causa do estorno aparece por `estornoCaixaSessionId`.
        estornadaEm: null,
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

    let pagamentos: Array<{ vendaId: string; formaPagamento: string; valorBruto: EntradaDecimal }> = [];
    try {
      pagamentos = await prisma.$queryRaw<
        Array<{ vendaId: string; formaPagamento: string; valorBruto: EntradaDecimal }>
      >`
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
        valorBruto: pagamento.valorBruto ?? 0,
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

  const totalVendasCentavos = somar(
    ...vendasHoje.map((venda: typeof vendasHoje[number]) => deDecimal(venda.valorTotal))
  );

  // Custo PDV: custoUnitario * quantidade por item de venda
  const custoPdvCentavos = somar(
    ...vendasHoje.map((venda: typeof vendasHoje[number]) =>
      somar(
        ...venda.itens.map((item: typeof venda.itens[number]) => deDecimal(item.custoUnitario) * item.quantidade)
      )
    )
  );

  // Custo OS: soma de custoPeca de cada ItemOS das OS entregues hoje
  const custoOsCentavos = somar(
    ...osEntreguesHoje.map((os: OrdemServicoCustoRow) =>
      somar(...(os.itens ?? []).map((item: OrdemServicoCustoItem) => deDecimal(item.custoPeca ?? 0)))
    )
  );

  const custoTotalCentavos = somar(custoPdvCentavos, custoOsCentavos);

  const lucroBrutoCentavos = subtrair(totalVendasCentavos, custoTotalCentavos);

  const vendas: VendaResumoDiario[] = vendasHoje.map((venda) => ({
    id: venda.id,
    criadoEm: venda.criadoEm,
    valorTotal: paraMoeda(deDecimal(venda.valorTotal)),
    formaPagamento: venda.formaPagamento || "NAO_INFORMADO",
    pagamentos: (venda.pagamentos ?? []).map((pagamento) => ({
      formaPagamento: pagamento.formaPagamento || "NAO_INFORMADO",
      valorBruto: paraMoeda(deDecimal(pagamento.valorBruto ?? 0)),
    })),
    nomeCliente: venda.cliente?.nomeRazaoSocial ?? null,
    itens: venda.itens.map((item) => ({
      id: item.id,
      quantidade: item.quantidade,
      custoUnitario: paraMoeda(deDecimal(item.custoUnitario)),
      subtotal: paraMoeda(deDecimal(item.subtotal)),
      nomeProduto: item.descricao || item.produto?.nome || "Item sem descricao",
    })),
  }));

  const mapaTotaisPorForma = new Map<string, number>();

  for (const venda of vendasHoje) {
    if ((venda.pagamentos?.length ?? 0) > 0) {
      for (const pagamento of venda.pagamentos ?? []) {
        const formaPagamento = pagamento.formaPagamento || "NAO_INFORMADO";
        const acumuladoAtual = mapaTotaisPorForma.get(formaPagamento) ?? 0;
        mapaTotaisPorForma.set(formaPagamento, somar(acumuladoAtual, deDecimal(pagamento.valorBruto ?? 0)));
      }
      continue;
    }

    const formaPagamento = venda.formaPagamento || "NAO_INFORMADO";
    const acumuladoAtual = mapaTotaisPorForma.get(formaPagamento) ?? 0;
    mapaTotaisPorForma.set(formaPagamento, somar(acumuladoAtual, deDecimal(venda.valorTotal)));
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
      valorAbertura: EntradaDecimal;
      valorFechamento: EntradaDecimal;
      totalVendasSessao: EntradaDecimal;
      totalEstornosAbsorvidos: EntradaDecimal;
    }>
  >`
    SELECT
      c.id,
      c."dataAbertura",
      c."dataFechamento",
      c."valorAbertura",
      COALESCE(c."valorFechamento", 0) AS "valorFechamento",
      -- Fase 2A-3 (regra de estorno). A venda NUNCA sai da sessao dela: este
      -- esperado e recalculado ao vivo, e mexer na venda mudaria, dias
      -- depois, a diferenca de fechamento que alguem ja conferiu e assinou.
      -- O estorno e um movimento separado, somado na sessao que o ABSORVEU
      -- ("estornoCaixaSessionId"), que e de onde o dinheiro sai da gaveta.
      -- Subquery em vez de mais um LEFT JOIN de proposito: dois joins um-pra-
      -- muitos na mesma linha multiplicariam as duas somas entre si.
      COALESCE(SUM(v."valorTotal"), 0) AS "totalVendasSessao",
      COALESCE((
        SELECT SUM(e."valorTotal")
        FROM "Venda" e
        WHERE e."estornoCaixaSessionId" = c.id
      ), 0) AS "totalEstornosAbsorvidos"
    FROM "CaixaSession" c
    LEFT JOIN "Venda" v ON v."caixaSessionId" = c.id
    WHERE c.status::text = 'FECHADO'
      AND c."dataFechamento" >= ${inicioHoje}
      AND c."dataFechamento" <= ${fimHoje}
    GROUP BY c.id, c."dataAbertura", c."dataFechamento", c."valorAbertura", c."valorFechamento"
    ORDER BY c."dataFechamento" DESC
  `;

  const sessoesFechadasHoje: SessaoFechadaResumoDiario[] = sessoesFechadasRaw.map((sessao) => {
    const valorAberturaCentavos = deDecimal(sessao.valorAbertura ?? 0);
    const totalVendasSessaoCentavos = deDecimal(sessao.totalVendasSessao ?? 0);
    const valorFechamentoCentavos = deDecimal(sessao.valorFechamento ?? 0);
    const valorEsperadoCentavos = calcularEsperadoFechamento({
      aberturaCentavos: valorAberturaCentavos,
      vendasDaSessaoCentavos: totalVendasSessaoCentavos,
      estornosAbsorvidosCentavos: deDecimal(sessao.totalEstornosAbsorvidos ?? 0),
    });

    return {
      id: String(sessao.id),
      dataAbertura: new Date(sessao.dataAbertura),
      dataFechamento: new Date(sessao.dataFechamento),
      valorAbertura: paraMoeda(valorAberturaCentavos),
      valorFechamento: paraMoeda(valorFechamentoCentavos),
      totalVendasSessao: paraMoeda(totalVendasSessaoCentavos),
      valorEsperadoFechamento: paraMoeda(valorEsperadoCentavos),
      diferencaFechamento: paraMoeda(subtrair(valorFechamentoCentavos, valorEsperadoCentavos)),
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
  /**
   * Nome de quem ABRIU a sessão — CaixaSession não guarda "quem fechou"
   * separadamente, só abertoPorId, então é o único "quem" real que existe
   * sem migração. Nulo em sessões antigas sem abertoPorId preenchido.
   */
  abertoPorNome: string | null;
}

/** Início/fim (DATA DE CALENDÁRIO) de um recorte de período — usado pelo `FiltroPeriodo` (Fase 2A-1) em `obterHistoricoFechamentos`. */
export interface PeriodoHistoricoFechamentos {
  inicio: Date;
  fim: Date;
}

/**
 * Retorna as sessões de caixa fechadas de forma paginada, ordenadas da mais recente
 * para a mais antiga. Usado para popular o histórico de fechamentos.
 *
 * `periodo` (Fase 2A-1, `FiltroPeriodo`): opcional — sem ele, devolve
 * fechamentos de qualquer data (comportamento anterior à Fase 2A-1).
 */
export async function obterHistoricoFechamentos(
  page: number = 1,
  limit: number = 15,
  periodo?: PeriodoHistoricoFechamentos
): Promise<{ data: ItemHistoricoFechamento[]; total: number; page: number; totalPages: number }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "caixa.ver_historico");
  const { prisma } = contexto;
  const offset = (page - 1) * limit;

  // Escopo de visibilidade (Fase 1D-2): sem caixa.ver_todos, so as sessoes
  // que o proprio usuario abriu. A decisao vem de lib/auth/escopos.ts — aqui
  // so traduzimos o fragmento pra SQL cru, ja que esta consulta agrega com
  // GROUP BY (fora do que o query builder do Prisma expressa bem).
  const escopoCaixa = escopoCaixaSession(contexto);
  const filtroAutorSql =
    "abertoPorId" in escopoCaixa && escopoCaixa.abertoPorId
      ? Prisma.sql`AND "abertoPorId" = ${escopoCaixa.abertoPorId}`
      : Prisma.empty;

  // "dataFechamento" é INSTANTE (timestamptz) — `periodo.inicio`/`fim` são
  // DATA DE CALENDÁRIO (o que o FiltroPeriodo produz); vira fronteira de
  // INSTANTE no fuso da loja via inicioDoDia/fimDoDia antes de comparar,
  // nunca comparado direto (compararia timestamptz com meia-noite UTC).
  const filtroPeriodoSql = periodo
    ? Prisma.sql`AND "dataFechamento" >= ${inicioDoDia(periodo.inicio, contexto.fusoHorario)} AND "dataFechamento" <= ${fimDoDia(periodo.fim, contexto.fusoHorario)}`
    : Prisma.empty;

  // Total de sessões fechadas (para calcular totalPages)
  const totalRaw = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM "CaixaSession"
    WHERE status::text = 'FECHADO'
      AND "dataFechamento" IS NOT NULL
      ${filtroAutorSql}
      ${filtroPeriodoSql}
  `;
  const total = Number(totalRaw[0]?.count ?? 0);

  const linhas = await prisma.$queryRaw<
    Array<{
      id: string;
      dataFechamento: Date;
      valorAbertura: EntradaDecimal;
      valorFechamento: EntradaDecimal;
      totalVendasSessao: EntradaDecimal;
      abertoPorNome: string | null;
    }>
  >`
    SELECT
      c.id,
      c."dataFechamento",
      c."valorAbertura",
      COALESCE(c."valorFechamento", 0) AS "valorFechamento",
      COALESCE(SUM(v."valorTotal"), 0) AS "totalVendasSessao",
      -- Mesma regra do resumo do dia: estorno conta na sessao que o
      -- absorveu, nao na sessao da venda. Ver lib/dominio/financeiro/estorno.ts.
      COALESCE((
        SELECT SUM(e."valorTotal")
        FROM "Venda" e
        WHERE e."estornoCaixaSessionId" = c.id
      ), 0) AS "totalEstornosAbsorvidos",
      u.nome AS "abertoPorNome"
    FROM "CaixaSession" c
    LEFT JOIN "Venda" v ON v."caixaSessionId" = c.id
    LEFT JOIN "Usuario" u ON u.id = c."abertoPorId"
    WHERE c.status::text = 'FECHADO'
      AND c."dataFechamento" IS NOT NULL
      ${filtroAutorSql}
      ${filtroPeriodoSql}
    GROUP BY c.id, c."dataFechamento", c."valorAbertura", c."valorFechamento", u.nome
    ORDER BY c."dataFechamento" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const data = linhas.map((row) => {
    const valorAberturaCentavos = deDecimal(row.valorAbertura ?? 0);
    const totalVendasCentavos = deDecimal(row.totalVendasSessao ?? 0);
    const valorFechamentoCentavos = deDecimal(row.valorFechamento ?? 0);
    const valorEsperadoCentavos = calcularEsperadoFechamento({
      aberturaCentavos: valorAberturaCentavos,
      vendasDaSessaoCentavos: totalVendasCentavos,
      estornosAbsorvidosCentavos: deDecimal(row.totalEstornosAbsorvidos ?? 0),
    });

    return {
      id: String(row.id),
      dataFechamento: new Date(row.dataFechamento),
      valorFechamento: paraMoeda(valorFechamentoCentavos),
      totalVendas: paraMoeda(totalVendasCentavos),
      diferenca: paraMoeda(subtrair(valorFechamentoCentavos, valorEsperadoCentavos)),
      abertoPorNome: row.abertoPorNome ?? null,
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
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "caixa.ver_historico");
  const { prisma } = contexto;

  const inicioData = new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0);
  const fimData = new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59, 999);

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoResumoDelegate;
    OrdemServico?: OrdemServicoResumoDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  const buscarVendasData = async () => {
    const vendasBase: VendaResumoRow[] = await prisma.venda.findMany({
      where: { estornadaEm: null, criadoEm: { gte: inicioData, lte: fimData } },
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

    let pagamentos: Array<{ vendaId: string; formaPagamento: string; valorBruto: EntradaDecimal }> = [];
    try {
      pagamentos = await prisma.$queryRaw<
        Array<{ vendaId: string; formaPagamento: string; valorBruto: EntradaDecimal }>
      >`
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
        valorBruto: pagamento.valorBruto ?? 0,
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

  const totalVendasCentavos = somar(...vendasData.map((v: VendaResumoRow) => deDecimal(v.valorTotal ?? 0)));

  const custoPdvCentavos = somar(
    ...vendasData.map((v: VendaResumoRow) =>
      somar(
        ...(v.itens ?? []).map(
          (item: VendaResumoItem) => deDecimal(item.custoUnitario ?? 0) * Number(item.quantidade ?? 1)
        )
      )
    )
  );

  const custoOsCentavos = somar(
    ...osEntreguesData.map((os: OrdemServicoCustoRow) =>
      somar(...(os.itens ?? []).map((item: OrdemServicoCustoItem) => deDecimal(item.custoPeca ?? 0)))
    )
  );

  const custoTotalCentavos = somar(custoPdvCentavos, custoOsCentavos);

  // Agrupa por forma de pagamento
  const mapaFormas: Record<string, number> = {};
  vendasData.forEach((v: VendaResumoRow) => {
    if ((v.pagamentos?.length ?? 0) > 0) {
      v.pagamentos?.forEach((pagamento) => {
        const forma = String(pagamento.formaPagamento ?? "OUTROS");
        mapaFormas[forma] = somar(mapaFormas[forma] ?? 0, deDecimal(pagamento.valorBruto ?? 0));
      });
      return;
    }

    const forma = String(v.formaPagamento ?? "OUTROS");
    mapaFormas[forma] = somar(mapaFormas[forma] ?? 0, deDecimal(v.valorTotal ?? 0));
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
    lucroBruto: paraMoeda(subtrair(totalVendasCentavos, custoTotalCentavos)),
    totaisPorFormaPagamento,
  };
}

