"use server";

import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterReceitaMensalPadrao, obterReceitaTotalPadrao } from "@/lib/dashboard/regras-financeiras";

export interface AtividadeRecenteDashboard {
  id: string;
  tipo: "VENDA" | "DESPESA" | "OS";
  descricao: string;
  valor: number;
  data: Date;
  status: string;
  cliente?: string;
}

export interface DadosDashboardInicial {
  metricas: {
    faturamentoMensal: { valor: number; variacao: number };
    osConcluidas: { valor: number; variacao: number };
    vendasPdv: { valor: number; variacao: number };
    clientesAtivos: { valor: number; variacao: number };
  };
  faturamentoUltimos6Meses: Array<{ mes: string; faturamento: number }>;
  statusOs: Array<{ nome: string; quantidade: number; percentual: number; cor: string }>;
  atividadesRecentes: AtividadeRecenteDashboard[];
}

export type MetricasDashboardInicial = DadosDashboardInicial["metricas"];
export type FaturamentoDashboardInicial = DadosDashboardInicial["faturamentoUltimos6Meses"];
export type StatusOsDashboardInicial = DadosDashboardInicial["statusOs"];
export type AtividadesDashboardInicial = DadosDashboardInicial["atividadesRecentes"];

const inicioMes = (data: Date): Date =>
  new Date(data.getFullYear(), data.getMonth(), 1, 0, 0, 0, 0);

const fimMes = (data: Date): Date =>
  new Date(data.getFullYear(), data.getMonth() + 1, 0, 23, 59, 59, 999);

const deslocarMes = (data: Date, deslocamento: number): Date =>
  new Date(data.getFullYear(), data.getMonth() + deslocamento, 1, 0, 0, 0, 0);

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);

const paraMoeda = (centavos: number) => centavos / 100;

const calcularVariacaoPercentual = (atual: number, anterior: number): number => {
  if (anterior === 0) {
    return 0;
  }

  return ((atual - anterior) / anterior) * 100;
};

const formatarMesCurtoPtBr = (data: Date): string => {
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(data);
  const mesSemPonto = mes.replace(".", "");
  return mesSemPonto.charAt(0).toUpperCase() + mesSemPonto.slice(1);
};

const chaveMes = (data: Date): string => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

type IntervalosDashboard = {
  startOfCurrentMonth: Date;
  endOfCurrentMonth: Date;
  startOfLastMonth: Date;
  endOfLastMonth: Date;
  startOfSixMonthsWindow: Date;
};

import {
  type ItemFormaFechamento,
  type DadosFechamentoCaixa,
} from "@/types/fechamento-caixa";

type FindManyDelegate<T> = {
  findMany: (args: unknown) => Promise<T[]>;
};

type GroupByDelegate<T> = {
  groupBy: (args: unknown) => Promise<T[]>;
};

type CountDelegate = {
  count: (args: unknown) => Promise<number>;
};

type VendaFechamento = {
  valorTotal?: number | null;
  formaPagamento?: string | null;
  itens?: Array<{ custoUnitario?: number | null; quantidade?: number | null }>;
};

type RecebimentoOsFechamento = {
  valor?: number | null;
  formaRecebimento?: string | null;
};

type OrdemServicoEntregueFechamento = {
  itens?: Array<{ custoPeca?: number | null }>;
};

type PrismaCaixaAny = typeof prisma & {
  venda?: FindManyDelegate<VendaFechamento>;
  Venda?: FindManyDelegate<VendaFechamento>;
  contaReceber?: FindManyDelegate<RecebimentoOsFechamento>;
  ContaReceber?: FindManyDelegate<RecebimentoOsFechamento>;
  ordemServico?: FindManyDelegate<OrdemServicoEntregueFechamento>;
  OrdemServico?: FindManyDelegate<OrdemServicoEntregueFechamento>;
};

