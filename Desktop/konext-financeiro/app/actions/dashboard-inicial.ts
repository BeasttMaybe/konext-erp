"use server";

import { prisma } from "@/lib/prisma";

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
    return 100;
  }

  return ((atual - anterior) / anterior) * 100;
};

const formatarMesCurtoPtBr = (data: Date): string => {
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(data);
  const mesSemPonto = mes.replace(".", "");
  return mesSemPonto.charAt(0).toUpperCase() + mesSemPonto.slice(1);
};

const chaveMes = (data: Date): string => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

const mapaStatusOs: Record<string, { nome: string; cor: string }> = {
  AGUARDANDO_ORCAMENTO: { nome: "Aguardando Orçamento", cor: "hsl(43 96% 56%)" },
  AGUARDANDO_APROVACAO: { nome: "Aguardando Aprovação", cor: "hsl(262 83% 58%)" },
  APROVADO: { nome: "Aprovado", cor: "hsl(217 91% 60%)" },
  AGUARDANDO_PECA: { nome: "Aguardando Peça", cor: "hsl(24 95% 53%)" },
  EM_MANUTENCAO: { nome: "Em Manutenção", cor: "hsl(199 89% 48%)" },
  PRONTO: { nome: "Pronto", cor: "hsl(168 76% 42%)" },
  ENTREGUE: { nome: "Entregue", cor: "hsl(142 71% 45%)" },
  CONCLUIDA: { nome: "Concluída", cor: "hsl(142 71% 45%)" },
};

