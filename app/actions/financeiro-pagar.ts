"use server";

import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { escopoDespesa } from "@/lib/auth/escopos";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { paraMensagemSegura } from "@/lib/erros";

/** Ver o comentario equivalente em financeiro-receber.ts (Fase 1B-UI, Parte 1). */
export type ResultadoAcaoDespesa = { sucesso: true } | { sucesso: false; mensagem: string };

export type TipoDespesa = "UNICA" | "PARCELADA" | "FIXA_MENSAL";
export type StatusParcelaDespesa = "PENDENTE" | "PAGO" | "ATRASADO";

export interface DadosCriarDespesa {
  fornecedor: string;
  clienteId?: string;
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
    clienteId: string | null;
    fornecedor: string;
    descricao: string;
    valorTotal: number;
    tipo: TipoDespesa;
    qtdParcelas: number;
    criadoEm: Date;
    atualizadoEm: Date;
    cliente: {
      id: string;
      nomeRazaoSocial: string;
      documento: string;
    } | null;
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

type PrismaFinanceiroPagarAny = Record<string, unknown> & {
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

export async function criarDespesa(data: DadosCriarDespesa): Promise<ResultadoAcaoDespesa> {
  try {
    await criarDespesaInterno(data);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

async function criarDespesaInterno(data: DadosCriarDespesa) {
  // C1: exige sessao valida antes de criar despesa.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.lancar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

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
    const prismaAny = prisma as unknown as PrismaFinanceiroPagarAny;
    const despesaDelegate = obterDelegateDespesaCreate(txAny, prismaAny);
    const parcelaDespesaDelegate = obterDelegateParcelaDespesa(txAny, prismaAny);

    const despesa = await despesaDelegate.create({
      data: {
        fornecedor,
        clienteId: data.clienteId || null,
        descricao,
        valorTotal: data.valorTotal,
        tipo: data.tipo,
        qtdParcelas,
        criadoPorId: usuario.id || null,
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

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-pagar.ts:criarDespesa"),
      {
        acao: ACOES_AUDITORIA.CRIAR,
        entidade: ENTIDADES_AUDITORIA.CONTA_PAGAR,
        entidadeId: despesa.id,
        dadosDepois: {
          fornecedor,
          clienteId: data.clienteId || null,
          descricao,
          valorTotal: data.valorTotal,
          tipo: data.tipo,
          qtdParcelas,
          dataVencimentoBase,
        },
      }
    );

    revalidatePath("/financeiro/pagar");
    revalidatePath("/financeiro");
    revalidatePath("/");

    return despesa;
  });
}

export async function listarParcelasPagar(): Promise<ParcelaDespesaComRelacao[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;
  const prismaAny = prisma as unknown as PrismaFinanceiroPagarAny;
  const parcelaDespesaDelegate = obterDelegateParcelaDespesa(prismaAny, prismaAny);

  const parcelas = await parcelaDespesaDelegate.findMany({
    where: { despesa: { is: escopoDespesa(contexto) } },
    include: {
      despesa: {
        include: {
          cliente: {
            select: {
              id: true,
              nomeRazaoSocial: true,
              documento: true,
            },
          },
        },
      },
    },
    orderBy: {
      dataVencimento: "asc",
    },
  });

  return parcelas as ParcelaDespesaComRelacao[];
}

// ── Tipos e funções para consulta filtrada ──────────────────────────────────

export interface FiltrosPagar {
  mes?: string;
  ano?: string;
  categoriaCliente?: string;
  /** Ignora a janela de mes/ano — todas as parcelas, de qualquer periodo (Fase 3-2D). */
  todoPeriodo?: boolean;
}

export interface ResumoPagar {
  /** Total de parcelas pendentes (não vencidas) */
  totalPendente: number;
  /** Total de parcelas vencidas e não pagas */
  totalAtrasado: number;
  /** Total de parcelas com vencimento no dia de hoje */
  venceHoje: number;
  /** Total de parcelas no mês atual (ou no período filtrado) */
  totalPeriodo: number;
}

/**
 * Retorna as parcelas a pagar com filtros opcionais por período e categoria de cliente.
 * Adequado para chamadas em Server Components (page.tsx).
 *
 * Quando nenhum mês/ano é informado via URL, aplica o mês e ano correntes como padrão,
 * evitando retornar registros de todos os períodos sem filtragem.
 */
export async function listarParcelasPagarFiltradas(
  filtros?: FiltrosPagar
): Promise<ParcelaDespesaComRelacao[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const { prisma } = contexto;

  const where: Record<string, unknown> = {};

  // Usa os valores da URL quando presentes; caso contrário, adota o mês/ano atual.
  // todoPeriodo pula a janela inteira — usado pelos indicadores "em aberto"
  // da Visão geral (Fase 3-2D), que somam parcelas pendentes de qualquer mês.
  if (!filtros?.todoPeriodo) {
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
  }

  // Escopo de visibilidade (Fase 1D-2) + filtro por categoria de cliente,
  // os dois dentro do mesmo `despesa.is` — nunca dois filtros concorrentes
  // na mesma relacao.
  where.despesa = {
    is: {
      ...escopoDespesa(contexto),
      ...(filtros?.categoriaCliente
        ? { cliente: { is: { categoria: filtros.categoriaCliente } } }
        : {}),
    },
  };

  const parcelas = await prisma.parcelaDespesa.findMany({
    where,
    include: {
      despesa: {
        include: {
          cliente: {
            select: {
              id: true,
              nomeRazaoSocial: true,
              documento: true,
            },
          },
        },
      },
    },
    orderBy: { dataVencimento: "asc" },
  });

  return parcelas as unknown as ParcelaDespesaComRelacao[];
}

/**
 * Calcula o resumo financeiro das parcelas a pagar com base nos filtros.
 */
export async function obterResumoPagar(filtros?: FiltrosPagar): Promise<ResumoPagar> {
  const parcelas = await listarParcelasPagarFiltradas(filtros);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  let totalPendente = 0;
  let totalAtrasado = 0;
  let venceHoje = 0;
  let totalPeriodo = 0;

  for (const parcela of parcelas) {
    const venc = new Date(parcela.dataVencimento);
    venc.setHours(0, 0, 0, 0);

    totalPeriodo += parcela.valor;

    if (parcela.status === "PAGO") continue;

    if (parcela.status === "ATRASADO" || venc < hoje) {
      totalAtrasado += parcela.valor;
    } else if (venc.getTime() === hoje.getTime() && parcela.status === "PENDENTE") {
      venceHoje += parcela.valor;
    } else if (parcela.status === "PENDENTE") {
      totalPendente += parcela.valor;
    }
  }

  return { totalPendente, totalAtrasado, venceHoje, totalPeriodo };
}

// ── Pagar Parcela ────────────────────────────────────────────────────────────

export async function pagarParcela(
  parcelaId: string,
  valorPago: number
): Promise<ResultadoAcaoDespesa> {
  try {
    await pagarParcelaInterno(parcelaId, valorPago);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

async function pagarParcelaInterno(parcelaId: string, valorPago: number): Promise<void> {
  // C1: exige sessao valida antes de pagar parcela.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.baixar");
  const prisma = contexto.prisma;
  const usuario = contexto.usuarioOperacional;

  if (!parcelaId) {
    throw new Error("Parcela invalida para pagamento.");
  }

  if (!Number.isFinite(valorPago) || valorPago <= 0) {
    throw new Error("Informe um valor pago valido.");
  }

  const prismaAny = prisma as unknown as PrismaFinanceiroPagarAny;
  await prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as PrismaFinanceiroPagarAny;
    const parcelaDespesaDelegate = obterDelegateParcelaDespesa(txAny, prismaAny);

    const parcelaAntes = await parcelaDespesaDelegate.findMany({
      where: {
        id: parcelaId,
      },
      select: {
        id: true,
        status: true,
        valorPago: true,
        valor: true,
      },
      take: 1,
    });

    if (!parcelaAntes[0]?.id) {
      throw new Error("Parcela nao encontrada para pagamento.");
    }

    const dataPagamento = new Date();

    await parcelaDespesaDelegate.update({
      where: {
        id: parcelaId,
      },
      data: {
        status: "PAGO",
        dataPagamento,
        valorPago,
      },
    });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/financeiro-pagar.ts:pagarParcela"),
      {
        acao: ACOES_AUDITORIA.FINALIZAR,
        entidade: ENTIDADES_AUDITORIA.CONTA_PAGAR,
        entidadeId: parcelaId,
        dadosAntes: {
          status: parcelaAntes[0].status,
          valorPago: parcelaAntes[0].valorPago,
          valor: parcelaAntes[0].valor,
        },
        dadosDepois: {
          status: "PAGO",
          valorPago,
          dataPagamento,
        },
      }
    );
  });

  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/");
}
