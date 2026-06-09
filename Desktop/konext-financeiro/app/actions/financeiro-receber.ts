"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao, obterUsuarioSessao } from "@/lib/auth/sessao";

function paraCentavos(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100);
}

function paraMoeda(centavos: number) {
  return centavos / 100;
}

function adicionarMeses(dataBase: Date, meses: number) {
  const data = new Date(dataBase);
  const diaOriginal = data.getDate();

  data.setMonth(data.getMonth() + meses, 1);
  const ultimoDiaMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  data.setDate(Math.min(diaOriginal, ultimoDiaMes));

  return data;
}

export interface ContaReceberFinanceiro {
  id: string;
  descricao: string;
  valor: number;
  observacaoLancamento: string | null;
  observacaoPagamento: string | null;
  parcelamentoId: string | null;
  numeroParcela: number;
  totalParcelas: number;
  dataInicio: Date | null;
  dataFinalizacao: Date | null;
  clienteId: string | null;
  vendaId: string | null;
  dataVencimento: Date;
  dataRecebimento: Date | null;
  status: "PENDENTE" | "RECEBIDO" | "ATRASADO" | "RENEGOCIADO";
  formaRecebimento:
    | "PIX"
    | "BOLETO"
    | "CARTAO_CREDITO"
    | "CARTAO_DEBITO"
    | "DINHEIRO"
    | "CREDIARIO"
    | "EMPENHO_PUBLICO";
  cliente: {
    nomeRazaoSocial: string;
  } | null;
}

export async function listarContasReceber(): Promise<ContaReceberFinanceiro[]> {
  // Leitura: sem sessao valida nao expoe dados financeiros.
  const usuario = await obterUsuarioSessao();
  if (!usuario) {
    return [];
  }

  const contas = await prisma.contaReceber.findMany({
    include: {
      cliente: {
        select: {
          nomeRazaoSocial: true,
        },
      },
    },
    orderBy: [{ dataVencimento: "asc" }, { numeroParcela: "asc" }],
  });

  const prioridadePorStatus: Record<ContaReceberFinanceiro["status"], number> = {
    PENDENTE: 0,
    ATRASADO: 1,
    RENEGOCIADO: 2,
    RECEBIDO: 3,
  };

  return contas.sort((a, b) => {
    const prioridadeA = prioridadePorStatus[a.status];
    const prioridadeB = prioridadePorStatus[b.status];

    if (prioridadeA !== prioridadeB) {
      return prioridadeA - prioridadeB;
    }

    return a.dataVencimento.getTime() - b.dataVencimento.getTime();
  });
}

export interface CriarContaReceberInput {
  descricao: string;
  valorTotal: number;
  clienteId?: string;
  qtdParcelas: number;
  dataInicio: Date;
  dataVencimentoPrimeiraParcela: Date;
  formaRecebimento: ContaReceberFinanceiro["formaRecebimento"];
  observacaoLancamento?: string;
}

export async function criarContaReceber(input: CriarContaReceberInput) {
  await exigirSessao();

  const qtdParcelas = Math.max(1, Math.trunc(input.qtdParcelas || 1));
  const valorTotalCentavos = paraCentavos(input.valorTotal);

  if (valorTotalCentavos <= 0) {
    throw new Error("Valor total invalido para criar conta a receber.");
  }

  const valorBaseCentavos = Math.floor(valorTotalCentavos / qtdParcelas);
  const restoCentavos = valorTotalCentavos - valorBaseCentavos * qtdParcelas;
  const parcelamentoId = qtdParcelas > 1 ? crypto.randomUUID() : null;
  const observacaoLancamento = input.observacaoLancamento?.trim() || null;

  const contas = Array.from({ length: qtdParcelas }).map((_, indice) => {
    const valorParcelaCentavos = valorBaseCentavos + (indice < restoCentavos ? 1 : 0);

    return {
      descricao: input.descricao,
      valor: paraMoeda(valorParcelaCentavos),
      clienteId: input.clienteId || null,
      dataVencimento: adicionarMeses(input.dataVencimentoPrimeiraParcela, indice),
      formaRecebimento: input.formaRecebimento,
      origem: "AVULSO" as const,
      status: "PENDENTE" as const,
      observacaoLancamento,
      parcelamentoId,
      numeroParcela: indice + 1,
      totalParcelas: qtdParcelas,
      dataInicio: input.dataInicio,
      dataFinalizacao: null,
    };
  });

  await prisma.contaReceber.createMany({ data: contas });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
}

