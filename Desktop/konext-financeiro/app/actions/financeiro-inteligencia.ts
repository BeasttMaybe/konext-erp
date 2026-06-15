"use server";

import { prisma } from "@/lib/prisma";

export type FiltroDataAnalitico = "HOJE" | "SEMANAL" | "MENSAL" | "ANUAL" | "CUSTOMIZADO";

export interface DadoSerieComparativa {
  eixo: string;
  faturamento: number;
  despesas: number;
}

export interface DadoFonteReceita {
  nome: string;
  valor: number;
}

export interface DadoTopGasto {
  nome: string;
  valor: number;
}

export interface DadoTopCliente {
  nome: string;
  valor: number;
}

export interface DadoCurvaAbcProduto {
  nome: string;
  valor: number;
}

export interface DadoPrevisaoCaixa {
  eixo: string;
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoProjetado: number;
}

export interface DadosAnaliticosFinanceiros {
  periodo: {
    inicio: Date;
    fim: Date;
    filtroData: FiltroDataAnalitico;
  };
  indicadores: {
    faturamentoBruto: number;
    cmv: number;
    despesasTotais: number;
    faturamentoLiquido: number;
    saldoPrevisto: number;
    receitaRecorrenteMensal: number;
    margemLucroMedia: number;
    pontoEquilibrioPercentual: number;
    pontoEquilibrioAtingido: boolean;
  };
  serieFaturamentoDespesas: DadoSerieComparativa[];
  fontesReceita: DadoFonteReceita[];
  topGastos: DadoTopGasto[];
  topClientes: DadoTopCliente[];
  curvaAbcProdutos: DadoCurvaAbcProduto[];
  previsaoCaixa: DadoPrevisaoCaixa[];
}

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

function inicioDoDia(data: Date): Date {
  const nova = new Date(data);
  nova.setHours(0, 0, 0, 0);
  return nova;
}

function fimDoDia(data: Date): Date {
  const nova = new Date(data);
  nova.setHours(23, 59, 59, 999);
  return nova;
}

function obterIntervaloDoFiltro(
  filtroData: FiltroDataAnalitico,
  dataInicio?: Date,
  dataFim?: Date
): { inicio: Date; fim: Date } {
  const agora = new Date();
  const hojeInicio = inicioDoDia(agora);
  const hojeFim = fimDoDia(agora);

  if (filtroData === "HOJE") {
    return { inicio: hojeInicio, fim: hojeFim };
  }

  if (filtroData === "SEMANAL") {
    const diaSemana = hojeInicio.getDay();
    const deslocamentoParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicioSemana = new Date(hojeInicio);
    inicioSemana.setDate(inicioSemana.getDate() - deslocamentoParaSegunda);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 6);
    return { inicio: inicioDoDia(inicioSemana), fim: fimDoDia(fimSemana) };
  }

  if (filtroData === "MENSAL") {
    const inicioMes = new Date(hojeInicio.getFullYear(), hojeInicio.getMonth(), 1);
    const fimMes = new Date(hojeInicio.getFullYear(), hojeInicio.getMonth() + 1, 0);
    return { inicio: inicioDoDia(inicioMes), fim: fimDoDia(fimMes) };
  }

  if (filtroData === "ANUAL") {
    const inicioAno = new Date(hojeInicio.getFullYear(), 0, 1);
    const fimAno = new Date(hojeInicio.getFullYear(), 11, 31);
    return { inicio: inicioDoDia(inicioAno), fim: fimDoDia(fimAno) };
  }

  if (filtroData === "CUSTOMIZADO") {
    if (!dataInicio || !dataFim) {
      throw new Error("Informe data inicial e data final para o filtro customizado.");
    }

    const inicioCustom = inicioDoDia(new Date(dataInicio));
    const fimCustom = fimDoDia(new Date(dataFim));

    if (inicioCustom > fimCustom) {
      throw new Error("A data inicial nao pode ser maior que a data final.");
    }

    return { inicio: inicioCustom, fim: fimCustom };
  }

  return { inicio: hojeInicio, fim: hojeFim };
}