type DashboardVendaMesRow = { valorTotal?: number | null };
type DashboardRecebimentoMesRow = { valor?: number | null; vendaId?: string | null };
type DashboardStatusRow = { status?: string | null };
type DashboardClienteRow = { clienteId?: string | null };
type DashboardVenda6MesesRow = { valorTotal?: number | null; criadoEm: Date | string };
type DashboardRecebimento6MesesRow = {
  valor?: number | null;
  criadoEm: Date | string;
  dataRecebimento?: Date | string | null;
  vendaId?: string | null;
};
type DashboardStatusGroupRow = { status?: string | null; _count?: { id?: number | null } };
type DashboardVendaRecenteRow = {
  id: string | number;
  valorTotal?: number | null;
  criadoEm: Date | string;
  cliente?: { nomeRazaoSocial?: string | null } | null;
};
type DashboardDespesaRecenteRow = {
  id: string | number;
  valor?: number | null;
  criadoEm: Date | string;
  status?: string | null;
  numeroParcela?: string | number | null;
  despesa?: { descricao?: string | null; fornecedor?: string | null } | null;
};
type DashboardOsRecenteRow = {
  id: string | number;
  numeroOs?: string | number | null;
  equipamento?: string | null;
  criadoEm: Date | string;
  status?: string | null;
  cliente?: { nomeRazaoSocial?: string | null } | null;
};

type PrismaDashboardAny = typeof prisma & {
  venda?: FindManyDelegate<DashboardVendaMesRow | DashboardClienteRow | DashboardVenda6MesesRow | DashboardVendaRecenteRow> & CountDelegate;
  Venda?: FindManyDelegate<DashboardVendaMesRow | DashboardClienteRow | DashboardVenda6MesesRow | DashboardVendaRecenteRow> & CountDelegate;
  contaReceber?: FindManyDelegate<DashboardRecebimentoMesRow | DashboardRecebimento6MesesRow>;
  ContaReceber?: FindManyDelegate<DashboardRecebimentoMesRow | DashboardRecebimento6MesesRow>;
  ordemServico?: FindManyDelegate<DashboardStatusRow | DashboardClienteRow | DashboardOsRecenteRow> & GroupByDelegate<DashboardStatusGroupRow>;
  OrdemServico?: FindManyDelegate<DashboardStatusRow | DashboardClienteRow | DashboardOsRecenteRow> & GroupByDelegate<DashboardStatusGroupRow>;
  parcelaDespesa?: FindManyDelegate<DashboardDespesaRecenteRow>;
  ParcelaDespesa?: FindManyDelegate<DashboardDespesaRecenteRow>;
};

// ── Tipos do Fechamento de Caixa ─────────────────────────────────────────────

/** Rótulos em PT-BR para as formas de pagamento do enum FormaPagamento. */
const ROTULOS_FORMA_PAGAMENTO: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_DEBITO: "Cartão de Débito",
  BOLETO: "Boleto",
  CREDIARIO: "Crediário",
  EMPENHO_PUBLICO: "Empenho Público",
};

// ── Action: Fechamento de Caixa ───────────────────────────────────────────────

/**
 * Busca todos os dados necessários para o Fechamento de Caixa do dia atual.
 * Combina receitas e custos de PDV e OS para um relatório unificado.
 */