export async function obterDadosDashboardInicial(): Promise<DadosDashboardInicial> {
  const agora = new Date();

  const startOfCurrentMonth = inicioMes(agora);
  const endOfCurrentMonth = fimMes(agora);
  const startOfLastMonth = inicioMes(deslocarMes(agora, -1));
  const endOfLastMonth = fimMes(deslocarMes(agora, -1));
  const startOfSixMonthsWindow = inicioMes(deslocarMes(agora, -5));

  const prismaAny = prisma as any;
  const vendaDelegate = prismaAny.venda ?? prismaAny.Venda;
  const contaReceberDelegate = prismaAny.contaReceber ?? prismaAny.ContaReceber;
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;
  const parcelaDespesaDelegate = prismaAny.parcelaDespesa ?? prismaAny.ParcelaDespesa;

  if (
    !vendaDelegate?.findMany ||
    !contaReceberDelegate?.findMany ||
    !ordemServicoDelegate?.findMany ||
    !ordemServicoDelegate?.groupBy ||
    !parcelaDespesaDelegate?.findMany
  ) {
    throw new Error("Delegates Prisma necessarios para o dashboard inicial nao estao disponiveis.");
  }

  const [
    vendasMesAtual,
    vendasMesAnterior,
    recebimentosMesAtual,
    recebimentosMesAnterior,
    osMesAtualBase,
    osMesAnteriorBase,
    qtdVendasMesAtual,
    qtdVendasMesAnterior,
    vendasClientesMesAtual,
    vendasClientesMesAnterior,
    osClientesMesAtual,
    osClientesMesAnterior,
    vendas6Meses,
    recebimentos6Meses,
    statusOsAgrupado,
    vendasRecentes,
    despesasRecentes,
    osRecentes,
  ] = await Promise.all([
    vendaDelegate.findMany({
      where: { criadoEm: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
      select: { valorTotal: true },
    }),
    vendaDelegate.findMany({
      where: { criadoEm: { gte: startOfLastMonth, lte: endOfLastMonth } },
      select: { valorTotal: true },
    }),
    contaReceberDelegate.findMany({
      where: {
        status: "RECEBIDO",
        OR: [
          { dataRecebimento: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
          {
            AND: [
              { dataRecebimento: null },
              { criadoEm: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
            ],
          },
        ],
      },
      select: { valor: true },
    }),
    contaReceberDelegate.findMany({
      where: {
        status: "RECEBIDO",
        OR: [
          { dataRecebimento: { gte: startOfLastMonth, lte: endOfLastMonth } },
          {
            AND: [
              { dataRecebimento: null },
              { criadoEm: { gte: startOfLastMonth, lte: endOfLastMonth } },
            ],
          },
        ],
      },
      select: { valor: true },
    }),
    ordemServicoDelegate.findMany({
      where: {
        criadoEm: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
      },
      select: { status: true },
    }),
    ordemServicoDelegate.findMany({
      where: {
        criadoEm: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      select: { status: true },
    }),
    vendaDelegate.count({
      where: { criadoEm: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
    }),
    vendaDelegate.count({
      where: { criadoEm: { gte: startOfLastMonth, lte: endOfLastMonth } },
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
      where: { criadoEm: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
      select: { clienteId: true },
      distinct: ["clienteId"],
    }),
    ordemServicoDelegate.findMany({
      where: { criadoEm: { gte: startOfLastMonth, lte: endOfLastMonth } },
      select: { clienteId: true },
      distinct: ["clienteId"],
    }),
    vendaDelegate.findMany({
      where: { criadoEm: { gte: startOfSixMonthsWindow, lte: endOfCurrentMonth } },
      select: { valorTotal: true, criadoEm: true },
    }),
    contaReceberDelegate.findMany({
      where: {
        status: "RECEBIDO",
        OR: [
          { dataRecebimento: { gte: startOfSixMonthsWindow, lte: endOfCurrentMonth } },
          {
            AND: [
              { dataRecebimento: null },
              { criadoEm: { gte: startOfSixMonthsWindow, lte: endOfCurrentMonth } },
            ],
          },
        ],
      },
      select: { valor: true, criadoEm: true, dataRecebimento: true },
    }),
    ordemServicoDelegate.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    vendaDelegate.findMany({
      take: 5,
      orderBy: { criadoEm: "desc" },
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

  const totalVendasAtualCentavos = vendasMesAtual.reduce((acc: number, item: any) => acc + paraCentavos(Number(item.valorTotal ?? 0)), 0);
  const totalVendasAnteriorCentavos = vendasMesAnterior.reduce((acc: number, item: any) => acc + paraCentavos(Number(item.valorTotal ?? 0)), 0);
  const faturamentoAtual = paraMoeda(totalVendasAtualCentavos);
  const faturamentoAnterior = paraMoeda(totalVendasAnteriorCentavos);

  const statusConcluido = new Set(["CONCLUIDA", "CONCLUÍDA", "ENTREGUE", "PRONTO"]);
  const osMesAtual = osMesAtualBase.filter((item: any) => statusConcluido.has(String(item.status))).length;
  const osMesAnterior = osMesAnteriorBase.filter((item: any) => statusConcluido.has(String(item.status))).length;

  const clientesAtivosAtual = new Set<string>([
    ...vendasClientesMesAtual.map((item: any) => String(item.clienteId)),
    ...osClientesMesAtual.map((item: any) => String(item.clienteId)),
  ]).size;

  const clientesAtivosAnterior = new Set<string>([
    ...vendasClientesMesAnterior.map((item: any) => String(item.clienteId)),
    ...osClientesMesAnterior.map((item: any) => String(item.clienteId)),
  ]).size;

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

  vendas6Meses.forEach((venda: any) => {
    const chave = chaveMes(new Date(venda.criadoEm));
    const bucket = indiceMes.get(chave);
    if (!bucket) return;
    bucket.totalCentavos += paraCentavos(Number(venda.valorTotal ?? 0));
  });

  const faturamentoUltimos6Meses = meses.map((mes) => ({
    mes: mes.mes,
    faturamento: paraMoeda(mes.totalCentavos),
  }));

  const totalStatusOs = statusOsAgrupado.reduce((acc: number, item: any) => acc + Number(item._count?.id ?? 0), 0);
  const statusOs = statusOsAgrupado
    .map((item: any) => {
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

  const atividadesVendas: AtividadeRecenteDashboard[] = vendasRecentes.map((venda: any) => ({
    id: `VENDA-${String(venda.id)}`,
    tipo: "VENDA",
    descricao: `Venda PDV${venda.cliente?.nomeRazaoSocial ? ` - ${String(venda.cliente.nomeRazaoSocial)}` : ""}`,
    valor: Number(venda.valorTotal ?? 0),
    data: new Date(venda.criadoEm),
    status: "RECEBIDO",
    cliente: venda.cliente?.nomeRazaoSocial ? String(venda.cliente.nomeRazaoSocial) : undefined,
  }));

  const atividadesDespesas: AtividadeRecenteDashboard[] = despesasRecentes.map((parcela: any) => ({
    id: `DESPESA-${String(parcela.id)}`,
    tipo: "DESPESA",
    descricao: parcela.despesa?.descricao
      ? `${String(parcela.despesa.descricao)} (Parcela ${String(parcela.numeroParcela)})`
      : `Despesa (Parcela ${String(parcela.numeroParcela)})`,
    valor: Number(parcela.valor ?? 0),
    data: new Date(parcela.criadoEm),
    status: String(parcela.status ?? "PENDENTE"),
    cliente: parcela.despesa?.fornecedor ? String(parcela.despesa.fornecedor) : undefined,
  }));

  const atividadesOs: AtividadeRecenteDashboard[] = osRecentes.map((os: any) => ({
    id: `OS-${String(os.id)}`,
    tipo: "OS",
    descricao: `OS #${String(os.numeroOs)} - ${String(os.equipamento ?? "Equipamento")}`,
    valor: 0,
    data: new Date(os.criadoEm),
    status: String(os.status),
    cliente: os.cliente?.nomeRazaoSocial ? String(os.cliente.nomeRazaoSocial) : undefined,
  }));

  const atividadesRecentes = [...atividadesVendas, ...atividadesDespesas, ...atividadesOs]
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .slice(0, 5);

  return {
    metricas: {
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
    },
    faturamentoUltimos6Meses,
    statusOs,
    atividadesRecentes,
  };
}