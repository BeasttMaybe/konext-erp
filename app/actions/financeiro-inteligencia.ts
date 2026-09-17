"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { obterReceitaPorClientePadrao, obterReceitaTotalPadrao } from "@/lib/dashboard/regras-financeiras";

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

export interface DadoTaxaPagamentoPorForma {
  formaPagamento: string;
  totalBruto: number;
  totalTaxas: number;
  totalLiquido: number;
  percentualMedioTaxa: number;
  quantidade: number;
}

export interface DadoTaxaPagamentoCartaoPorParcela {
  parcelas: number;
  totalBruto: number;
  totalTaxas: number;
  totalLiquido: number;
  percentualMedioTaxa: number;
  quantidade: number;
}

export interface DadosInteligenciaTaxasPagamento {
  totalBruto: number;
  totalTaxas: number;
  totalLiquido: number;
  percentualMedioTaxa: number;
  quantidadePagamentos: number;
  formaMaiorCusto: string | null;
  quantidadePagamentosCartao: number;
  porForma: DadoTaxaPagamentoPorForma[];
  cartaoCreditoPorParcela: DadoTaxaPagamentoCartaoPorParcela[];
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
    pontoEquilibrioSemBase: boolean;
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

function rotuloFormaPagamento(forma: string): string {
  const mapa: Record<string, string> = {
    PIX: "PIX",
    DINHEIRO: "Dinheiro",
    CARTAO_DEBITO: "Cartao de Debito",
    CARTAO_CREDITO: "Cartao de Credito",
    CARTAO_CREDITO_AVISTA: "Cartao de Credito",
    CARTAO_CREDITO_PARCELADO: "Cartao de Credito",
    BOLETO: "Boleto",
    CREDIARIO: "Crediario",
  };

  return mapa[forma] ?? forma.replaceAll("_", " ");
}

export async function obterInteligenciaTaxasPagamento(
  filtroData: FiltroDataAnalitico,
  dataInicio?: Date,
  dataFim?: Date
): Promise<DadosInteligenciaTaxasPagamento> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "dashboard.financeiro");
  const { prisma } = contexto;
  const { inicio, fim } = obterIntervaloDoFiltro(filtroData, dataInicio, dataFim);

  const pagamentos = await prisma.vendaPagamento.findMany({
    where: {
      venda: {
        criadoEm: {
          gte: inicio,
          lte: fim,
        },
      },
    },
    select: {
      formaPagamento: true,
      valorBruto: true,
      valorTaxa: true,
      valorLiquido: true,
      percentualTaxa: true,
      parcelas: true,
    },
  });

  if (pagamentos.length === 0) {
    return {
      totalBruto: 0,
      totalTaxas: 0,
      totalLiquido: 0,
      percentualMedioTaxa: 0,
      quantidadePagamentos: 0,
      formaMaiorCusto: null,
      quantidadePagamentosCartao: 0,
      porForma: [],
      cartaoCreditoPorParcela: [],
    };
  }

  const mapaPorForma = new Map<string, { totalBrutoCentavos: number; totalTaxasCentavos: number; totalLiquidoCentavos: number; quantidade: number }>();
  const mapaCreditoPorParcela = new Map<number, { totalBrutoCentavos: number; totalTaxasCentavos: number; totalLiquidoCentavos: number; quantidade: number }>();

  let totalBrutoCentavos = 0;
  let totalTaxasCentavos = 0;
  let totalLiquidoCentavos = 0;
  let quantidadePagamentosCartao = 0;

  for (const pagamento of pagamentos) {
    const forma = String(pagamento.formaPagamento ?? "NAO_INFORMADO");
    const brutoCentavos = paraCentavos(Number(pagamento.valorBruto ?? 0));
    const taxaCentavos = paraCentavos(Number(pagamento.valorTaxa ?? 0));
    const liquidoCentavos = paraCentavos(Number(pagamento.valorLiquido ?? 0));

    totalBrutoCentavos += brutoCentavos;
    totalTaxasCentavos += taxaCentavos;
    totalLiquidoCentavos += liquidoCentavos;

    const formaAtual = mapaPorForma.get(forma) ?? {
      totalBrutoCentavos: 0,
      totalTaxasCentavos: 0,
      totalLiquidoCentavos: 0,
      quantidade: 0,
    };
    formaAtual.totalBrutoCentavos += brutoCentavos;
    formaAtual.totalTaxasCentavos += taxaCentavos;
    formaAtual.totalLiquidoCentavos += liquidoCentavos;
    formaAtual.quantidade += 1;
    mapaPorForma.set(forma, formaAtual);

    const ehCartaoCredito =
      forma === "CARTAO_CREDITO" ||
      forma === "CARTAO_CREDITO_AVISTA" ||
      forma === "CARTAO_CREDITO_PARCELADO";

    if (ehCartaoCredito) {
      quantidadePagamentosCartao += 1;
      const parcelas = Math.min(12, Math.max(1, Math.trunc(Number(pagamento.parcelas ?? 1))));
      const parcelaAtual = mapaCreditoPorParcela.get(parcelas) ?? {
        totalBrutoCentavos: 0,
        totalTaxasCentavos: 0,
        totalLiquidoCentavos: 0,
        quantidade: 0,
      };
      parcelaAtual.totalBrutoCentavos += brutoCentavos;
      parcelaAtual.totalTaxasCentavos += taxaCentavos;
      parcelaAtual.totalLiquidoCentavos += liquidoCentavos;
      parcelaAtual.quantidade += 1;
      mapaCreditoPorParcela.set(parcelas, parcelaAtual);
    }
  }

  const porForma: DadoTaxaPagamentoPorForma[] = Array.from(mapaPorForma.entries())
    .map(([formaPagamento, agregado]) => {
      const bruto = paraMoeda(agregado.totalBrutoCentavos);
      const taxas = paraMoeda(agregado.totalTaxasCentavos);
      const liquido = paraMoeda(agregado.totalLiquidoCentavos);
      const percentualMedioTaxa = bruto > 0 ? arredondarPercentual((taxas / bruto) * 100) : 0;

      return {
        formaPagamento: rotuloFormaPagamento(formaPagamento),
        totalBruto: bruto,
        totalTaxas: taxas,
        totalLiquido: liquido,
        percentualMedioTaxa,
        quantidade: agregado.quantidade,
      };
    })
    .sort((a, b) => b.totalTaxas - a.totalTaxas);

  const cartaoCreditoPorParcela: DadoTaxaPagamentoCartaoPorParcela[] = Array.from(mapaCreditoPorParcela.entries())
    .map(([parcelas, agregado]) => {
      const bruto = paraMoeda(agregado.totalBrutoCentavos);
      const taxas = paraMoeda(agregado.totalTaxasCentavos);
      const liquido = paraMoeda(agregado.totalLiquidoCentavos);
      const percentualMedioTaxa = bruto > 0 ? arredondarPercentual((taxas / bruto) * 100) : 0;

      return {
        parcelas,
        totalBruto: bruto,
        totalTaxas: taxas,
        totalLiquido: liquido,
        percentualMedioTaxa,
        quantidade: agregado.quantidade,
      };
    })
    .sort((a, b) => a.parcelas - b.parcelas);

  const totalBruto = paraMoeda(totalBrutoCentavos);
  const totalTaxas = paraMoeda(totalTaxasCentavos);
  const totalLiquido = paraMoeda(totalLiquidoCentavos);

  return {
    totalBruto,
    totalTaxas,
    totalLiquido,
    percentualMedioTaxa: totalBruto > 0 ? arredondarPercentual((totalTaxas / totalBruto) * 100) : 0,
    quantidadePagamentos: pagamentos.length,
    formaMaiorCusto: porForma[0]?.formaPagamento ?? null,
    quantidadePagamentosCartao,
    porForma,
    cartaoCreditoPorParcela,
  };
}

