"use server";

import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";

export interface ResumoDashboardFinanceiro {
  totalVendasHoje: number;
  totalPagarHoje: number;
  totalReceberHoje: number;
  saldoPrevisto: number;
  faturamentoCaixaFechadoHoje: number;
}

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

type IntervalosFinanceiros = {
  inicioHoje: Date;
  fimHoje: Date;
  inicioMes: Date;
  fimMes: Date;
};

type DelegateFindMany = {
  findMany: (args: unknown) => Promise<Array<{ valor: number }>>;
};

type DelegateVendaFindMany = {
  findMany: (args: unknown) => Promise<Array<{ valorTotal: number }>>;
};

type ParcelaDespesaBruta = {
  valor: number;
  dataVencimento: Date;
};

type PrismaFinanceiroAny = typeof prisma & {
  parcelaDespesa?: DelegateFindMany;
  ParcelaDespesa?: DelegateFindMany;
  contaReceber?: DelegateFindMany;
  ContaReceber?: DelegateFindMany;
  venda?: DelegateVendaFindMany;
  Venda?: DelegateVendaFindMany;
};

type DelegatesFinanceiros = {
  parcelaDespesaDelegate: DelegateFindMany;
  contaReceberDelegate: DelegateFindMany;
  vendaDelegate: DelegateVendaFindMany | null;
};

function obterIntervalosFinanceiros(): IntervalosFinanceiros {
  const agora = new Date();

  return {
    inicioHoje: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0),
    fimHoje: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999),
    inicioMes: new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0),
    fimMes: new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function obterDelegatesFinanceiros(): DelegatesFinanceiros {
  const prismaAny = prisma as PrismaFinanceiroAny;

  return {
    parcelaDespesaDelegate: obterDelegateFindMany(
      prismaAny,
      ["parcelaDespesa", "ParcelaDespesa"],
      "parcelaDespesa"
    ),
    contaReceberDelegate: obterDelegateFindMany(
      prismaAny,
      ["contaReceber", "ContaReceber"],
      "contaReceber"
    ),
    vendaDelegate: obterDelegateVendaFindMany(prismaAny),
  };
}

function somarValoresCentavos(registros: Array<{ valor: number }>): number {
  return registros.reduce((acc, item) => acc + paraCentavos(Number(item.valor ?? 0)), 0);
}

async function buscarParcelasPagarBrutas(inicio: Date, fim: Date): Promise<ParcelaDespesaBruta[]> {
  const parcelas = await prisma.$queryRaw<Array<{ valor: number; dataVencimento: Date }>>`
    SELECT pd."valor", pd."dataVencimento"
    FROM "ParcelaDespesa" pd
    WHERE pd."status"::text = 'PENDENTE'
      AND pd."dataVencimento" >= ${inicio}
      AND pd."dataVencimento" <= ${fim}
    ORDER BY pd."dataVencimento" ASC
  `;

  return parcelas.map((parcela) => ({
    valor: Number(parcela.valor ?? 0),
    dataVencimento: new Date(parcela.dataVencimento),
  }));
}

async function buscarParcelasPagarAtrasadasBrutas(limite: Date): Promise<ParcelaDespesaBruta[]> {
  const parcelas = await prisma.$queryRaw<Array<{ valor: number; dataVencimento: Date }>>`
    SELECT pd."valor", pd."dataVencimento"
    FROM "ParcelaDespesa" pd
    WHERE pd."status"::text = 'PENDENTE'
      AND pd."dataVencimento" <= ${limite}
    ORDER BY pd."dataVencimento" ASC
  `;

  return parcelas.map((parcela) => ({
    valor: Number(parcela.valor ?? 0),
    dataVencimento: new Date(parcela.dataVencimento),
  }));
}

async function buscarTotalVendasHojeCentavos(): Promise<number> {
  const { inicioHoje, fimHoje } = obterIntervalosFinanceiros();
  const { vendaDelegate } = obterDelegatesFinanceiros();

  if (!vendaDelegate) {
    return 0;
  }

  try {
    const vendasHoje = await vendaDelegate.findMany({
      where: {
        criadoEm: {
          gte: inicioHoje,
          lte: fimHoje,
        },
      },
      select: {
        valorTotal: true,
      },
    });

    return vendasHoje.reduce((acumulado, venda) => {
      return acumulado + paraCentavos(Number(venda.valorTotal ?? 0));
    }, 0);
  } catch {
    const vendasHojeSql = await prisma.$queryRaw<Array<{ valorTotal: number }>>`
      SELECT COALESCE(v."valorTotal", 0) AS "valorTotal"
      FROM "Venda" v
      WHERE v."criadoEm" >= ${inicioHoje}
        AND v."criadoEm" <= ${fimHoje}
    `;

    return vendasHojeSql.reduce((acumulado: number, venda: { valorTotal: number }) => {
      return acumulado + paraCentavos(Number(venda.valorTotal ?? 0));
    }, 0);
  }
}

