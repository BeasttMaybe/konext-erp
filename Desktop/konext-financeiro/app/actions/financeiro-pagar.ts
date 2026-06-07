"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";

export type TipoDespesa = "UNICA" | "PARCELADA" | "FIXA_MENSAL";
export type StatusParcelaDespesa = "PENDENTE" | "PAGO" | "ATRASADO";

export interface DadosCriarDespesa {
  fornecedor: string;
  descricao: string;
  valorTotal: number;
  tipo: TipoDespesa;
  qtdParcelas?: number;
  dataVencimento: Date;
}

export interface ParcelaDespesaComRelacao {
  id: string;
  despesaId: string;
  numeroParcela: number;
  valor: number;
  dataVencimento: Date;
  dataPagamento: Date | null;
  status: StatusParcelaDespesa;
  valorPago: number | null;
  criadoEm: Date;
  despesa: {
    id: string;
    fornecedor: string;
    descricao: string;
    valorTotal: number;
    tipo: TipoDespesa;
    qtdParcelas: number;
    criadoEm: Date;
    atualizadoEm: Date;
  };
}

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

type DelegateDespesaCreate = {
  create: (args: unknown) => Promise<{ id: string }>;
};

type DelegateParcelaDespesa = {
  createMany: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<ParcelaDespesaComRelacao[]>;
  update: (args: unknown) => Promise<unknown>;
};

type PrismaFinanceiroPagarAny = typeof prisma & {
  despesa?: DelegateDespesaCreate;
  Despesa?: DelegateDespesaCreate;
  parcelaDespesa?: DelegateParcelaDespesa;
  ParcelaDespesa?: DelegateParcelaDespesa;
};

function obterDelegateDespesaCreate(
  tx: PrismaFinanceiroPagarAny,
  root: PrismaFinanceiroPagarAny
): DelegateDespesaCreate {
  const candidatos: Array<keyof PrismaFinanceiroPagarAny> = ["despesa", "Despesa"];

  for (const chave of candidatos) {
    const delegateTx = tx[chave] as DelegateDespesaCreate | undefined;
    if (delegateTx?.create) return delegateTx;

    const delegateRoot = root[chave] as DelegateDespesaCreate | undefined;
    if (delegateRoot?.create) return delegateRoot;
  }

  throw new Error("Delegate Prisma 'despesa' nao disponivel para operacao de create.");
}

function obterDelegateParcelaDespesa(
  tx: PrismaFinanceiroPagarAny,
  root: PrismaFinanceiroPagarAny
): DelegateParcelaDespesa {
  const candidatos: Array<keyof PrismaFinanceiroPagarAny> = [
    "parcelaDespesa",
    "ParcelaDespesa",
  ];

  for (const chave of candidatos) {
    const delegateTx = tx[chave] as DelegateParcelaDespesa | undefined;
    if (
      typeof delegateTx?.createMany === "function" &&
      typeof delegateTx?.findMany === "function" &&
      typeof delegateTx?.update === "function"
    )
      return delegateTx;

    const delegateRoot = root[chave] as DelegateParcelaDespesa | undefined;
    if (
      typeof delegateRoot?.createMany === "function" &&
      typeof delegateRoot?.findMany === "function" &&
      typeof delegateRoot?.update === "function"
    )
      return delegateRoot;
  }

  throw new Error(
    "Delegate Prisma 'parcelaDespesa' nao disponivel para operacoes de createMany/findMany/update."
  );
}

function adicionarMeses(dataBase: Date, meses: number): Date {
  return new Date(
    dataBase.getFullYear(),
    dataBase.getMonth() + meses,
    dataBase.getDate(),
    12,
    0,
    0,
    0
  );
}

function normalizarQtdParcelas(tipo: TipoDespesa, qtdParcelas?: number): number {
  if (tipo === "UNICA") return 1;

  if (typeof qtdParcelas !== "number" || Number.isNaN(qtdParcelas)) {
    return tipo === "FIXA_MENSAL" ? 12 : 2;
  }

  return Math.max(1, Math.trunc(qtdParcelas));
}

