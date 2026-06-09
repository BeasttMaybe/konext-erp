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
  const fimHoje    = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);

  // Escopo do mês atual para o Saldo Previsto
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
  const fimMes    = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);

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

  const [
    parcelasPagarHoje,
    contasReceberHoje,
    // Contas em atraso (vencidas antes do início do mês, ainda não pagas)
    parcelasPagarAtrasadas,
    contasReceberAtrasadas,
    // Contas com vencimento no mês atual (pendentes)
    parcelasPagarMes,
    contasReceberMes,
  ] = await Promise.all([
    // A pagar hoje
    parcelaDespesaDelegate.findMany({
      where: { status: "PENDENTE", dataVencimento: { gte: inicioHoje, lte: fimHoje } },
      select: { valor: true },
    }),
    // A receber hoje
    contaReceberDelegate.findMany({
      where: { status: "PENDENTE", dataVencimento: { gte: inicioHoje, lte: fimHoje } },
      select: { valor: true },
    }),
    // A pagar atrasadas (vencidas antes do início do mês atual, não pagas)
    parcelaDespesaDelegate.findMany({
      where: { status: "PENDENTE", dataVencimento: { lt: inicioMes } },
      select: { valor: true },
    }),
    // A receber atrasadas (vencidas antes do início do mês atual, não recebidas)
    contaReceberDelegate.findMany({
      where: { status: "PENDENTE", dataVencimento: { lt: inicioMes } },
      select: { valor: true },
    }),
    // A pagar com vencimento no mês atual
    parcelaDespesaDelegate.findMany({
      where: { status: "PENDENTE", dataVencimento: { gte: inicioMes, lte: fimMes } },
      select: { valor: true },
    }),
    // A receber com vencimento no mês atual
    contaReceberDelegate.findMany({
      where: { status: "PENDENTE", dataVencimento: { gte: inicioMes, lte: fimMes } },
      select: { valor: true },
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

  const totalPagarHojeCentavos = parcelasPagarHoje.reduce(
    (acc, c) => acc + paraCentavos(c.valor), 0
  );
  const totalReceberHojeCentavos = contasReceberHoje.reduce(
    (acc, c) => acc + paraCentavos(c.valor), 0
  );

  // Saldo Previsto = (a receber atrasado + a receber no mês) - (a pagar atrasado + a pagar no mês)
  // Inclui inadimplência acumulada de meses anteriores + posição do mês corrente.
  const totalReceberSaldoCentavos =
    contasReceberAtrasadas.reduce((acc, c) => acc + paraCentavos(c.valor), 0) +
    contasReceberMes.reduce((acc, c) => acc + paraCentavos(c.valor), 0);

  const totalPagarSaldoCentavos =
    parcelasPagarAtrasadas.reduce((acc, c) => acc + paraCentavos(c.valor), 0) +
    parcelasPagarMes.reduce((acc, c) => acc + paraCentavos(c.valor), 0);

  const saldoPrevistoCentavos = totalReceberSaldoCentavos - totalPagarSaldoCentavos;

  return {
    totalVendasHoje: paraMoeda(totalVendasHojeCentavos),
    totalPagarHoje: paraMoeda(totalPagarHojeCentavos),
    totalReceberHoje: paraMoeda(totalReceberHojeCentavos),
    saldoPrevisto: paraMoeda(saldoPrevistoCentavos),
    faturamentoCaixaFechadoHoje: paraMoeda(faturamentoCaixaFechadoHojeCentavos),
  };
}