export async function darBaixaConta(id: string, observacaoPagamento?: string) {
  // C1: exige sessao valida antes de registrar recebimento.
  await exigirSessao();

  const momentoBaixa = new Date();
  const observacao = observacaoPagamento?.trim() || null;

  await prisma.$transaction(async (tx) => {
    const contaAtual = await tx.contaReceber.findUnique({
      where: { id },
      select: { id: true, parcelamentoId: true },
    });

    if (!contaAtual) {
      throw new Error("Conta a receber nao encontrada.");
    }

    await tx.contaReceber.update({
      where: { id },
      data: {
        status: "RECEBIDO",
        dataRecebimento: momentoBaixa,
        observacaoPagamento: observacao,
        dataFinalizacao: contaAtual.parcelamentoId ? null : momentoBaixa,
      },
    });

    if (!contaAtual.parcelamentoId) {
      return;
    }

    const pendentesNoGrupo = await tx.contaReceber.count({
      where: {
        parcelamentoId: contaAtual.parcelamentoId,
        status: {
          not: "RECEBIDO",
        },
      },
    });

    if (pendentesNoGrupo === 0) {
      await tx.contaReceber.updateMany({
        where: {
          parcelamentoId: contaAtual.parcelamentoId,
        },
        data: {
          dataFinalizacao: momentoBaixa,
        },
      });
    }
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
}

// ── Tipos e funções para consulta filtrada ──────────────────────────────────

export interface FiltrosReceber {
  mes?: string;
  ano?: string;
  categoriaCliente?: string;
}

export interface ResumoReceber {
  /** Total de contas pendentes (não vencidas) */
  totalPendente: number;
  /** Total de contas vencidas e não recebidas */
  totalAtrasado: number;
  /** Total de contas recebidas no período */
  totalRecebido: number;
  /** Total geral do período (todos os status) */
  totalPeriodo: number;
}

/**
 * Retorna as contas a receber com filtros opcionais por período e categoria de cliente.
 * Adequado para chamadas em Server Components (page.tsx).
 */
export async function listarContasReceberFiltradas(
  filtros?: FiltrosReceber
): Promise<ContaReceberFinanceiro[]> {
  const usuario = await obterUsuarioSessao();
  if (!usuario) return [];

  const where: Record<string, unknown> = {};

  // Filtro de período por mês e/ou ano
  if (filtros?.mes && filtros?.ano) {
    const mes = parseInt(filtros.mes, 10);
    const ano = parseInt(filtros.ano, 10);
    if (!Number.isNaN(mes) && !Number.isNaN(ano)) {
      where.dataVencimento = {
        gte: new Date(ano, mes - 1, 1),
        lte: new Date(ano, mes, 0, 23, 59, 59, 999),
      };
    }
  } else if (filtros?.ano) {
    const ano = parseInt(filtros.ano, 10);
    if (!Number.isNaN(ano)) {
      where.dataVencimento = {
        gte: new Date(ano, 0, 1),
        lte: new Date(ano, 11, 31, 23, 59, 59, 999),
      };
    }
  }

  // Filtro por categoria de cliente
  if (filtros?.categoriaCliente) {
    where.cliente = {
      categoria: filtros.categoriaCliente,
    };
  }

  const contas = await prisma.contaReceber.findMany({
    where,
    include: {
      cliente: {
        select: { nomeRazaoSocial: true },
      },
    },
    orderBy: [{ dataVencimento: "asc" }, { numeroParcela: "asc" }],
  });

  const prioridadePorStatus: Record<ContaReceberFinanceiro["status"], number> = {
    PENDENTE: 0,
    ATRASADO: 1,
    RENEGOCIADO: 2,
    RECEBIDO: 3,
  };

  return (contas as unknown as ContaReceberFinanceiro[]).sort((a, b) => {
    const pa = prioridadePorStatus[a.status];
    const pb = prioridadePorStatus[b.status];
    if (pa !== pb) return pa - pb;
    return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
  });
}

/**
 * Calcula o resumo financeiro das contas a receber com base nos filtros.
 */
export async function obterResumoReceber(filtros?: FiltrosReceber): Promise<ResumoReceber> {
  const contas = await listarContasReceberFiltradas(filtros);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let totalPendente = 0;
  let totalAtrasado = 0;
  let totalRecebido = 0;
  let totalPeriodo = 0;

  for (const conta of contas) {
    totalPeriodo += conta.valor;

    if (conta.status === "RECEBIDO") {
      totalRecebido += conta.valor;
    } else if (new Date(conta.dataVencimento) < hoje) {
      totalAtrasado += conta.valor;
    } else {
      totalPendente += conta.valor;
    }
  }

  return { totalPendente, totalAtrasado, totalRecebido, totalPeriodo };
}