function gerarParcelas(
  tipo: TipoDespesa,
  valorTotal: number,
  qtdParcelas: number,
  dataVencimentoBase: Date
): Array<{ numeroParcela: number; valor: number; dataVencimento: Date; status: StatusParcelaDespesa }> {
  if (tipo === "UNICA") {
    return [
      {
        numeroParcela: 1,
        valor: valorTotal,
        dataVencimento: dataVencimentoBase,
        status: "PENDENTE",
      },
    ];
  }

  if (tipo === "FIXA_MENSAL") {
    return Array.from({ length: qtdParcelas }, (_, indice) => ({
      numeroParcela: indice + 1,
      valor: valorTotal,
      dataVencimento: adicionarMeses(dataVencimentoBase, indice),
      status: "PENDENTE" as const,
    }));
  }

  const totalCentavos = paraCentavos(valorTotal);
  const parcelaBaseCentavos = Math.floor(totalCentavos / qtdParcelas);
  let restanteCentavos = totalCentavos - parcelaBaseCentavos * qtdParcelas;

  return Array.from({ length: qtdParcelas }, (_, indice) => {
    const acrescimo = restanteCentavos > 0 ? 1 : 0;
    if (restanteCentavos > 0) {
      restanteCentavos -= 1;
    }

    return {
      numeroParcela: indice + 1,
      valor: paraMoeda(parcelaBaseCentavos + acrescimo),
      dataVencimento: adicionarMeses(dataVencimentoBase, indice),
      status: "PENDENTE" as const,
    };
  });
}

export async function criarDespesa(data: DadosCriarDespesa) {
  // C1: exige sessao valida antes de criar despesa.
  await exigirSessao();

  const fornecedor = data.fornecedor.trim();
  const descricao = data.descricao.trim();

  if (!fornecedor) {
    throw new Error("Informe o fornecedor da despesa.");
  }

  if (!descricao) {
    throw new Error("Informe a descricao da despesa.");
  }

  if (!Number.isFinite(data.valorTotal) || data.valorTotal <= 0) {
    throw new Error("Informe um valor total valido.");
  }

  const qtdParcelas = normalizarQtdParcelas(data.tipo, data.qtdParcelas);
  const dataVencimentoBase = new Date(data.dataVencimento);

  if (Number.isNaN(dataVencimentoBase.getTime())) {
    throw new Error("Informe uma data de vencimento valida.");
  }

  return prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as PrismaFinanceiroPagarAny;
    const prismaAny = prisma as PrismaFinanceiroPagarAny;
    const despesaDelegate = obterDelegateDespesaCreate(txAny, prismaAny);
    const parcelaDespesaDelegate = obterDelegateParcelaDespesa(txAny, prismaAny);

    const despesa = await despesaDelegate.create({
      data: {
        fornecedor,
        descricao,
        valorTotal: data.valorTotal,
        tipo: data.tipo,
        qtdParcelas,
      },
    });

    const parcelas = gerarParcelas(data.tipo, data.valorTotal, qtdParcelas, dataVencimentoBase);

    await parcelaDespesaDelegate.createMany({
      data: parcelas.map((parcela) => ({
        despesaId: despesa.id,
        numeroParcela: parcela.numeroParcela,
        valor: parcela.valor,
        dataVencimento: parcela.dataVencimento,
        status: parcela.status,
      })),
    });

    revalidatePath("/financeiro/pagar");
    revalidatePath("/financeiro");

    return despesa;
  });
}

export async function listarParcelasPagar(): Promise<ParcelaDespesaComRelacao[]> {
  const prismaAny = prisma as PrismaFinanceiroPagarAny;
  const parcelaDespesaDelegate = obterDelegateParcelaDespesa(prismaAny, prismaAny);

  const parcelas = await parcelaDespesaDelegate.findMany({
    include: {
      despesa: true,
    },
    orderBy: {
      dataVencimento: "asc",
    },
  });

  return parcelas as ParcelaDespesaComRelacao[];
}

export async function pagarParcela(parcelaId: string, valorPago: number) {
  // C1: exige sessao valida antes de pagar parcela.
  await exigirSessao();

  if (!parcelaId) {
    throw new Error("Parcela invalida para pagamento.");
  }

  if (!Number.isFinite(valorPago) || valorPago <= 0) {
    throw new Error("Informe um valor pago valido.");
  }

  const prismaAny = prisma as PrismaFinanceiroPagarAny;
  const parcelaDespesaDelegate = obterDelegateParcelaDespesa(prismaAny, prismaAny);

  await parcelaDespesaDelegate.update({
    where: {
      id: parcelaId,
    },
    data: {
      status: "PAGO",
      dataPagamento: new Date(),
      valorPago,
    },
  });

  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro");
}
