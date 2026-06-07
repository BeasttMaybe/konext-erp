"use server";

import { prisma } from "@/lib/prisma";

export interface ResumoDashboardFinanceiro {
  totalVendasHoje: number;
  totalPagarHoje: number;
  totalReceberHoje: number;
  saldoPrevisto: number;
  faturamentoCaixaFechadoHoje: number;
}

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

type DelegateFindMany = {
  findMany: (args: unknown) => Promise<Array<{ valor: number }>>;
};

type DelegateVendaFindMany = {
  findMany: (args: unknown) => Promise<Array<{ valorTotal: number }>>;
};

type PrismaFinanceiroAny = typeof prisma & {
  parcelaDespesa?: DelegateFindMany;
  ParcelaDespesa?: DelegateFindMany;
  contaReceber?: DelegateFindMany;
  ContaReceber?: DelegateFindMany;
  venda?: DelegateVendaFindMany;
  Venda?: DelegateVendaFindMany;
};

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
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
  const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);

  const prismaAny = prisma as PrismaFinanceiroAny;
  const parcelaDespesaDelegate = obterDelegateFindMany(
    prismaAny,
    ["parcelaDespesa", "ParcelaDespesa"],
    "parcelaDespesa"
  );
  const contaReceberDelegate = obterDelegateFindMany(
    prismaAny,
    ["contaReceber", "ContaReceber"],
    "contaReceber"
  );
  const vendaDelegate = obterDelegateVendaFindMany(prismaAny);

  const [parcelasPagarHoje, contasReceberHoje, parcelasPagarPendentes, contasReceberPendentes] = await Promise.all([
    parcelaDespesaDelegate.findMany({
      where: {
        status: "PENDENTE",
        dataVencimento: {
          gte: inicioHoje,
          lte: fimHoje,
        },
      },
      select: {
        valor: true,
      },
    }),
    contaReceberDelegate.findMany({
      where: {
        status: "PENDENTE",
        dataVencimento: {
          gte: inicioHoje,
          lte: fimHoje,
        },
      },
      select: {
        valor: true,
      },
    }),
    parcelaDespesaDelegate.findMany({
      where: {
        status: "PENDENTE",
      },
      select: {
        valor: true,
      },
    }),
    contaReceberDelegate.findMany({
      where: {
        status: "PENDENTE",
      },
      select: {
        valor: true,
      },
    }),
  ]);

  let faturamentoCaixaFechadoHojeCentavos = 0;
  let totalVendasHojeCentavos = 0;

  if (vendaDelegate) {
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

      totalVendasHojeCentavos = vendasHoje.reduce((acumulado, venda) => {
        return acumulado + paraCentavos(venda.valorTotal);
      }, 0);

      const vendasCaixaFechadoHoje = await vendaDelegate.findMany({
        where: {
          caixaSession: {
            status: "FECHADO",
            dataFechamento: {
              gte: inicioHoje,
              lte: fimHoje,
            },
          },
        },
        select: {
          valorTotal: true,
        },
      });

      faturamentoCaixaFechadoHojeCentavos = vendasCaixaFechadoHoje.reduce((acumulado, venda) => {
        return acumulado + paraCentavos(venda.valorTotal);
      }, 0);
    } catch {
      const vendasHojeSql = await (prisma as any).$queryRaw<Array<{ valorTotal: number }>>`
        SELECT COALESCE(v."valorTotal", 0) AS "valorTotal"
        FROM "Venda" v
        WHERE v."criadoEm" >= ${inicioHoje}
          AND v."criadoEm" <= ${fimHoje}
      `;

      totalVendasHojeCentavos = vendasHojeSql.reduce((acumulado: number, venda: { valorTotal: number }) => {
        return acumulado + paraCentavos(Number(venda.valorTotal ?? 0));
      }, 0);

      const vendasCaixaFechadoHojeSql = await (prisma as any).$queryRaw<Array<{ valorTotal: number }>>`
        SELECT COALESCE(v."valorTotal", 0) AS "valorTotal"
        FROM "Venda" v
        INNER JOIN "CaixaSession" c ON c.id = v."caixaSessionId"
        WHERE c.status::text = 'FECHADO'
          AND c."dataFechamento" >= ${inicioHoje}
          AND c."dataFechamento" <= ${fimHoje}
      `;

      faturamentoCaixaFechadoHojeCentavos = vendasCaixaFechadoHojeSql.reduce((acumulado: number, venda: { valorTotal: number }) => {
        return acumulado + paraCentavos(Number(venda.valorTotal ?? 0));
      }, 0);
    }
  }

  const totalPagarHojeCentavos = parcelasPagarHoje.reduce((acumulado, conta) => {
    return acumulado + paraCentavos(conta.valor);
  }, 0);

  const totalReceberHojeCentavos = contasReceberHoje.reduce((acumulado, conta) => {
    return acumulado + paraCentavos(conta.valor);
  }, 0);

  const totalPagarPendenteCentavos = parcelasPagarPendentes.reduce((acumulado, conta) => {
    return acumulado + paraCentavos(conta.valor);
  }, 0);

  const totalReceberPendenteCentavos = contasReceberPendentes.reduce((acumulado, conta) => {
    return acumulado + paraCentavos(conta.valor);
  }, 0);

  const saldoPrevistoCentavos =
    totalVendasHojeCentavos + totalReceberPendenteCentavos - totalPagarPendenteCentavos;

  return {
    totalVendasHoje: paraMoeda(totalVendasHojeCentavos),
    totalPagarHoje: paraMoeda(totalPagarHojeCentavos),
    totalReceberHoje: paraMoeda(totalReceberHojeCentavos),
    saldoPrevisto: paraMoeda(saldoPrevistoCentavos),
    faturamentoCaixaFechadoHoje: paraMoeda(faturamentoCaixaFechadoHojeCentavos),
  };
}