function chaveBucket(data: Date, filtro: FiltroDataAnalitico): string {
  if (filtro === "HOJE") {
    return `${String(data.getHours()).padStart(2, "0")}h`;
  }

  if (filtro === "ANUAL") {
    return data.toLocaleDateString("pt-BR", { month: "short" });
  }

  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function montarBucketsBase(inicio: Date, fim: Date, filtro: FiltroDataAnalitico): string[] {
  if (filtro === "HOJE") {
    return Array.from({ length: 24 }, (_, indice) => `${String(indice).padStart(2, "0")}h`);
  }

  if (filtro === "ANUAL") {
    const meses = [
      "jan",
      "fev",
      "mar",
      "abr",
      "mai",
      "jun",
      "jul",
      "ago",
      "set",
      "out",
      "nov",
      "dez",
    ];

    return meses;
  }

  const buckets: string[] = [];
  const cursor = inicioDoDia(inicio);
  const limite = fimDoDia(fim);

  while (cursor <= limite) {
    buckets.push(cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function arredondarPercentual(valor: number): number {
  return Number(valor.toFixed(2));
}

export async function obterDadosAnaliticos(
  filtroData: FiltroDataAnalitico,
  dataInicio?: Date,
  dataFim?: Date
): Promise<DadosAnaliticosFinanceiros> {
  const { inicio, fim } = obterIntervaloDoFiltro(filtroData, dataInicio, dataFim);

  const [
    vendasPeriodo,
    recebimentosPeriodo,
    itensVendaPeriodo,
    parcelasPeriodo,
    recebimentosRecorrentesPeriodo,
    approvedOrdersByClient,
    approvedOrdersByPaymentMethod,
    approvedOrderItemsByProduct,
  ] =
    await Promise.all([
      prisma.venda.findMany({
        where: {
          criadoEm: {
            gte: inicio,
            lte: fim,
          },
          OR: [
            { cliente: { is: null } },
            { cliente: { is: { papel: "CLIENTE" } } },
          ],
        },
        select: {
          id: true,
          valorTotal: true,
          formaPagamento: true,
          criadoEm: true,
        },
      }),
      prisma.contaReceber.findMany({
        where: {
          status: "RECEBIDO",
          dataRecebimento: {
            gte: inicio,
            lte: fim,
          },
          OR: [
            { cliente: { is: null } },
            { cliente: { is: { papel: "CLIENTE" } } },
          ],
        },
        select: {
          valor: true,
          origem: true,
          dataRecebimento: true,
          vendaId: true,
        },
      }),
      prisma.itemVenda.findMany({
        where: {
          venda: {
            criadoEm: {
              gte: inicio,
              lte: fim,
            },
          },
        },
        select: {
          custoUnitario: true,
          quantidade: true,
        },
      }),
      prisma.parcelaDespesa.findMany({
        where: {
          AND: [
            {
              OR: [
                { despesa: { cliente: { is: null } } },
                { despesa: { cliente: { is: { papel: "FORNECEDOR" } } } },
              ],
            },
            {
              OR: [
                {
                  status: "PAGO",
                  dataPagamento: {
                    gte: inicio,
                    lte: fim,
                  },
                },
                {
                  status: "PENDENTE",
                  dataVencimento: {
                    gte: inicio,
                    lte: fim,
                  },
                },
              ],
            },
          ],
        },
        include: {
          despesa: {
            select: {
              descricao: true,
            },
          },
        },
      }),
      prisma.contaReceber.findMany({
        where: {
          status: {
            in: ["PENDENTE", "RECEBIDO"],
          },
          dataVencimento: {
            gte: inicio,
            lte: fim,
          },
          AND: [
            {
              OR: [
                { cliente: { is: null } },
                { cliente: { is: { papel: "CLIENTE" } } },
              ],
            },
            {
              OR: [
                {
                  origem: "CONTRATO_RECORRENTE",
                },
                {
                  descricao: {
                    contains: "clube",
                    mode: "insensitive",
                  },
                },
              ],
            },
          ],
        },
        select: {
          valor: true,
        },
      }),
      prisma.pedidoVenda.groupBy({
        by: ["clienteId"],
        where: {
          status: "APROVADO",
          dataCriacao: {
            gte: inicio,
            lte: fim,
          },
        },
        _sum: {
          total: true,
        },
        orderBy: {
          _sum: {
            total: "desc",
          },
        },
        take: 5,
      }),
      prisma.pedidoVenda.groupBy({
        by: ["formaPagamento"],
        where: {
          status: "APROVADO",
          dataCriacao: {
            gte: inicio,
            lte: fim,
          },
        },
        _sum: {
          total: true,
        },
      }),
      prisma.pedidoVendaItem.groupBy({
        by: ["nome"],
        where: {
          pedido: {
            status: "APROVADO",
            dataCriacao: {
              gte: inicio,
              lte: fim,
            },
          },
        },
        _sum: {
          subtotal: true,
        },
        orderBy: {
          _sum: {
            subtotal: "desc",
          },
        },
        take: 5,
      }),
    ]);

  const topClientIds = approvedOrdersByClient
    .map((group) => group.clienteId)
    .filter((clienteId): clienteId is string => Boolean(clienteId));

  const clientsById = topClientIds.length
    ? await prisma.cliente.findMany({
        where: {
          id: {
            in: topClientIds,
          },
          papel: "CLIENTE",
        },
        select: {
          id: true,
          nomeRazaoSocial: true,
        },
      })
    : [];

  const clientNameById = new Map(
    clientsById.map((client) => [client.id, client.nomeRazaoSocial])
  );

  const faturamentoVendasCentavos = vendasPeriodo.reduce(
    (acumulado, venda) => acumulado + paraCentavos(venda.valorTotal),
    0
  );

  // Receita de Contas a Receber efetivamente recebidas (somente status RECEBIDO)
  const faturamentoContasReceberCentavos = recebimentosPeriodo
    .filter((conta) => !conta.vendaId) // evita duplicidade com vendas PDV que já geram conta
    .reduce((acumulado, conta) => acumulado + paraCentavos(conta.valor), 0);

  const faturamentoBrutoCentavos = faturamentoVendasCentavos + faturamentoContasReceberCentavos;

  const cmvCentavos = itensVendaPeriodo.reduce((acumulado, item) => {
    return acumulado + paraCentavos(item.custoUnitario) * item.quantidade;
  }, 0);

  const despesasTotaisCentavos = parcelasPeriodo.reduce((acumulado, parcela) => {
    return acumulado + paraCentavos(parcela.valor);
  }, 0);

  const receitaRecorrenteMensalCentavos = recebimentosRecorrentesPeriodo.reduce((acumulado, registro) => {
    return acumulado + paraCentavos(registro.valor);
  }, 0);

  const faturamentoLiquidoCentavos = faturamentoBrutoCentavos - despesasTotaisCentavos;
  const margemLucroMedia =
    faturamentoBrutoCentavos > 0
      ? arredondarPercentual((faturamentoLiquidoCentavos / faturamentoBrutoCentavos) * 100)
      : 0;

  const pontoEquilibrioPercentual =
    faturamentoBrutoCentavos > 0
      ? arredondarPercentual((faturamentoBrutoCentavos / Math.max(despesasTotaisCentavos, 1)) * 100)
      : 0;

  const pontoEquilibrioAtingido = faturamentoLiquidoCentavos >= 0;

  const buckets = montarBucketsBase(inicio, fim, filtroData);
  const mapaFaturamento = new Map<string, number>();
  const mapaDespesas = new Map<string, number>();

  for (const venda of vendasPeriodo) {
    const chave = chaveBucket(venda.criadoEm, filtroData);
    mapaFaturamento.set(
      chave,
      (mapaFaturamento.get(chave) ?? 0) + paraCentavos(venda.valorTotal)
    );
  }

  // Adiciona recebimentos manuais (sem vínculo com venda PDV) à série temporal
  for (const conta of recebimentosPeriodo) {
    if (conta.vendaId || !conta.dataRecebimento) continue;
    const chave = chaveBucket(conta.dataRecebimento, filtroData);
    mapaFaturamento.set(chave, (mapaFaturamento.get(chave) ?? 0) + paraCentavos(conta.valor));
  }

  for (const parcela of parcelasPeriodo) {
    const referencia = parcela.status === "PAGO" && parcela.dataPagamento ? parcela.dataPagamento : parcela.dataVencimento;
    const chave = chaveBucket(referencia, filtroData);
    mapaDespesas.set(chave, (mapaDespesas.get(chave) ?? 0) + paraCentavos(parcela.valor));
  }

  const serieFaturamentoDespesas: DadoSerieComparativa[] = buckets.map((bucket) => ({
    eixo: bucket,
    faturamento: paraMoeda(mapaFaturamento.get(bucket) ?? 0),
    despesas: paraMoeda(mapaDespesas.get(bucket) ?? 0),
  }));

  const mapaTopGastos = new Map<string, number>();

  for (const parcela of parcelasPeriodo) {
    const nome = parcela.despesa.descricao;
    mapaTopGastos.set(nome, (mapaTopGastos.get(nome) ?? 0) + paraCentavos(parcela.valor));
  }

  const topGastos: DadoTopGasto[] = Array.from(mapaTopGastos.entries())
    .map(([nome, totalCentavos]) => ({ nome, valor: paraMoeda(totalCentavos) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const topClientes: DadoTopCliente[] = approvedOrdersByClient
    .map((group) => {
      const clientName = group.clienteId
        ? clientNameById.get(group.clienteId)?.trim() || "Cliente nao identificado"
        : "Cliente nao identificado";

      return {
        nome: clientName,
        valor: Number(group._sum.total ?? 0),
      };
    })
    .filter((entry) => entry.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const fontesReceitaPorPedido: DadoFonteReceita[] = approvedOrdersByPaymentMethod
    .map((group) => {
      const paymentMethodLabel = group.formaPagamento
        ? group.formaPagamento.replaceAll("_", " ")
        : "Nao informado";

      return {
        nome: paymentMethodLabel,
        valor: Number(group._sum.total ?? 0),
      };
    })
    .filter((entry) => entry.valor > 0);

  const curvaAbcProdutos: DadoCurvaAbcProduto[] = approvedOrderItemsByProduct
    .map((group) => ({
      nome: group.nome?.trim() || "Item sem descricao",
      valor: Number(group._sum.subtotal ?? 0),
    }))
    .filter((entry) => entry.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const mapaFontesReceitaFinal = new Map<string, number>();

  for (const fonte of fontesReceitaPorPedido) {
    mapaFontesReceitaFinal.set(
      fonte.nome,
      (mapaFontesReceitaFinal.get(fonte.nome) ?? 0) + paraCentavos(fonte.valor)
    );
  }

  for (const conta of recebimentosPeriodo) {
    if (conta.vendaId) continue;
    const sourceName = conta.origem
      ? conta.origem.replaceAll("_", " ")
      : "Recebimento Manual";
    mapaFontesReceitaFinal.set(
      sourceName,
      (mapaFontesReceitaFinal.get(sourceName) ?? 0) + paraCentavos(conta.valor)
    );
  }

  const fontesReceita: DadoFonteReceita[] = Array.from(mapaFontesReceitaFinal.entries())
    .map(([nome, totalCentavos]) => ({ nome, valor: paraMoeda(totalCentavos) }))
    .sort((a, b) => b.valor - a.valor);

  const diasPrevisao = filtroData === "ANUAL" ? 60 : 30;
  const dataBasePrevisao = inicioDoDia(new Date());
  const fimPrevisao = new Date(dataBasePrevisao);
  fimPrevisao.setDate(fimPrevisao.getDate() + diasPrevisao);

  const [receberFuturo, pagarFuturo] = await Promise.all([
    prisma.contaReceber.findMany({
      where: {
        status: "PENDENTE",
        dataVencimento: {
          gte: dataBasePrevisao,
          lte: fimPrevisao,
        },
      },
      select: {
        dataVencimento: true,
        valor: true,
      },
    }),
    prisma.parcelaDespesa.findMany({
      where: {
        status: "PENDENTE",
        dataVencimento: {
          gte: dataBasePrevisao,
          lte: fimPrevisao,
        },
        OR: [
          { despesa: { cliente: { is: null } } },
          { despesa: { cliente: { is: { papel: "FORNECEDOR" } } } },
        ],
      },
      select: {
        dataVencimento: true,
        valor: true,
      },
    }),
  ]);

  const mapaEntradasDiarias = new Map<string, number>();
  const mapaSaidasDiarias = new Map<string, number>();

  for (const item of receberFuturo) {
    const chave = item.dataVencimento.toISOString().slice(0, 10);
    mapaEntradasDiarias.set(chave, (mapaEntradasDiarias.get(chave) ?? 0) + paraCentavos(item.valor));
  }

  for (const item of pagarFuturo) {
    const chave = item.dataVencimento.toISOString().slice(0, 10);
    mapaSaidasDiarias.set(chave, (mapaSaidasDiarias.get(chave) ?? 0) + paraCentavos(item.valor));
  }

  let saldoAcumuladoCentavos = faturamentoLiquidoCentavos;
  const previsaoCaixa: DadoPrevisaoCaixa[] = [];

  for (let indice = 0; indice <= diasPrevisao; indice += 3) {
    const dataPonto = new Date(dataBasePrevisao);
    dataPonto.setDate(dataPonto.getDate() + indice);
    const chave = dataPonto.toISOString().slice(0, 10);

    const entradas = mapaEntradasDiarias.get(chave) ?? 0;
    const saidas = mapaSaidasDiarias.get(chave) ?? 0;
    saldoAcumuladoCentavos += entradas - saidas;

    previsaoCaixa.push({
      eixo: dataPonto.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      entradasPrevistas: paraMoeda(entradas),
      saidasPrevistas: paraMoeda(saidas),
      saldoProjetado: paraMoeda(saldoAcumuladoCentavos),
    });
  }

  const saldoPrevistoCentavos = saldoAcumuladoCentavos;

  return {
    periodo: {
      inicio,
      fim,
      filtroData,
    },
    indicadores: {
      faturamentoBruto: paraMoeda(faturamentoBrutoCentavos),
      cmv: paraMoeda(cmvCentavos),
      despesasTotais: paraMoeda(despesasTotaisCentavos),
      faturamentoLiquido: paraMoeda(faturamentoLiquidoCentavos),
      saldoPrevisto: paraMoeda(saldoPrevistoCentavos),
      receitaRecorrenteMensal: paraMoeda(receitaRecorrenteMensalCentavos),
      margemLucroMedia,
      pontoEquilibrioPercentual,
      pontoEquilibrioAtingido,
    },
    serieFaturamentoDespesas,
    fontesReceita,
    topGastos,
    topClientes,
    curvaAbcProdutos,
    previsaoCaixa,
  };
}
