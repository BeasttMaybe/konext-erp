"use server";

import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterReceitaMensalPadrao } from "@/lib/dashboard/regras-financeiras";
import { Prisma } from "@prisma/client";

export type TipoVariacao = "percentual" | "sem_base" | "sem_variacao";

export type VariacaoPercentual = {
  tipo: TipoVariacao;
  valor?: number;
  texto: string;
};

export type ValorComVariacao = {
  valor: number;
  variacao: VariacaoPercentual;
};

export type DashboardExecutivo = {
  cardsPrincipais: {
    faturamentoMes: ValorComVariacao;
    lucroEstimado: ValorComVariacao;
    receberHojeAtrasado: {
      total: number;
      atrasado: number;
    };
    pagarHojeAtrasado: {
      total: number;
      atrasado: number;
    };
  };
  cardsOperacionais: {
    osAbertas: number;
    osConcluidasMes: number;
    garantiaRetorno: number;
    ticketMedioOS: number;
  };
  graficoResultado6Meses: Array<{
    mes: string;
    receita: number;
    despesas: number;
    lucro: number;
  }>;
  funilOS: Array<{
    status: string;
    label: string;
    quantidade: number;
  }>;
  atencaoHoje: Array<{
    tipo: string;
    titulo: string;
    descricao: string;
    valor?: number;
    href?: string;
    criticidade: "INFO" | "ATENCAO" | "CRITICO";
  }>;
  metasResumo?: {
    emAndamento: number;
    emAtencao: number;
    atrasadas: number;
    principais: Array<{
      id: string;
      titulo: string;
      progresso: number;
      status: string;
    }>;
  };
  garantiasResumo?: {
    ativas: number;
    vencem7Dias: number;
    retornosEmAndamento: number;
    retornosFinalizadosMes: number;
    taxaRetorno: number;
  };
  ultimasMovimentacoes: Array<{
    id: string;
    tipo: string;
    titulo: string;
    subtitulo?: string;
    valor?: number;
    data: string;
    status: string;
    href?: string;
  }>;
};

export type ResultadoDashboardExecutivo =
  | { sucesso: true; dados: DashboardExecutivo }
  | { sucesso: false; erro: string };

type LinhaMesValor = {
  mes: Date;
  total: number | null;
};

type LinhaTicketMedio = {
  media: number | null;
};

type MovimentacaoInterna = {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo?: string;
  valor?: number;
  data: Date;
  status: string;
  href?: string;
};

const STATUS_OS_CONCLUIDA = ["PRONTO", "ENTREGUE"] as const;
const STATUS_OS_ABERTA_EXCLUIDOS = ["PRONTO", "ENTREGUE"] as const;
const STATUS_CONTA_PENDENTE = ["PENDENTE", "ATRASADO", "RENEGOCIADO"] as const;
const STATUS_PARCELA_PENDENTE = ["PENDENTE", "ATRASADO"] as const;

function serializarMetaErro(meta: unknown): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") {
    return undefined;
  }

  return Object.fromEntries(Object.entries(meta as Record<string, unknown>));
}

function registrarErroDashboard(contexto: string, erro: unknown): void {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[dashboard] falha em consulta", {
      contexto,
      prismaCode: erro.code,
      message: erro.message,
      meta: serializarMetaErro(erro.meta),
    });
    return;
  }

  if (erro instanceof Error) {
    console.error("[dashboard] falha em consulta", {
      contexto,
      message: erro.message,
      stack: erro.stack,
    });
    return;
  }

  console.error("[dashboard] falha em consulta", {
    contexto,
    erro: String(erro),
  });
}

async function executarComFallback<T>(
  contexto: string,
  executar: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await executar();
  } catch (erro) {
    registrarErroDashboard(contexto, erro);
    return fallback;
  }
}

async function validarConectividadeBanco(): Promise<void> {
  try {
    await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
  } catch (erro) {
    registrarErroDashboard("validarConectividadeBanco", erro);
    throw new Error("Falha de conectividade com o banco para montar o dashboard.");
  }
}

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0);
}

function fimDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59, 999);
}

function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1, 0, 0, 0, 0);
}

function fimDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0, 23, 59, 59, 999);
}

function adicionarMeses(data: Date, meses: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + meses, 1, 0, 0, 0, 0);
}

function chaveMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function formatarMesPtBr(data: Date): string {
  const bruto = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(data).replace(".", "");
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

function calcularVariacaoPercentual(valorAtual: number, valorAnterior: number): VariacaoPercentual {
  if (valorAnterior === 0 && valorAtual > 0) {
    return {
      tipo: "sem_base",
      texto: "Sem base anterior",
    };
  }

  if (valorAnterior === 0 && valorAtual === 0) {
    return {
      tipo: "sem_variacao",
      texto: "Sem variacao",
    };
  }

  const variacao = ((valorAtual - valorAnterior) / valorAnterior) * 100;
  return {
    tipo: "percentual",
    valor: variacao,
    texto: `vs. mes anterior`,
  };
}

function somarMapasMes(...mapas: Map<string, number>[]): Map<string, number> {
  const resultado = new Map<string, number>();

  for (const mapa of mapas) {
    for (const [mes, total] of mapa.entries()) {
      resultado.set(mes, (resultado.get(mes) ?? 0) + total);
    }
  }

  return resultado;
}

function mapearSerieMes(
  inicioJanela: Date,
  receitaPorMes: Map<string, number>,
  despesasPorMes: Map<string, number>
): DashboardExecutivo["graficoResultado6Meses"] {
  return Array.from({ length: 6 }).map((_, indice) => {
    const dataMes = adicionarMeses(inicioJanela, indice);
    const mes = chaveMes(dataMes);
    const receita = receitaPorMes.get(mes) ?? 0;
    const despesas = despesasPorMes.get(mes) ?? 0;

    return {
      mes: formatarMesPtBr(dataMes),
      receita,
      despesas,
      lucro: receita - despesas,
    };
  });
}

function transformarLinhasMes(linhas: LinhaMesValor[]): Map<string, number> {
  const mapa = new Map<string, number>();

  for (const linha of linhas) {
    const mes = chaveMes(new Date(linha.mes));
    mapa.set(mes, Number(linha.total ?? 0));
  }

  return mapa;
}

async function obterReceitaPdvPorMes(inicio: Date, fim: Date): Promise<Map<string, number>> {
  try {
    const linhas = await prisma.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', v."criadoEm") AS mes,
             COALESCE(SUM(v."valorTotal"), 0) AS total
      FROM "Venda" v
      WHERE v."criadoEm" >= ${inicio}
        AND v."criadoEm" <= ${fim}
      GROUP BY DATE_TRUNC('month', v."criadoEm")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaPdvPorMes", erro);
    throw erro;
  }
}

async function obterReceitaVendasAprovadasPorMes(inicio: Date, fim: Date): Promise<Map<string, number>> {
  try {
    const linhas = await prisma.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', p."dataCriacao") AS mes,
             COALESCE(SUM(p."total"), 0) AS total
      FROM "PedidoVenda" p
      WHERE p."status"::text = 'APROVADO'
        AND p."origem"::text = 'VENDAS'
        AND p."dataCriacao" >= ${inicio}
        AND p."dataCriacao" <= ${fim}
      GROUP BY DATE_TRUNC('month', p."dataCriacao")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaVendasAprovadasPorMes", erro);
    throw erro;
  }
}

async function obterReceitaOSPorMes(inicio: Date, fim: Date): Promise<Map<string, number>> {
  try {
    const linhas = await prisma.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', base."referenciaMes") AS mes,
             COALESCE(SUM(base."valorReceita"), 0) AS total
      FROM (
        SELECT os.id,
               os."atualizadoEm" AS "referenciaMes",
               COALESCE(SUM(i."valorCobrado"), 0)::double precision AS "valorReceita",
               os."ehRetornoGarantia" AS "ehRetorno",
               COALESCE(r."valorAdicional", 0)::double precision AS "valorAdicional",
               COALESCE(r."houveCobranca", false) AS "houveCobranca"
        FROM "OrdemServico" os
        LEFT JOIN "ItemOS" i ON i."osId" = os.id
        LEFT JOIN "RetornoGarantiaOS" r ON r.id = os."retornoGarantiaId"
        WHERE os."excluidaEm" IS NULL
          AND os."status"::text IN ('PRONTO', 'ENTREGUE')
          AND os."atualizadoEm" >= ${inicio}
          AND os."atualizadoEm" <= ${fim}
        GROUP BY os.id, os."atualizadoEm", os."ehRetornoGarantia", r."valorAdicional", r."houveCobranca"
      ) base
      WHERE base."ehRetorno" = false
         OR base."valorReceita" > 0
         OR base."valorAdicional" > 0
         OR base."houveCobranca" = true
      GROUP BY DATE_TRUNC('month', base."referenciaMes")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterReceitaOSPorMes", erro);
    throw erro;
  }
}

async function obterCustosPdvPorMes(inicio: Date, fim: Date): Promise<Map<string, number>> {
  try {
    const linhas = await prisma.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', v."criadoEm") AS mes,
             COALESCE(SUM(iv."custoUnitario" * iv."quantidade"), 0) AS total
      FROM "ItemVenda" iv
      INNER JOIN "Venda" v ON v.id = iv."vendaId"
      WHERE v."criadoEm" >= ${inicio}
        AND v."criadoEm" <= ${fim}
      GROUP BY DATE_TRUNC('month', v."criadoEm")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterCustosPdvPorMes", erro);
    throw erro;
  }
}

async function obterCustosOSPorMes(inicio: Date, fim: Date): Promise<Map<string, number>> {
  try {
    const linhas = await prisma.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC('month', os."atualizadoEm") AS mes,
             COALESCE(SUM(i."custoPeca"), 0) AS total
      FROM "OrdemServico" os
      LEFT JOIN "ItemOS" i ON i."osId" = os.id
      WHERE os."excluidaEm" IS NULL
        AND os."status"::text IN ('PRONTO', 'ENTREGUE')
        AND os."atualizadoEm" >= ${inicio}
        AND os."atualizadoEm" <= ${fim}
      GROUP BY DATE_TRUNC('month', os."atualizadoEm")
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterCustosOSPorMes", erro);
    throw erro;
  }
}

async function obterDespesasFinanceirasPorMes(inicio: Date, fim: Date): Promise<Map<string, number>> {
  try {
    const linhas = await prisma.$queryRaw<LinhaMesValor[]>`
      SELECT DATE_TRUNC(
               'month',
               CASE WHEN pd."status"::text = 'PAGO' THEN pd."dataPagamento" ELSE pd."dataVencimento" END
             ) AS mes,
             COALESCE(SUM(pd."valor"), 0) AS total
      FROM "ParcelaDespesa" pd
      INNER JOIN "Despesa" d ON d.id = pd."despesaId"
      LEFT JOIN "Cliente" c ON c.id = d."clienteId"
      WHERE (
          (pd."status"::text = 'PAGO' AND pd."dataPagamento" >= ${inicio} AND pd."dataPagamento" <= ${fim})
          OR
          (pd."status"::text = 'PENDENTE' AND pd."dataVencimento" >= ${inicio} AND pd."dataVencimento" <= ${fim})
        )
        AND (c.id IS NULL OR c."papel"::text = 'FORNECEDOR')
      GROUP BY DATE_TRUNC(
        'month',
        CASE WHEN pd."status"::text = 'PAGO' THEN pd."dataPagamento" ELSE pd."dataVencimento" END
      )
    `;

    return transformarLinhasMes(linhas);
  } catch (erro) {
    registrarErroDashboard("obterDespesasFinanceirasPorMes", erro);
    throw erro;
  }
}

async function obterTicketMedioOSMes(inicioMesAtual: Date, fimMesAtual: Date): Promise<number> {
  try {
    const linhas = await prisma.$queryRaw<LinhaTicketMedio[]>`
      SELECT COALESCE(AVG(base.total_os), 0) AS media
      FROM (
        SELECT os.id,
               COALESCE(SUM(i."valorCobrado"), 0)::double precision AS total_os
        FROM "OrdemServico" os
        LEFT JOIN "ItemOS" i ON i."osId" = os.id
        WHERE os."excluidaEm" IS NULL
          AND os."ehRetornoGarantia" = false
          AND os."status"::text IN ('PRONTO', 'ENTREGUE')
          AND os."atualizadoEm" >= ${inicioMesAtual}
          AND os."atualizadoEm" <= ${fimMesAtual}
        GROUP BY os.id
      ) base
    `;

    return Number(linhas[0]?.media ?? 0);
  } catch (erro) {
    registrarErroDashboard("obterTicketMedioOSMes", erro);
    throw erro;
  }
}

function mapearStatusMovimentacao(status: string): string {
  const statusUpper = status.toUpperCase();

  if (["PAGO", "RECEBIDO", "ENTREGUE", "PRONTO", "CONCLUIDA", "CONCLUIDO"].includes(statusUpper)) {
    return "Concluido";
  }

  if (["ATENCAO", "ATRASADA", "ATRASADO", "PENDENTE"].includes(statusUpper)) {
    return statusUpper === "ATRASADA" || statusUpper === "ATRASADO" ? "Atrasado" : "Pendente";
  }

  if (["GARANTIA_RETORNO", "EM_ANALISE"].includes(statusUpper)) {
    return "Em garantia";
  }

  if (statusUpper === "CANCELADO" || statusUpper === "CANCELADA") {
    return "Cancelado";
  }

  return "Pendente";
}

function calcularProgressoMeta(parametros: {
  tipoValor: "DINHEIRO" | "QUANTIDADE" | "PERCENTUAL" | "CHECKLIST";
  valorAtual: number;
  valorAlvo: number | null;
}): number {
  if (parametros.tipoValor === "CHECKLIST") {
    return Math.max(0, Math.min(100, Math.round(parametros.valorAtual)));
  }

  if (!parametros.valorAlvo || parametros.valorAlvo <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((parametros.valorAtual / parametros.valorAlvo) * 100)));
}