async function buscarFaturamentoCaixaFechadoHojeCentavos(): Promise<number> {
  const { inicioHoje, fimHoje } = obterIntervalosFinanceiros();
  const { vendaDelegate } = obterDelegatesFinanceiros();

  if (!vendaDelegate) {
    return 0;
  }

  try {
    const vendasCaixaFechadoHoje = await vendaDelegate.findMany({
      where: {
        caixaSession: {
          status: "FECHADO",
          dataFechamento: {
            gte: inicioHoje,
            lte: fimHoje,
          },
        },
        OR: [
          { cliente: { is: null } },
          { cliente: { is: { papel: "CLIENTE" } } },
        ],
      },
      select: {
        valorTotal: true,
      },
    });

    return vendasCaixaFechadoHoje.reduce((acumulado, venda) => {
      return acumulado + paraCentavos(Number(venda.valorTotal ?? 0));
    }, 0);
  } catch {
    const vendasCaixaFechadoHojeSql = await prisma.$queryRaw<Array<{ valorTotal: number }>>`
      SELECT COALESCE(v."valorTotal", 0) AS "valorTotal"
      FROM "Venda" v
      INNER JOIN "CaixaSession" c ON c.id = v."caixaSessionId"
      WHERE c.status::text = 'FECHADO'
        AND c."dataFechamento" >= ${inicioHoje}
        AND c."dataFechamento" <= ${fimHoje}
    `;

    return vendasCaixaFechadoHojeSql.reduce((acumulado: number, venda: { valorTotal: number }) => {
      return acumulado + paraCentavos(Number(venda.valorTotal ?? 0));
    }, 0);
  }
}

export async function obterTotalVendasHoje(): Promise<number> {
  await exigirSessao();
  return paraMoeda(await buscarTotalVendasHojeCentavos());
}

export async function obterFaturamentoCaixaFechadoHoje(): Promise<number> {
  await exigirSessao();
  return paraMoeda(await buscarFaturamentoCaixaFechadoHojeCentavos());
}

export async function obterTotalPagarHoje(): Promise<number> {
  await exigirSessao();
  const { fimHoje } = obterIntervalosFinanceiros();
  const parcelasFornecedor = await buscarParcelasPagarAtrasadasBrutas(fimHoje);

  return paraMoeda(somarValoresCentavos(parcelasFornecedor));
}

export async function obterTotalReceberHoje(): Promise<number> {
  await exigirSessao();
  const { fimHoje } = obterIntervalosFinanceiros();
  const { contaReceberDelegate } = obterDelegatesFinanceiros();

  const contasReceberHoje = await contaReceberDelegate.findMany({
    where: {
      status: "PENDENTE",
      dataVencimento: { lte: fimHoje },
    },
    select: { valor: true },
  });

  return paraMoeda(somarValoresCentavos(contasReceberHoje));
}

export async function obterSaldoPrevisto(): Promise<number> {
  await exigirSessao();
  const { fimMes } = obterIntervalosFinanceiros();
  const { contaReceberDelegate } = obterDelegatesFinanceiros();

  const [parcelasPagarAteFimMes, contasReceberAteFimMes] =
    await Promise.all([
      buscarParcelasPagarAtrasadasBrutas(fimMes),
      contaReceberDelegate.findMany({
        where: {
          status: "PENDENTE",
          dataVencimento: { lte: fimMes },
        },
        select: { valor: true },
      }),
    ]);

  const totalReceberSaldoCentavos = somarValoresCentavos(contasReceberAteFimMes);
  const totalPagarSaldoCentavos = somarValoresCentavos(parcelasPagarAteFimMes);

  return paraMoeda(totalReceberSaldoCentavos - totalPagarSaldoCentavos);
}

function obterDelegateFindMany(
  clientePrisma: PrismaFinanceiroAny,
  chaves: Array<keyof PrismaFinanceiroAny>,
  nomeLogico: string
): DelegateFindMany {
  for (const chave of chaves) {
    const delegate = clientePrisma[chave] as DelegateFindMany | undefined;
    if (delegate?.findMany) {
      return delegate;
    }
  }

  throw new Error(`Delegate Prisma '${nomeLogico}' nao disponivel para consulta findMany.`);
}

function obterDelegateVendaFindMany(clientePrisma: PrismaFinanceiroAny): DelegateVendaFindMany | null {
  const delegateLower = clientePrisma.venda;
  if (typeof delegateLower?.findMany === "function") return delegateLower;

  const delegateUpper = clientePrisma.Venda;
  if (typeof delegateUpper?.findMany === "function") return delegateUpper;

  return null;
}

export async function obterResumoDashboardFinanceiro(): Promise<ResumoDashboardFinanceiro> {
  await exigirSessao();
  const [
    totalVendasHoje,
    totalPagarHoje,
    totalReceberHoje,
    saldoPrevisto,
    faturamentoCaixaFechadoHoje,
  ] = await Promise.all([
    obterTotalVendasHoje(),
    obterTotalPagarHoje(),
    obterTotalReceberHoje(),
    obterSaldoPrevisto(),
    obterFaturamentoCaixaFechadoHoje(),
  ]);

  return {
    totalVendasHoje,
    totalPagarHoje,
    totalReceberHoje,
    saldoPrevisto,
    faturamentoCaixaFechadoHoje,
  };
}
