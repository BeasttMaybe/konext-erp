"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao, obterUsuarioSessao } from "@/lib/auth/sessao";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";

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
  status: "PENDENTE" | "PAGO" | "RECEBIDO" | "ATRASADO" | "RENEGOCIADO";
  formaRecebimento:
    | "PIX"
    | "TED"
    | "BOLETO"
    | "CARTAO_CREDITO"
    | "CARTAO_CREDITO_AVISTA"
    | "CARTAO_CREDITO_PARCELADO"
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
    PAGO: 3,
    RECEBIDO: 4,
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
  const usuario = await exigirSessao();

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

  await prisma.$transaction(async (tx) => {
    await tx.contaReceber.createMany({ data: contas });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:criarContaReceber"),
      {
        acao: ACOES_AUDITORIA.CRIAR,
        entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
        dadosDepois: {
          descricao: input.descricao,
          valorTotal: input.valorTotal,
          clienteId: input.clienteId ?? null,
          qtdParcelas,
          formaRecebimento: input.formaRecebimento,
          parcelamentoId,
        },
      }
    );
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/inteligencia");
  revalidatePath("/");
}

export async function darBaixaConta(id: string, observacaoPagamento?: string) {
  // C1: exige sessao valida antes de registrar recebimento.
  const usuario = await exigirSessao();

  const momentoBaixa = new Date();
  const observacao = observacaoPagamento?.trim() || null;

  await prisma.$transaction(async (tx) => {
    const contaAtual = await tx.contaReceber.findUnique({
      where: { id },
      select: { id: true, parcelamentoId: true, status: true, dataRecebimento: true },
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
      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:darBaixaConta"),
        {
          acao: ACOES_AUDITORIA.FINALIZAR,
          entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
          entidadeId: id,
          dadosAntes: {
            status: contaAtual.status,
            dataRecebimento: contaAtual.dataRecebimento,
          },
          dadosDepois: {
            status: "RECEBIDO",
            dataRecebimento: momentoBaixa,
            observacaoPagamento: observacao,
          },
        }
      );
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

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:darBaixaConta"),
      {
        acao: ACOES_AUDITORIA.FINALIZAR,
        entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
        entidadeId: id,
        dadosAntes: {
          status: contaAtual.status,
          dataRecebimento: contaAtual.dataRecebimento,
        },
        dadosDepois: {
          status: "RECEBIDO",
          dataRecebimento: momentoBaixa,
          observacaoPagamento: observacao,
          parcelamentoId: contaAtual.parcelamentoId,
        },
      }
    );
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/inteligencia");
  revalidatePath("/");
}

// ── Editar Conta a Receber ────────────────────────────────────────────────────

export interface EditarContaReceberInput {
  dataVencimento: Date;
  valor: number;
}

/**
 * Atualiza o vencimento e o valor de uma conta a receber ainda não baixada.
 * Só permite editar contas com status PENDENTE.
 */
export async function editarContaReceber(
  id: string,
  input: EditarContaReceberInput
): Promise<void> {
  await exigirSessao();

  const conta = await prisma.contaReceber.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!conta) throw new Error("Conta não encontrada.");
  if (conta.status === "RECEBIDO") {
    throw new Error("Não é possível editar uma conta já baixada.");
  }

  await prisma.contaReceber.update({
    where: { id },
    data: {
      dataVencimento: input.dataVencimento,
      valor: input.valor,
    },
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/inteligencia");
  revalidatePath("/");
}

// ── Excluir Conta a Receber ───────────────────────────────────────────────────

/**
 * Remove uma conta a receber do banco.
 * Contas vinculadas a vendas não podem ser excluídas manualmente.
 */
export async function excluirContaReceber(id: string): Promise<void> {
  const usuario = await exigirSessao();

  await prisma.$transaction(async (tx) => {
    const conta = await tx.contaReceber.findUnique({
      where: { id },
      select: { id: true, vendaId: true, status: true, valor: true },
    });

    if (!conta) throw new Error("Conta não encontrada.");
    if (conta.vendaId) {
      throw new Error(
        "Esta conta está vinculada a uma venda e não pode ser excluída manualmente."
      );
    }

    // TODO: em migracao futura, priorizar cancelamento/soft-delete para trilha financeira mais robusta.
    await tx.contaReceber.delete({ where: { id } });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-receber.ts:excluirContaReceber"),
      {
        acao: ACOES_AUDITORIA.EXCLUIR_FISICO,
        entidade: ENTIDADES_AUDITORIA.CONTA_RECEBER,
        entidadeId: id,
        dadosAntes: {
          status: conta.status,
          valor: conta.valor,
        },
        dadosDepois: null,
      }
    );
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/inteligencia");
  revalidatePath("/");
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

  // Usa os valores da URL quando presentes; caso contrário, adota o mês/ano atual.
  const hoje = new Date();
  const mesFiltro = filtros?.mes ? parseInt(filtros.mes, 10) : hoje.getMonth() + 1;
  const anoFiltro = filtros?.ano ? parseInt(filtros.ano, 10) : hoje.getFullYear();

  if (!Number.isNaN(mesFiltro) && !Number.isNaN(anoFiltro)) {
    // Início: primeiro dia do mês às 00:00:00.000
    const dataInicio = new Date(anoFiltro, mesFiltro - 1, 1);
    // Fim: último dia do mês às 23:59:59.999 (dia 0 do mês seguinte = último dia do atual)
    const dataFim = new Date(anoFiltro, mesFiltro, 0, 23, 59, 59, 999);

    where.dataVencimento = {
      gte: dataInicio,
      lte: dataFim,
    };
  }

  // Filtro por categoria de cliente
  if (filtros?.categoriaCliente) {
    where.cliente = {
      is: {
        categoria: filtros.categoriaCliente,
      },
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
    PAGO: 3,
    RECEBIDO: 4,
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
    const vencimento = new Date(conta.dataVencimento);
    vencimento.setHours(0, 0, 0, 0);

    if (conta.status === "RECEBIDO") {
      totalRecebido += conta.valor;
    } else if (conta.status === "ATRASADO" || vencimento < hoje) {
      totalAtrasado += conta.valor;
    } else if (conta.status === "PENDENTE" || conta.status === "RENEGOCIADO") {
      totalPendente += conta.valor;
    }
  }

  return { totalPendente, totalAtrasado, totalRecebido, totalPeriodo };
}