export async function obterDashboardExecutivo(): Promise<DashboardExecutivo> {
  const usuario = await exigirSessao();
  await validarConectividadeBanco();

  const agora = new Date();
  const inicioHoje = inicioDoDia(agora);
  const fimHoje = fimDoDia(agora);
  const inicioMesAtual = inicioDoMes(agora);
  const fimMesAtual = fimDoMes(agora);

  const dataMesAnterior = adicionarMeses(inicioMesAtual, -1);
  const inicioMesAnterior = inicioDoMes(dataMesAnterior);

  const inicioJanela6Meses = adicionarMeses(inicioMesAtual, -5);

  const [
    receitaMensalPadrao,
    custosPdvMesMap,
    custosOSMesMap,
    despesasFinanceirasMesMap,
    receberHojeTotal,
    receberAtrasadoTotal,
    pagarHojeTotal,
    pagarAtrasadoTotal,
    osAbertas,
    osConcluidasMes,
    garantiaRetornoAbertas,
    ticketMedioOS,
    aguardandoOrcamento,
    aguardandoAprovacao,
    aprovadas,
    emExecucao,
    garantiaRetornoFunil,
    entreguesNoMes,
    contasReceberAtrasadas,
    contasPagarAtrasadas,
    osSemAtualizacao,
    garantiasVencem7Dias,
    retornosEmAndamento,
    metasAtrasadas,
    metasEmAtencao,
    estoqueBaixoTotal,
    metasPrincipais,
    totalMetasEmAndamento,
    totalMetasAtencao,
    totalMetasAtrasadas,
    garantiasAtivas,
    retornosFinalizadosMes,
    termosComRetorno,
    totalTermosGarantia,
    vendasRecentes,
    recebimentosRecentes,
    pagamentosRecentes,
    osRecentes,
    retornosRecentes,
    historicosMetasRecentes,
  ] = await Promise.all([
    executarComFallback(
      "cards.grafico.receitaMensalPadrao",
      () => obterReceitaMensalPadrao(inicioJanela6Meses, fimMesAtual),
      []
    ),
    executarComFallback(
      "cards.grafico.custosPdvMesMap",
      () => obterCustosPdvPorMes(inicioJanela6Meses, fimMesAtual),
      new Map<string, number>()
    ),
    executarComFallback(
      "cards.grafico.custosOSMesMap",
      () => obterCustosOSPorMes(inicioJanela6Meses, fimMesAtual),
      new Map<string, number>()
    ),
    executarComFallback(
      "cards.grafico.despesasFinanceirasMesMap",
      () => obterDespesasFinanceirasPorMes(inicioJanela6Meses, fimMesAtual),
      new Map<string, number>()
    ),
    prisma.contaReceber.aggregate({
      where: {
        status: { in: [...STATUS_CONTA_PENDENTE] },
        dataVencimento: { lte: fimHoje },
      },
      _sum: { valor: true },
    }),
    prisma.contaReceber.aggregate({
      where: {
        status: { in: [...STATUS_CONTA_PENDENTE] },
        dataVencimento: { lt: inicioHoje },
      },
      _sum: { valor: true },
    }),
    prisma.parcelaDespesa.aggregate({
      where: {
        status: { in: [...STATUS_PARCELA_PENDENTE] },
        dataVencimento: { lte: fimHoje },
      },
      _sum: { valor: true },
    }),
    prisma.parcelaDespesa.aggregate({
      where: {
        status: { in: [...STATUS_PARCELA_PENDENTE] },
        dataVencimento: { lt: inicioHoje },
      },
      _sum: { valor: true },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        archivedAt: null,
        status: { notIn: [...STATUS_OS_ABERTA_EXCLUIDOS] },
      },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        ehRetornoGarantia: false,
        status: { in: [...STATUS_OS_CONCLUIDA] },
        atualizadoEm: { gte: inicioMesAtual, lte: fimMesAtual },
      },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        ehRetornoGarantia: true,
        archivedAt: null,
        status: { notIn: [...STATUS_OS_CONCLUIDA] },
      },
    }),
    executarComFallback(
      "cardsOperacionais.ticketMedioOS",
      () => obterTicketMedioOSMes(inicioMesAtual, fimMesAtual),
      0
    ),
    prisma.ordemServico.count({ where: { excluidaEm: null, status: "AGUARDANDO_ORCAMENTO" } }),
    prisma.ordemServico.count({ where: { excluidaEm: null, status: "AGUARDANDO_APROVACAO" } }),
    prisma.ordemServico.count({ where: { excluidaEm: null, status: "APROVADO" } }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        status: { in: ["AGUARDANDO_PECA", "EM_MANUTENCAO", "PRONTO"] },
      },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        ehRetornoGarantia: true,
        archivedAt: null,
      },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        status: "ENTREGUE",
        atualizadoEm: { gte: inicioMesAtual, lte: fimMesAtual },
      },
    }),
    prisma.contaReceber.aggregate({
      where: {
        status: { in: [...STATUS_CONTA_PENDENTE] },
        dataVencimento: { lt: inicioHoje },
      },
      _sum: { valor: true },
      _count: { id: true },
    }),
    prisma.parcelaDespesa.aggregate({
      where: {
        status: { in: [...STATUS_PARCELA_PENDENTE] },
        dataVencimento: { lt: inicioHoje },
      },
      _sum: { valor: true },
      _count: { id: true },
    }),
    prisma.ordemServico.count({
      where: {
        excluidaEm: null,
        archivedAt: null,
        status: { notIn: [...STATUS_OS_CONCLUIDA] },
        atualizadoEm: { lt: new Date(inicioHoje.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        dataFimGarantia: { gte: inicioHoje, lte: fimDoDia(new Date(inicioHoje.getTime() + 7 * 24 * 60 * 60 * 1000)) },
      },
    }),
    prisma.retornoGarantiaOS.count({
      where: {
        finalizadoEm: null,
        osRetorno: {
          is: {
            excluidaEm: null,
          },
        },
      },
    }),
    executarComFallback(
      "atencao.metasAtrasadas",
      () =>
        prisma.meta.count({
          where: { criadoPorId: usuario.id, excluidaEm: null, status: "ATRASADA" },
        }),
      0
    ),
    executarComFallback(
      "atencao.metasEmAtencao",
      () =>
        prisma.meta.count({
          where: { criadoPorId: usuario.id, excluidaEm: null, status: "ATENCAO" },
        }),
      0
    ),
    executarComFallback(
      "atencao.estoqueBaixoTotal",
      () =>
        prisma.produto
          .findMany({
            where: { ativo: true },
            select: {
              quantidadeEstoque: true,
              estoqueMinimo: true,
            },
          })
          .then(
            (produtos) =>
              produtos.filter(
                (produto) =>
                  Number(produto.quantidadeEstoque ?? 0) <= Number(produto.estoqueMinimo ?? 0)
              ).length
          ),
      0
    ),
    executarComFallback("metas.principais", () => prisma.meta.findMany({
      where: {
        criadoPorId: usuario.id,
        excluidaEm: null,
        status: { in: ["EM_ANDAMENTO", "ATENCAO", "ATRASADA"] },
      },
      select: {
        id: true,
        titulo: true,
        status: true,
        tipoValor: true,
        valorAtual: true,
        valorAlvo: true,
      },
      orderBy: [
        { prioridade: "desc" },
        { dataPrazo: "asc" },
      ],
      take: 3,
    }), []),
    executarComFallback(
      "metas.totalEmAndamento",
      () => prisma.meta.count({ where: { criadoPorId: usuario.id, excluidaEm: null, status: "EM_ANDAMENTO" } }),
      0
    ),
    executarComFallback(
      "metas.totalEmAtencao",
      () => prisma.meta.count({ where: { criadoPorId: usuario.id, excluidaEm: null, status: "ATENCAO" } }),
      0
    ),
    executarComFallback(
      "metas.totalAtrasadas",
      () => prisma.meta.count({ where: { criadoPorId: usuario.id, excluidaEm: null, status: "ATRASADA" } }),
      0
    ),
    executarComFallback("garantias.ativas", () => prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        dataFimGarantia: { gte: inicioHoje },
      },
    }), 0),
    executarComFallback("garantias.retornosFinalizadosMes", () => prisma.retornoGarantiaOS.count({
      where: {
        finalizadoEm: { gte: inicioMesAtual, lte: fimMesAtual },
      },
    }), 0),
    executarComFallback("garantias.termosComRetorno", () => prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        retornos: { some: {} },
      },
    }), 0),
    executarComFallback("garantias.totalTermosGarantia", () => prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
      },
    }), 0),
    executarComFallback("movimentacoes.vendasRecentes", () => prisma.venda.findMany({
      take: 4,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        valorTotal: true,
        criadoEm: true,
        cliente: { select: { nomeRazaoSocial: true } },
      },
    }), []),
    executarComFallback("movimentacoes.recebimentosRecentes", () => prisma.contaReceber.findMany({
      take: 4,
      where: { status: "RECEBIDO" },
      orderBy: { dataRecebimento: "desc" },
      select: {
        id: true,
        descricao: true,
        valor: true,
        dataRecebimento: true,
        cliente: { select: { nomeRazaoSocial: true } },
      },
    }), []),
    executarComFallback("movimentacoes.pagamentosRecentes", () => prisma.parcelaDespesa.findMany({
      take: 4,
      where: { status: "PAGO" },
      orderBy: { dataPagamento: "desc" },
      select: {
        id: true,
        valor: true,
        dataPagamento: true,
        despesa: { select: { descricao: true, fornecedor: true } },
      },
    }), []),
    executarComFallback("movimentacoes.osRecentes", () => prisma.ordemServico.findMany({
      take: 4,
      where: { excluidaEm: null },
      orderBy: { atualizadoEm: "desc" },
      select: {
        id: true,
        numeroOs: true,
        status: true,
        equipamento: true,
        ehRetornoGarantia: true,
        atualizadoEm: true,
      },
    }), []),
    executarComFallback("movimentacoes.retornosRecentes", () => prisma.retornoGarantiaOS.findMany({
      take: 3,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        motivo: true,
        resultado: true,
        criadoEm: true,
        finalizadoEm: true,
        osRetorno: { select: { id: true, numeroOs: true } },
      },
    }), []),
    executarComFallback("movimentacoes.historicosMetasRecentes", () => prisma.historicoMeta.findMany({
      take: 3,
      orderBy: { criadoEm: "desc" },
      where: {
        meta: {
          criadoPorId: usuario.id,
          excluidaEm: null,
        },
      },
      select: {
        id: true,
        descricao: true,
        criadoEm: true,
        meta: {
          select: {
            id: true,
            titulo: true,
            status: true,
          },
        },
      },
    }), []),
  ]);

  const receitaPorMes = new Map<string, number>();
  for (const linha of receitaMensalPadrao) {
    receitaPorMes.set(chaveMes(new Date(linha.mes)), Number(linha.valor ?? 0));
  }
  const despesasPorMes = somarMapasMes(despesasFinanceirasMesMap, custosPdvMesMap, custosOSMesMap);

  const graficoResultado6Meses = mapearSerieMes(inicioJanela6Meses, receitaPorMes, despesasPorMes);
  const mesAtualKey = chaveMes(inicioMesAtual);
  const mesAnteriorKey = chaveMes(inicioMesAnterior);

  const faturamentoMesAtual = receitaPorMes.get(mesAtualKey) ?? 0;
  const faturamentoMesAnterior = receitaPorMes.get(mesAnteriorKey) ?? 0;
  const lucroMesAtual = faturamentoMesAtual - (despesasPorMes.get(mesAtualKey) ?? 0);
  const lucroMesAnterior = (receitaPorMes.get(mesAnteriorKey) ?? 0) - (despesasPorMes.get(mesAnteriorKey) ?? 0);

  const atencaoHoje: DashboardExecutivo["atencaoHoje"] = [];

  if ((contasPagarAtrasadas._count.id ?? 0) > 0) {
    atencaoHoje.push({
      tipo: "FINANCEIRO",
      titulo: "Contas a pagar vencidas",
      descricao: `${contasPagarAtrasadas._count.id} parcela(s) vencida(s).`,
      valor: Number(contasPagarAtrasadas._sum.valor ?? 0),
      href: "/financeiro/pagar",
      criticidade: "CRITICO",
    });
  }

  if ((contasReceberAtrasadas._count.id ?? 0) > 0) {
    atencaoHoje.push({
      tipo: "FINANCEIRO",
      titulo: "Contas a receber atrasadas",
      descricao: `${contasReceberAtrasadas._count.id} recebimento(s) em atraso.`,
      valor: Number(contasReceberAtrasadas._sum.valor ?? 0),
      href: "/financeiro/receber",
      criticidade: "ATENCAO",
    });
  }

  if (osSemAtualizacao > 0) {
    atencaoHoje.push({
      tipo: "OPERACAO_OS",
      titulo: "OS sem atualizacao recente",
      descricao: `${osSemAtualizacao} ordem(ns) aberta(s) sem atualizacao ha mais de 7 dias.`,
      href: "/os",
      criticidade: "ATENCAO",
    });
  }

  if (garantiasVencem7Dias > 0) {
    atencaoHoje.push({
      tipo: "GARANTIAS",
      titulo: "Garantias vencendo em 7 dias",
      descricao: `${garantiasVencem7Dias} garantia(s) perto do vencimento.`,
      href: "/os/garantias",
      criticidade: "ATENCAO",
    });
  }

  if (retornosEmAndamento > 0) {
    atencaoHoje.push({
      tipo: "GARANTIAS",
      titulo: "Retornos de garantia em andamento",
      descricao: `${retornosEmAndamento} retorno(s) aguardando finalizacao.`,
      href: "/os/garantias",
      criticidade: "INFO",
    });
  }

  if (metasAtrasadas > 0 || metasEmAtencao > 0) {
    atencaoHoje.push({
      tipo: "METAS",
      titulo: "Metas em risco",
      descricao: `${metasAtrasadas} atrasada(s) e ${metasEmAtencao} em atencao.`,
      href: "/metas",
      criticidade: metasAtrasadas > 0 ? "CRITICO" : "ATENCAO",
    });
  }

  const estoqueBaixo = Number(estoqueBaixoTotal ?? 0);

  if (estoqueBaixo > 0) {
    atencaoHoje.push({
      tipo: "ESTOQUE",
      titulo: "Estoque baixo",
      descricao: `${estoqueBaixo} produto(s) no limite minimo.`,
      href: "/estoque",
      criticidade: "ATENCAO",
    });
  }

  const movimentacoes: MovimentacaoInterna[] = [
    ...vendasRecentes.map((venda) => ({
      id: `VENDA-${venda.id}`,
      tipo: "Venda",
      titulo: "Venda PDV concluida",
      subtitulo: venda.cliente?.nomeRazaoSocial ?? "Cliente nao informado",
      valor: Number(venda.valorTotal ?? 0),
      data: venda.criadoEm,
      status: "Concluido",
      href: "/pdv",
    })),
    ...recebimentosRecentes.map((conta) => ({
      id: `RECEBER-${conta.id}`,
      tipo: "Financeiro",
      titulo: conta.descricao || "Recebimento registrado",
      subtitulo: conta.cliente?.nomeRazaoSocial ?? undefined,
      valor: Number(conta.valor ?? 0),
      data: conta.dataRecebimento ?? inicioHoje,
      status: "Recebido",
      href: "/financeiro/receber",
    })),
    ...pagamentosRecentes.map((parcela) => ({
      id: `PAGAR-${parcela.id}`,
      tipo: "Financeiro",
      titulo: parcela.despesa.descricao || "Pagamento de despesa",
      subtitulo: parcela.despesa.fornecedor,
      valor: Number(parcela.valor ?? 0) * -1,
      data: parcela.dataPagamento ?? inicioHoje,
      status: "Pago",
      href: "/financeiro/pagar",
    })),
    ...osRecentes.map((os) => ({
      id: `OS-${os.id}`,
      tipo: "OS",
      titulo: `OS #${os.numeroOs} - ${os.equipamento}`,
      subtitulo: os.ehRetornoGarantia ? "Retorno de garantia" : "Operacao regular",
      data: os.atualizadoEm,
      status: mapearStatusMovimentacao(String(os.status)),
      href: "/os",
    })),
    ...retornosRecentes.map((retorno) => ({
      id: `RETORNO-${retorno.id}`,
      tipo: "Garantia",
      titulo: `Retorno ${retorno.finalizadoEm ? "finalizado" : "registrado"}`,
      subtitulo: retorno.motivo,
      data: retorno.finalizadoEm ?? retorno.criadoEm,
      status: retorno.finalizadoEm ? "Concluido" : "Em garantia",
      href: "/os/garantias",
    })),
    ...historicosMetasRecentes.map((historico) => ({
      id: `META-${historico.id}`,
      tipo: "Meta",
      titulo: historico.meta.titulo,
      subtitulo: historico.descricao,
      data: historico.criadoEm,
      status: mapearStatusMovimentacao(historico.meta.status),
      href: "/metas",
    })),
  ];

  const chavesMovimentacao = new Set<string>();
  const ultimasMovimentacoes = movimentacoes
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .filter((item) => {
      const chave = `${item.tipo}-${item.titulo}-${item.data.toISOString().slice(0, 16)}`;
      if (chavesMovimentacao.has(chave)) {
        return false;
      }

      chavesMovimentacao.add(chave);
      return true;
    })
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      subtitulo: item.subtitulo,
      valor: item.valor,
      data: item.data.toISOString(),
      status: item.status,
      href: item.href,
    }));

  const funilOS: DashboardExecutivo["funilOS"] = [
    {
      status: "AGUARDANDO_ORCAMENTO",
      label: "Aguardando orcamento",
      quantidade: aguardandoOrcamento,
    },
    {
      status: "AGUARDANDO_APROVACAO",
      label: "Aguardando aprovacao",
      quantidade: aguardandoAprovacao,
    },
    {
      status: "APROVADO",
      label: "Aprovadas",
      quantidade: aprovadas,
    },
    {
      status: "EM_EXECUCAO",
      label: "Em execucao",
      quantidade: emExecucao,
    },
    {
      status: "GARANTIA_RETORNO",
      label: "Garantia/Retorno",
      quantidade: garantiaRetornoFunil,
    },
    {
      status: "ENTREGUES_MES",
      label: "Entregues no mes",
      quantidade: entreguesNoMes,
    },
  ];

  return {
    cardsPrincipais: {
      faturamentoMes: {
        valor: faturamentoMesAtual,
        variacao: calcularVariacaoPercentual(faturamentoMesAtual, faturamentoMesAnterior),
      },
      lucroEstimado: {
        valor: lucroMesAtual,
        variacao: calcularVariacaoPercentual(lucroMesAtual, lucroMesAnterior),
      },
      receberHojeAtrasado: {
        total: Number(receberHojeTotal._sum.valor ?? 0),
        atrasado: Number(receberAtrasadoTotal._sum.valor ?? 0),
      },
      pagarHojeAtrasado: {
        total: Number(pagarHojeTotal._sum.valor ?? 0),
        atrasado: Number(pagarAtrasadoTotal._sum.valor ?? 0),
      },
    },
    cardsOperacionais: {
      osAbertas,
      osConcluidasMes,
      garantiaRetorno: garantiaRetornoAbertas,
      ticketMedioOS,
    },
    graficoResultado6Meses,
    funilOS,
    atencaoHoje,
    metasResumo: {
      emAndamento: totalMetasEmAndamento,
      emAtencao: totalMetasAtencao,
      atrasadas: totalMetasAtrasadas,
      principais: metasPrincipais.map((meta) => ({
        id: meta.id,
        titulo: meta.titulo,
        progresso: calcularProgressoMeta({
          tipoValor: meta.tipoValor,
          valorAtual: Number(meta.valorAtual ?? 0),
          valorAlvo: meta.valorAlvo,
        }),
        status: mapearStatusMovimentacao(meta.status),
      })),
    },
    garantiasResumo: {
      ativas: garantiasAtivas,
      vencem7Dias: garantiasVencem7Dias,
      retornosEmAndamento,
      retornosFinalizadosMes,
      taxaRetorno:
        totalTermosGarantia > 0
          ? Number(((termosComRetorno / totalTermosGarantia) * 100).toFixed(2))
          : 0,
    },
    ultimasMovimentacoes,
  };
}

export async function obterDashboardExecutivoSeguro(): Promise<ResultadoDashboardExecutivo> {
  try {
    const dados = await obterDashboardExecutivo();
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[dashboard] falha ao montar dashboard executivo", {
        prismaCode: erro.code,
        message: erro.message,
        meta: serializarMetaErro(erro.meta),
      });

      return {
        sucesso: false,
        erro: "Nao foi possivel carregar os indicadores do dashboard.",
      };
    }

    if (erro instanceof Error) {
      console.error("[dashboard] falha ao montar dashboard executivo", {
        message: erro.message,
        stack: erro.stack,
      });
    } else {
      console.error("[dashboard] falha ao montar dashboard executivo", {
        erro: String(erro),
      });
    }

    return {
      sucesso: false,
      erro: "Nao foi possivel carregar os indicadores do dashboard.",
    };
  }
}