export async function obterDadosAnaliticos(
  filtroData: FiltroDataAnalitico,
  dataInicio?: Date,
  dataFim?: Date
): Promise<DadosAnaliticosFinanceiros> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "dashboard.financeiro");
  const { prisma } = contexto;
  const { inicio, fim } = obterIntervaloDoFiltro(filtroData, dataInicio, dataFim);

  const [
    vendasPeriodo,
    recebimentosPeriodo,
    faturamentoBrutoPeriodo,
    itensVendaPeriodo,
    parcelasPeriodo,
    recebimentosRecorrentesPeriodo,
    vendasPorFormaPagamento,
    itensVendaAgrupados,
    topClientes,
  ] =
    await Promise.all([
      prisma.venda.findMany({
        where: {
          criadoEm: {
            gte: inicio,
            lte: fim,
          },
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
          vendaId: null,
          OR: [
            { dataRecebimento: { gte: inicio, lte: fim } },
            {
              AND: [
                { dataRecebimento: null },
                { criadoEm: { gte: inicio, lte: fim } },
              ],
            },
          ],
        },
        select: {
          valor: true,
          origem: true,
          dataRecebimento: true,
        },
      }),
      obterReceitaTotalPadrao(inicio, fim, prisma),
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
          status: { in: ["PENDENTE", "PAGO"] },
          dataVencimento: {
            gte: inicio,
            lte: fim,
          },
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
        select: {
          valor: true,
        },
      }),
      prisma.$queryRaw<Array<{ formaPagamento: string; total: number }>>`
        SELECT base."formaPagamento", COALESCE(SUM(base.valor), 0) AS total
        FROM (
          SELECT vp."formaPagamento"::text AS "formaPagamento", vp."valorBruto"::double precision AS valor
          FROM "VendaPagamento" vp
          INNER JOIN "Venda" v ON v.id = vp."vendaId"
          WHERE v."criadoEm" >= ${inicio}
            AND v."criadoEm" <= ${fim}

          UNION ALL

          SELECT v."formaPagamento"::text AS "formaPagamento", v."valorTotal"::double precision AS valor
          FROM "Venda" v
          WHERE v."criadoEm" >= ${inicio}
            AND v."criadoEm" <= ${fim}
            AND NOT EXISTS (
              SELECT 1 FROM "VendaPagamento" vp2 WHERE vp2."vendaId" = v.id
            )
        ) base
        GROUP BY base."formaPagamento"
      `,
      prisma.itemVenda.groupBy({
        by: ["produtoId", "descricao"],
        where: {
          venda: {
            criadoEm: {
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
      obterReceitaPorClientePadrao(inicio, fim, 5, prisma),
    ]);
  const faturamentoBrutoCentavos = paraCentavos(faturamentoBrutoPeriodo);

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

  const pontoEquilibrioSemBase = despesasTotaisCentavos === 0;
  const pontoEquilibrioPercentual =
    pontoEquilibrioSemBase || faturamentoBrutoCentavos <= 0
      ? 0
      : arredondarPercentual((faturamentoBrutoCentavos / despesasTotaisCentavos) * 100);

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

  // Adiciona recebimentos sem venda vinculada à série temporal
  for (const conta of recebimentosPeriodo) {
    if (!conta.dataRecebimento) continue;
    const chave = chaveBucket(conta.dataRecebimento, filtroData);
    mapaFaturamento.set(chave, (mapaFaturamento.get(chave) ?? 0) + paraCentavos(conta.valor));
  }

  for (const parcela of parcelasPeriodo) {
    const referencia = parcela.dataVencimento;
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

  const topClientesFormatado: DadoTopCliente[] = topClientes;

  const fontesReceitaPorPedido: DadoFonteReceita[] = vendasPorFormaPagamento
    .map((group) => {
      const paymentMethodLabel = group.formaPagamento
        ? group.formaPagamento.replaceAll("_", " ")
        : "Nao informado";

      return {
        nome: paymentMethodLabel,
        valor: Number(group.total ?? 0),
      };
    })
    .filter((entry) => entry.valor > 0);

  const idsProdutosCurva = itensVendaAgrupados
    .map((group) => group.produtoId)
    .filter((id): id is string => Boolean(id));

  const produtosCurva = idsProdutosCurva.length > 0
    ? await prisma.produto.findMany({
      where: { id: { in: idsProdutosCurva } },
      select: { id: true, nome: true },
    })
    : [];

  const nomeProdutoPorId = new Map(produtosCurva.map((produto) => [produto.id, produto.nome]));

  const curvaAbcProdutos: DadoCurvaAbcProduto[] = itensVendaAgrupados
    .map((group) => ({
      nome:
        (group.produtoId ? nomeProdutoPorId.get(group.produtoId) : null) ??
        (group.descricao?.trim() || "Item sem descricao"),
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
      pontoEquilibrioSemBase,
    },
    serieFaturamentoDespesas,
    fontesReceita,
    topGastos,
    topClientes: topClientesFormatado,
    curvaAbcProdutos,
    previsaoCaixa,
  };
}