export async function obterDadosFechamentoCaixa(): Promise<DadosFechamentoCaixa> {
  await exigirSessao();
  const agora = new Date();
  // Intervalos do dia corrente (00:00:00 – 23:59:59)
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
  const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);

  const prismaAny = prisma as PrismaCaixaAny;
  const vendaDelegate = prismaAny.venda ?? prismaAny.Venda;
  const contaReceberDelegate = prismaAny.contaReceber ?? prismaAny.ContaReceber;
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!vendaDelegate?.findMany || !contaReceberDelegate?.findMany || !ordemServicoDelegate?.findMany) {
    // Retorna estrutura vazia em vez de quebrar a página quando os delegates ainda não estão disponíveis.
    return {
      faturamentoPdv: 0, faturamentoOs: 0, faturamentoTotal: 0,
      custoPdv: 0, custoOs: 0, custoTotal: 0, lucroBruto: 0, porForma: [],
    };
  }

  const [vendasHoje, recebimentosOsHoje, osEntreguesHoje] = await Promise.all([
    // (a) Vendas PDV criadas hoje — inclui itens para cálculo de custo de mercadoria
    vendaDelegate.findMany({
      where: { criadoEm: { gte: inicioDia, lte: fimDia } },
      select: {
        valorTotal: true,
        formaPagamento: true,
        itens: { select: { custoUnitario: true, quantidade: true } },
      },
    }),
    // (b) Receitas de OS recebidas hoje via ContaReceber
    contaReceberDelegate.findMany({
      where: {
        status: "RECEBIDO",
        origem: "ORDEM_SERVICO",
        OR: [
          { dataRecebimento: { gte: inicioDia, lte: fimDia } },
          { AND: [{ dataRecebimento: null }, { criadoEm: { gte: inicioDia, lte: fimDia } }] },
        ],
      },
      select: { valor: true, formaRecebimento: true },
    }),
    // (c) OS marcadas como ENTREGUE hoje — itens usados para custo de peças
    ordemServicoDelegate.findMany({
      where: {
        status: "ENTREGUE",
        excluidaEm: null,
        atualizadoEm: { gte: inicioDia, lte: fimDia },
      },
      select: { itens: { select: { custoPeca: true } } },
    }),
  ]);

  // ── Cálculo de faturamento ────────────────────────────────────────────────
  const faturamentoPdv = vendasHoje.reduce(
    (acc: number, venda) => acc + paraCentavos(Number(venda.valorTotal ?? 0)), 0
  );
  const faturamentoOs = recebimentosOsHoje.reduce(
    (acc: number, recebimento) => acc + paraCentavos(Number(recebimento.valor ?? 0)), 0
  );
  const faturamentoTotal = faturamentoPdv + faturamentoOs;

  // ── Cálculo de custos ─────────────────────────────────────────────────────
  // Custo PDV: soma de (custoUnitario * quantidade) por item de venda
  const custoPdv = vendasHoje.reduce((acc: number, venda) => {
    const custoVenda = (venda.itens ?? []).reduce(
      (s: number, item) =>
        s + paraCentavos(Number(item.custoUnitario ?? 0) * Number(item.quantidade ?? 1)),
      0
    );
    return acc + custoVenda;
  }, 0);

  // Custo OS: soma de custoPeca de cada ItemOS das OS entregues hoje
  const custoOs = osEntreguesHoje.reduce((acc: number, os) => {
    const custoOs = (os.itens ?? []).reduce(
      (s: number, item) => s + paraCentavos(Number(item.custoPeca ?? 0)),
      0
    );
    return acc + custoOs;
  }, 0);

  const custoTotal = custoPdv + custoOs;
  const lucroBruto = faturamentoTotal - custoTotal;

  // ── Agrupamento por forma de pagamento ───────────────────────────────────
  const mapaFormas: Record<string, number> = {};

  vendasHoje.forEach((venda) => {
    const forma = String(venda.formaPagamento ?? "OUTROS");
    mapaFormas[forma] = (mapaFormas[forma] ?? 0) + paraCentavos(Number(venda.valorTotal ?? 0));
  });
  recebimentosOsHoje.forEach((recebimento) => {
    const forma = String(recebimento.formaRecebimento ?? "OUTROS");
    mapaFormas[forma] = (mapaFormas[forma] ?? 0) + paraCentavos(Number(recebimento.valor ?? 0));
  });

  const porForma: ItemFormaFechamento[] = Object.entries(mapaFormas)
    .filter(([, centavos]) => centavos > 0)
    .map(([forma, centavos]) => ({
      forma,
      rotulo: ROTULOS_FORMA_PAGAMENTO[forma] ?? forma.replaceAll("_", " "),
      valor: paraMoeda(centavos),
    }))
    .sort((a, b) => b.valor - a.valor);

  return {
    faturamentoPdv: paraMoeda(faturamentoPdv),
    faturamentoOs: paraMoeda(faturamentoOs),
    faturamentoTotal: paraMoeda(faturamentoTotal),
    custoPdv: paraMoeda(custoPdv),
    custoOs: paraMoeda(custoOs),
    custoTotal: paraMoeda(custoTotal),
    lucroBruto: paraMoeda(lucroBruto),
    porForma,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const mapaStatusOs: Record<string, { nome: string; cor: string }> = {
  AGUARDANDO_ORCAMENTO: { nome: "Aguardando Orçamento", cor: "hsl(43 96% 56%)" },
  AGUARDANDO_APROVACAO: { nome: "Aguardando Aprovação", cor: "hsl(262 83% 58%)" },
  APROVADO: { nome: "Aprovado", cor: "hsl(217 91% 60%)" },
  AGUARDANDO_PECA: { nome: "Aguardando Peça", cor: "hsl(24 95% 53%)" },
  EM_MANUTENCAO: { nome: "Em Manutenção", cor: "hsl(199 89% 48%)" },
  GARANTIA_RETORNO: { nome: "Garantia / Retorno", cor: "hsl(239 84% 67%)" },
  PRONTO: { nome: "Pronto", cor: "hsl(168 76% 42%)" },
  ENTREGUE: { nome: "Entregue", cor: "hsl(142 71% 45%)" },
  CONCLUIDA: { nome: "Concluída", cor: "hsl(142 71% 45%)" },
};

type DashboardDelegates = {
  vendaDelegate: FindManyDelegate<DashboardVendaMesRow | DashboardClienteRow | DashboardVenda6MesesRow | DashboardVendaRecenteRow> & CountDelegate;
  contaReceberDelegate: FindManyDelegate<DashboardRecebimentoMesRow | DashboardRecebimento6MesesRow>;
  ordemServicoDelegate: FindManyDelegate<DashboardStatusRow | DashboardClienteRow | DashboardOsRecenteRow> & GroupByDelegate<DashboardStatusGroupRow>;
  parcelaDespesaDelegate: FindManyDelegate<DashboardDespesaRecenteRow>;
};

function obterIntervalosDashboard(agora = new Date()): IntervalosDashboard {
  return {
    startOfCurrentMonth: inicioMes(agora),
    endOfCurrentMonth: fimMes(agora),
    startOfLastMonth: inicioMes(deslocarMes(agora, -1)),
    endOfLastMonth: fimMes(deslocarMes(agora, -1)),
    startOfSixMonthsWindow: inicioMes(deslocarMes(agora, -5)),
  };
}

function obterDelegatesDashboard(): DashboardDelegates {
  const prismaAny = prisma as PrismaDashboardAny;
  const vendaDelegate = prismaAny.venda ?? prismaAny.Venda;
  const contaReceberDelegate = prismaAny.contaReceber ?? prismaAny.ContaReceber;
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;
  const parcelaDespesaDelegate = prismaAny.parcelaDespesa ?? prismaAny.ParcelaDespesa;

  if (
    !vendaDelegate?.findMany ||
    !vendaDelegate?.count ||
    !contaReceberDelegate?.findMany ||
    !ordemServicoDelegate?.findMany ||
    !ordemServicoDelegate?.groupBy ||
    !parcelaDespesaDelegate?.findMany
  ) {
    throw new Error("Delegates Prisma necessarios para o dashboard inicial nao estao disponiveis.");
  }

  return {
    vendaDelegate,
    contaReceberDelegate,
    ordemServicoDelegate,
    parcelaDespesaDelegate,
  };
}

export async function obterMetricasDashboardInicial(): Promise<MetricasDashboardInicial> {
  await exigirSessao();
  const {
    startOfCurrentMonth,
    endOfCurrentMonth,
    startOfLastMonth,
    endOfLastMonth,
  } = obterIntervalosDashboard();
  const { vendaDelegate, ordemServicoDelegate } = obterDelegatesDashboard();

  const [
    faturamentoAtual,
    faturamentoAnterior,
    osMesAtualBase,
    osMesAnteriorBase,
    qtdVendasMesAtual,
    qtdVendasMesAnterior,
    vendasClientesMesAtual,
    vendasClientesMesAnterior,
    osClientesMesAtual,
    osClientesMesAnterior,
  ] = await Promise.all([
    obterReceitaTotalPadrao(startOfCurrentMonth, endOfCurrentMonth),
    obterReceitaTotalPadrao(startOfLastMonth, endOfLastMonth),
    ordemServicoDelegate.findMany({
      where: {
        atualizadoEm: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
        excluidaEm: null,
        ehRetornoGarantia: false,
        status: {
          in: ["PRONTO", "ENTREGUE"],
        },
      },
      select: { status: true },
    }),
    ordemServicoDelegate.findMany({
      where: {
        atualizadoEm: { gte: startOfLastMonth, lte: endOfLastMonth },
        excluidaEm: null,
        ehRetornoGarantia: false,
        status: {
          in: ["PRONTO", "ENTREGUE"],
        },
      },
      select: { status: true },
    }),
    prisma.pedidoVenda.count({
      where: {
        origem: "PDV",
        status: "APROVADO",
        dataCriacao: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
      },
    }),
    prisma.pedidoVenda.count({
      where: {
        origem: "PDV",
        status: "APROVADO",
        dataCriacao: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),
    vendaDelegate.findMany({
      where: {
        criadoEm: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
        clienteId: { not: null },
      },
      select: { clienteId: true },
      distinct: ["clienteId"],
    }),
    vendaDelegate.findMany({
      where: {
        criadoEm: { gte: startOfLastMonth, lte: endOfLastMonth },
        clienteId: { not: null },
      },
      select: { clienteId: true },
      distinct: ["clienteId"],
    }),
    ordemServicoDelegate.findMany({
      where: { criadoEm: { gte: startOfCurrentMonth, lte: endOfCurrentMonth }, excluidaEm: null },
      select: { clienteId: true },
      distinct: ["clienteId"],
    }),
    ordemServicoDelegate.findMany({
      where: { criadoEm: { gte: startOfLastMonth, lte: endOfLastMonth }, excluidaEm: null },
      select: { clienteId: true },
      distinct: ["clienteId"],
    }),
  ]);

  // Fallback de data de conclusao da OS: schema atual nao possui finalizadaEm/entregueEm.
  // Enquanto esses campos nao existirem, usa atualizadoEm como referencia de periodo.
  const statusConcluido = new Set(["ENTREGUE", "PRONTO"]);
  const osMesAtual = osMesAtualBase.filter((item) => statusConcluido.has(String((item as DashboardStatusRow).status))).length;
  const osMesAnterior = osMesAnteriorBase.filter((item) => statusConcluido.has(String((item as DashboardStatusRow).status))).length;

  const clientesAtivosAtual = new Set<string>([
    ...vendasClientesMesAtual
      .map((item) => (item as DashboardClienteRow).clienteId)
      .filter((clienteId): clienteId is string => Boolean(clienteId)),
    ...osClientesMesAtual
      .map((item) => (item as DashboardClienteRow).clienteId)
      .filter((clienteId): clienteId is string => Boolean(clienteId)),
  ]).size;

  const clientesAtivosAnterior = new Set<string>([
    ...vendasClientesMesAnterior
      .map((item) => (item as DashboardClienteRow).clienteId)
      .filter((clienteId): clienteId is string => Boolean(clienteId)),
    ...osClientesMesAnterior
      .map((item) => (item as DashboardClienteRow).clienteId)
      .filter((clienteId): clienteId is string => Boolean(clienteId)),
  ]).size;

  return {
    faturamentoMensal: {
      valor: faturamentoAtual,
      variacao: calcularVariacaoPercentual(faturamentoAtual, faturamentoAnterior),
    },
    osConcluidas: {
      valor: osMesAtual,
      variacao: calcularVariacaoPercentual(osMesAtual, osMesAnterior),
    },
    vendasPdv: {
      valor: qtdVendasMesAtual,
      variacao: calcularVariacaoPercentual(qtdVendasMesAtual, qtdVendasMesAnterior),
    },
    clientesAtivos: {
      valor: clientesAtivosAtual,
      variacao: calcularVariacaoPercentual(clientesAtivosAtual, clientesAtivosAnterior),
    },
  };
}

export async function obterFaturamentoUltimos6MesesDashboard(): Promise<FaturamentoDashboardInicial> {
  await exigirSessao();
  const { startOfSixMonthsWindow, endOfCurrentMonth } = obterIntervalosDashboard();
  const agora = new Date();
  const receitaMensal = await obterReceitaMensalPadrao(startOfSixMonthsWindow, endOfCurrentMonth);

  const meses = Array.from({ length: 6 }).map((_, indice) => {
    const data = deslocarMes(agora, indice - 5);
    return {
      data,
      chave: chaveMes(data),
      mes: formatarMesCurtoPtBr(data),
      totalCentavos: 0,
    };
  });

  const indiceMes = new Map(meses.map((mes) => [mes.chave, mes]));

  receitaMensal.forEach((linha) => {
    const chave = chaveMes(new Date(linha.mes));
    const bucket = indiceMes.get(chave);
    if (!bucket) return;
    bucket.totalCentavos += paraCentavos(Number(linha.valor ?? 0));
  });

  return meses.map((mes) => ({
    mes: mes.mes,
    faturamento: paraMoeda(mes.totalCentavos),
  }));
}

export async function obterStatusOsDashboard(): Promise<StatusOsDashboardInicial> {
  await exigirSessao();
  const { ordemServicoDelegate } = obterDelegatesDashboard();

  const statusOsAgrupado = await ordemServicoDelegate.groupBy({
    where: {
      excluidaEm: null,
      archivedAt: null,
    },
    by: ["status"],
    _count: { id: true },
  });

  const totalStatusOs = statusOsAgrupado.reduce((acc: number, item) => acc + Number(item._count?.id ?? 0), 0);

  return statusOsAgrupado
    .map((item) => {
      const status = String(item.status);
      const count = Number(item._count?.id ?? 0);
      const configuracao = mapaStatusOs[status] ?? {
        nome: status.replaceAll("_", " "),
        cor: "hsl(215 16% 47%)",
      };

      const percentual = totalStatusOs > 0 ? Number(((count / totalStatusOs) * 100).toFixed(1)) : 0;

      return {
        nome: configuracao.nome,
        quantidade: count,
        percentual,
        cor: configuracao.cor,
      };
    })
    .sort((a: { quantidade: number }, b: { quantidade: number }) => b.quantidade - a.quantidade);
}

export async function obterAtividadesRecentesDashboard(): Promise<AtividadesDashboardInicial> {
  await exigirSessao();
  const { vendaDelegate, ordemServicoDelegate, parcelaDespesaDelegate } = obterDelegatesDashboard();

  const [rawVendasRecentes, rawDespesasRecentes, rawOsRecentes] = await Promise.all([
    vendaDelegate.findMany({
      take: 5,
      orderBy: { criadoEm: "desc" },
      where: {
        OR: [
          { cliente: { is: null } },
          { cliente: { is: { papel: "CLIENTE" } } },
        ],
      },
      select: {
        id: true,
        valorTotal: true,
        criadoEm: true,
        cliente: { select: { nomeRazaoSocial: true } },
      },
    }),
    parcelaDespesaDelegate.findMany({
      take: 5,
      orderBy: { criadoEm: "desc" },
      where: {
        OR: [
          { despesa: { cliente: { is: null } } },
          { despesa: { cliente: { is: { papel: "FORNECEDOR" } } } },
        ],
      },
      select: {
        id: true,
        valor: true,
        criadoEm: true,
        status: true,
        numeroParcela: true,
        despesa: {
          select: {
            descricao: true,
            fornecedor: true,
          },
        },
      },
    }),
    ordemServicoDelegate.findMany({
      take: 5,
      orderBy: { criadoEm: "desc" },
      where: {
        excluidaEm: null,
      },
      select: {
        id: true,
        numeroOs: true,
        equipamento: true,
        criadoEm: true,
        status: true,
        cliente: { select: { nomeRazaoSocial: true } },
      },
    }),
  ]);

  const vendasRecentes = rawVendasRecentes as DashboardVendaRecenteRow[];
  const despesasRecentes = rawDespesasRecentes as DashboardDespesaRecenteRow[];
  const osRecentes = rawOsRecentes as DashboardOsRecenteRow[];

  const atividadesVendas: AtividadeRecenteDashboard[] = vendasRecentes.map((venda) => ({
    id: `VENDA-${String(venda.id)}`,
    tipo: "VENDA",
    descricao: `Venda PDV${venda.cliente?.nomeRazaoSocial ? ` - ${String(venda.cliente.nomeRazaoSocial)}` : ""}`,
    valor: Number(venda.valorTotal ?? 0),
    data: new Date(venda.criadoEm),
    status: "RECEBIDO",
    cliente: venda.cliente?.nomeRazaoSocial ? String(venda.cliente.nomeRazaoSocial) : undefined,
  }));

  const atividadesDespesas: AtividadeRecenteDashboard[] = despesasRecentes.map((parcela) => ({
    id: `DESPESA-${String(parcela.id)}`,
    tipo: "DESPESA",
    descricao: parcela.despesa?.descricao
      ? `${String(parcela.despesa.descricao)} (Parcela ${String(parcela.numeroParcela)})`
      : `Despesa (Parcela ${String(parcela.numeroParcela)})`,
    valor: Number(parcela.valor ?? 0) * -1,
    data: new Date(parcela.criadoEm),
    status: String(parcela.status ?? "PENDENTE"),
    cliente: parcela.despesa?.fornecedor ? String(parcela.despesa.fornecedor) : undefined,
  }));

  const atividadesOs: AtividadeRecenteDashboard[] = osRecentes.map((os) => ({
    id: `OS-${String(os.id)}`,
    tipo: "OS",
    descricao: `OS #${String(os.numeroOs)} - ${String(os.equipamento ?? "Equipamento")}`,
    valor: 0,
    data: new Date(os.criadoEm),
    status: String(os.status),
    cliente: os.cliente?.nomeRazaoSocial ? String(os.cliente.nomeRazaoSocial) : undefined,
  }));

  const chaves = new Set<string>();

  return [...atividadesVendas, ...atividadesDespesas, ...atividadesOs]
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .filter((item) => {
      const chave = `${item.tipo}-${item.descricao}-${item.data.toISOString().slice(0, 16)}`;
      if (chaves.has(chave)) {
        return false;
      }

      chaves.add(chave);
      return true;
    })
    .slice(0, 5);
}

export async function obterDadosDashboardInicial(): Promise<DadosDashboardInicial> {
  await exigirSessao();
  const [metricas, faturamentoUltimos6Meses, statusOs, atividadesRecentes] = await Promise.all([
    obterMetricasDashboardInicial(),
    obterFaturamentoUltimos6MesesDashboard(),
    obterStatusOsDashboard(),
    obterAtividadesRecentesDashboard(),
  ]);

  return {
    metricas,
    faturamentoUltimos6Meses,
    statusOs,
    atividadesRecentes,
  };
}