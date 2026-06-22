"use server";

import { revalidatePath } from "next/cache";
import type { StatusOS, TipoPeca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
// Importação de calcularPrecoVendaPeca removida — preços são definidos manualmente pelo operador.
import { exigirSessao } from "@/lib/auth/sessao";
import { garantirTermoGarantiaPorOS } from "@/app/actions/garantias";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import type { OrdemServico, OrdemServicoExcluida, TipoPecaOrcamento } from "@/types/os";

type ItemEntrada = {
  tipo: TipoPeca;
  descricao: string;
  custoPeca: number;
  valorCobrado?: number;
};

type DadosNovaOS = {
  clienteId: string;
  equipamento: string;
  marca?: string;
  modelo?: string;
  imei?: string;
  senha?: string;
  senhaDesenho?: string;
  relatoCliente: string;
  condicaoFisica?: string;
  acessorios?: string;
  status: StatusOS;
  observacoesInternas?: string;
  itensOrcamento?: ItemEntrada[];
};

type RawItemOS = {
  id?: unknown;
  tipoPeca?: unknown;
  tipo?: unknown;
  descricao?: unknown;
  custoPeca?: unknown;
  valorCobrado?: unknown;
};

type RawOrdemServico = {
  id?: unknown;
  numeroOs?: unknown;
  clienteId?: unknown;
  cliente?: { nomeRazaoSocial?: unknown } | null;
  equipamento?: unknown;
  marca?: unknown;
  modelo?: unknown;
  imei?: unknown;
  senha?: unknown;
  senhaDesenho?: unknown;
  relatoCliente?: unknown;
  condicaoFisica?: unknown;
  acessorios?: unknown;
  status?: unknown;
  ehRetornoGarantia?: unknown;
  osOrigemGarantiaId?: unknown;
  osOrigemGarantia?: { numeroOs?: unknown } | null;
  retornoGarantiaId?: unknown;
  observacoes?: unknown;
  archivedAt?: unknown;
  excluidaEm?: unknown;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
  itens?: RawItemOS[];
};

export type DadosDashboardOS = {
  ordensAtivas: OrdemServico[];
  ordensArquivadas: OrdemServico[];
  ordensExcluidas: OrdemServicoExcluida[];
};

function formatarNumeroOS(numero: number): string {
  return `OS-${String(new Date().getFullYear())}-${String(numero).padStart(3, "0")}`;
}

function normalizarDataISO(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString();

  if (typeof valor === "string" || typeof valor === "number") {
    const data = new Date(valor);
    if (!Number.isNaN(data.getTime())) return data.toISOString();
  }

  return new Date().toISOString();
}

function mapearOrdemServicoDashboard(order: RawOrdemServico): OrdemServico {
  const itensOrcamento = (order.itens ?? []).map((item) => ({
    id: String(item.id),
    tipo: String(item.tipoPeca ?? item.tipo ?? "OUTROS") as TipoPecaOrcamento,
    descricao: String(item.descricao ?? ""),
    custoPeca: Number(item.custoPeca ?? 0),
    valorCobrado: Number(item.valorCobrado ?? 0),
  }));

  const totalOrcamento = itensOrcamento.reduce(
    (total: number, item: { valorCobrado: number }) => total + item.valorCobrado,
    0
  );

  return {
    id: String(order.id),
    numeroOS: formatarNumeroOS(Number(order.numeroOs ?? 0)),
    clienteId: String(order.clienteId),
    nomeCliente: String(order.cliente?.nomeRazaoSocial ?? "Cliente nao informado"),
    equipamento: String(order.equipamento ?? "Nao informado"),
    marca: order.marca ? String(order.marca) : undefined,
    modelo: order.modelo ? String(order.modelo) : undefined,
    imei: order.imei ? String(order.imei) : undefined,
    senha: order.senha ? String(order.senha) : undefined,
    senhaDesenho: order.senhaDesenho ? String(order.senhaDesenho) : undefined,
    checklist: {
      relatoCliente: String(order.relatoCliente ?? ""),
      condicaoFisica: String(order.condicaoFisica ?? ""),
      acessorios: String(order.acessorios ?? ""),
    },
    itensOrcamento,
    totalOrcamento,
    status: String(order.status) as StatusOS,
    ehRetornoGarantia: Boolean(order.ehRetornoGarantia),
    osOrigemGarantiaId: order.osOrigemGarantiaId ? String(order.osOrigemGarantiaId) : undefined,
    numeroOSOrigemGarantia:
      order.osOrigemGarantia?.numeroOs !== undefined && order.osOrigemGarantia?.numeroOs !== null
        ? formatarNumeroOS(Number(order.osOrigemGarantia.numeroOs))
        : undefined,
    retornoGarantiaId: order.retornoGarantiaId ? String(order.retornoGarantiaId) : undefined,
    observacoesInternas: order.observacoes ? String(order.observacoes) : undefined,
    dataCriacao: normalizarDataISO(order.criadoEm),
    dataAtualizacao: normalizarDataISO(order.atualizadoEm),
  };
}

export type ClienteBuscaOS = {
  id: string;
  nomeRazaoSocial: string;
  documento: string;
  telefone: string;
};

type OrdemServicoCreateDelegate = {
  create?: (args: unknown) => Promise<{ id: string }>;
};

type ItemOSCreateManyDelegate = {
  createMany?: (args: unknown) => Promise<unknown>;
};

type OrdemServicoStatusDelegate = {
  update?: (args: unknown) => Promise<unknown>;
  findUnique?: (args: unknown) => Promise<{
    id?: string;
    numeroOs?: number | null;
    status?: string | null;
    archivedAt?: Date | null;
  } | null>;
};

type NotificacaoDelegate = {
  create?: (args: unknown) => Promise<unknown>;
};

type OrdemServicoPedidoItem = {
  valorCobrado?: number | null;
};

type OrdemServicoPedido = {
  id: string;
  clienteId: string;
  status?: string | null;
  numeroOs?: number | null;
  itens?: OrdemServicoPedidoItem[];
};

type OrdemServicoPedidoDelegate = {
  findUnique?: (args: unknown) => Promise<OrdemServicoPedido | null>;
};

type ContaReceberPedidoDelegate = {
  findFirst?: (args: unknown) => Promise<{ vendaId?: string | null } | null>;
};

type VendaCreateDelegate = {
  create?: (args: unknown) => Promise<{ id: string }>;
};

type ContaReceberCreateDelegate = {
  create?: (args: unknown) => Promise<unknown>;
};

const statusValidos: StatusOS[] = [
  "AGUARDANDO_ORCAMENTO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
  "GARANTIA_RETORNO",
  "PRONTO",
  "ENTREGUE",
];

function paraNumero(valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  if (!Number.isFinite(numero)) return 0;
  return numero;
}

function validarPrazoGarantiaDias(valor: unknown): number {
  if (valor === null || valor === undefined || String(valor).trim().length === 0) {
    throw new Error("Informe o prazo de garantia.");
  }

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 365) {
    throw new Error("Informe um prazo de garantia valido.");
  }

  return numero;
}

function archivedAtUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message.includes("archivedAt") || message.includes("Unknown argument") || message.includes("Invalid `ordemServico");
}

export async function buscarClientesOS(termoBusca: string): Promise<ClienteBuscaOS[]> {
  const termo = termoBusca.trim();

  if (termo.length < 2) {
    return [];
  }

  const prismaAny = prisma as typeof prisma & Record<string, unknown>;
  const clienteDelegate = prismaAny.cliente ?? prismaAny.Cliente;

  if (!clienteDelegate?.findMany) {
    throw new Error("Delegate Prisma de Cliente nao disponivel.");
  }

  const clientes = await clienteDelegate.findMany({
    where: {
      papel: "CLIENTE",
      OR: [
        {
          nomeRazaoSocial: {
            contains: termo,
            mode: "insensitive",
          },
        },
        {
          documento: {
            contains: termo,
            mode: "insensitive",
          },
        },
        {
          telefone: {
            contains: termo,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      nomeRazaoSocial: true,
      documento: true,
      telefone: true,
    },
    orderBy: {
      nomeRazaoSocial: "asc",
    },
    take: 15,
  });

  return clientes.map((cliente: { id: string; nomeRazaoSocial: string; documento: string; telefone: string }) => ({
    id: String(cliente.id),
    nomeRazaoSocial: String(cliente.nomeRazaoSocial),
    documento: String(cliente.documento),
    telefone: String(cliente.telefone),
  }));
}

/**
 * Retorna os dados de um cliente pelo ID.
 * Usado para pré-preencher o seletor de cliente na OS quando o clienteId vem via URL.
 */
export async function buscarClientePorId(clienteId: string): Promise<ClienteBuscaOS | null> {
  if (!clienteId) return null;

  const prismaAny = prisma as typeof prisma & Record<string, unknown>;
  const clienteDelegate = prismaAny.cliente ?? prismaAny.Cliente;

  if (!clienteDelegate?.findFirst) return null;

  const cliente = await clienteDelegate.findFirst({
    where: { id: clienteId, papel: "CLIENTE" },
    select: { id: true, nomeRazaoSocial: true, documento: true, telefone: true },
  });

  if (!cliente) return null;

  return {
    id: String(cliente.id),
    nomeRazaoSocial: String(cliente.nomeRazaoSocial),
    documento: String(cliente.documento),
    telefone: String(cliente.telefone),
  };
}

export async function obterDadosDashboardOS(): Promise<DadosDashboardOS> {
  await exigirSessao();

  const prismaAny = prisma as unknown as Record<string, unknown>;
  const ordemServicoDelegate =
    (prismaAny.ordemServico as { findMany?: (args: unknown) => Promise<RawOrdemServico[]> } | undefined) ??
    (prismaAny.OrdemServico as { findMany?: (args: unknown) => Promise<RawOrdemServico[]> } | undefined);

  if (!ordemServicoDelegate?.findMany) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  const includeOrderRelations = {
    cliente: {
      select: {
        id: true,
        nomeRazaoSocial: true,
      },
    },
    itens: true,
    osOrigemGarantia: {
      select: {
        numeroOs: true,
      },
    },
  };

  let ordensAtivasBrutas: RawOrdemServico[] = [];
  let ordensArquivadasBrutas: RawOrdemServico[] = [];
  let ordensExcluidas: OrdemServicoExcluida[] = [];

  try {
    const [ativas, arquivadas, excluidas] = await Promise.all([
      ordemServicoDelegate.findMany({
        where: {
          archivedAt: null,
          excluidaEm: null,
        },
        include: includeOrderRelations,
        orderBy: {
          criadoEm: "desc",
        },
      }),
      ordemServicoDelegate.findMany({
        where: {
          archivedAt: {
            not: null,
          },
          excluidaEm: null,
        },
        include: includeOrderRelations,
        orderBy: {
          atualizadoEm: "desc",
        },
      }),
      listarOrdensServicoExcluidas(),
    ]);

    ordensAtivasBrutas = ativas;
    ordensArquivadasBrutas = arquivadas;
    ordensExcluidas = excluidas.map((item) => ({
      id: item.id,
      numeroOS: formatarNumeroOS(item.numeroOs),
      nomeCliente: item.clienteNome,
      equipamento: item.equipamento,
      totalOrcamento: item.totalOrcamento,
      statusAnterior: item.statusAnterior.replaceAll("_", " "),
      excluidaPor: item.excluidaPorNome,
      motivoExclusao: item.motivoExclusao,
      excluidaEm: item.excluidaEm.toISOString(),
    }));
  } catch (error) {
    if (!archivedAtUnsupported(error)) {
      throw error;
    }

    const [todasOrdens, archiveRows, excluidas] = await Promise.all([
      ordemServicoDelegate.findMany({
        include: includeOrderRelations,
        orderBy: {
          criadoEm: "desc",
        },
      }),
      prisma.$queryRaw<Array<{ id: string; archivedAt: Date | null }>>`
        SELECT id, "archivedAt"
        FROM "OrdemServico"
      `,
      listarOrdensServicoExcluidas(),
    ]);

    const archivedIds = new Set(
      archiveRows.filter((row) => row.archivedAt !== null).map((row) => String(row.id))
    );

    ordensAtivasBrutas = todasOrdens.filter(
      (order) => !archivedIds.has(String(order.id)) && !order.excluidaEm
    );
    ordensArquivadasBrutas = todasOrdens.filter(
      (order) => archivedIds.has(String(order.id)) && !order.excluidaEm
    );
    ordensExcluidas = excluidas.map((item) => ({
      id: item.id,
      numeroOS: formatarNumeroOS(item.numeroOs),
      nomeCliente: item.clienteNome,
      equipamento: item.equipamento,
      totalOrcamento: item.totalOrcamento,
      statusAnterior: item.statusAnterior.replaceAll("_", " "),
      excluidaPor: item.excluidaPorNome,
      motivoExclusao: item.motivoExclusao,
      excluidaEm: item.excluidaEm.toISOString(),
    }));
  }

  return {
    ordensAtivas: ordensAtivasBrutas.map(mapearOrdemServicoDashboard),
    ordensArquivadas: ordensArquivadasBrutas.map(mapearOrdemServicoDashboard),
    ordensExcluidas,
  };
}

export async function criarOrdemServico(dados: DadosNovaOS) {
  // C1: rejeita chamadas nao autenticadas diretamente no backend.
  const usuario = await exigirSessao();

  if (!dados?.clienteId) {
    throw new Error("Selecione um cliente para criar a ordem de servico.");
  }

  if (!dados?.equipamento?.trim()) {
    throw new Error("Informe o equipamento da ordem de servico.");
  }

  if (!dados?.relatoCliente?.trim()) {
    throw new Error("Informe o relato do cliente para criar a ordem de servico.");
  }

  if (!statusValidos.includes(dados.status)) {
    throw new Error("Status da ordem de servico invalido.");
  }

  const itensTratados = (dados.itensOrcamento ?? [])
    .map((item) => {
      const descricao = String(item.descricao ?? "").trim();
      const custoPeca = paraNumero(item.custoPeca);
      const valorCobradoEntrada = paraNumero(item.valorCobrado);

      if (!descricao) return null;
      if (custoPeca < 0) return null;

      // Valor cobrado ao cliente: sempre o informado manualmente, sem markup automático.
      const valorCobrado = valorCobradoEntrada;

      if (valorCobrado <= 0) return null;

      return {
        descricao,
        tipoPeca: item.tipo,
        custoPeca,
        valorCobrado,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoCreateDelegate;
    OrdemServico?: OrdemServicoCreateDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!ordemServicoDelegate?.create) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  const novaOS = await prisma.$transaction(async (tx) => {
    const txAny = tx as typeof tx & {
      ordemServico?: OrdemServicoCreateDelegate;
      OrdemServico?: OrdemServicoCreateDelegate;
      itemOS?: ItemOSCreateManyDelegate;
      ItemOS?: ItemOSCreateManyDelegate;
    };
    const txOrdemServico = txAny.ordemServico ?? txAny.OrdemServico;
    const txItemOS = txAny.itemOS ?? txAny.ItemOS;

    const ordemCriada = await txOrdemServico.create({
      data: {
        clienteId: dados.clienteId,
        equipamento: dados.equipamento.trim(),
        marca: dados.marca?.trim() || null,
        modelo: dados.modelo?.trim() || null,
        imei: dados.imei?.trim() || null,
        senha: dados.senha?.trim() || null,
        senhaDesenho: dados.senhaDesenho?.trim() || null,
        relatoCliente: dados.relatoCliente.trim(),
        condicaoFisica: dados.condicaoFisica?.trim() || null,
        acessorios: dados.acessorios?.trim() || null,
        status: dados.status,
        observacoes: dados.observacoesInternas?.trim() || null,
      },
      select: {
        id: true,
      },
    });

    if (itensTratados.length > 0 && txItemOS?.createMany) {
      await txItemOS.createMany({
        data: itensTratados.map((item) => ({
          osId: ordemCriada.id,
          descricao: item.descricao,
          tipoPeca: item.tipoPeca,
          custoPeca: item.custoPeca,
          valorCobrado: item.valorCobrado,
        })),
      });
    }

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/os.ts:criarOrdemServico"),
      {
        acao: ACOES_AUDITORIA.CRIAR,
        entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
        entidadeId: ordemCriada.id,
        dadosDepois: {
          clienteId: dados.clienteId,
          equipamento: dados.equipamento,
          marca: dados.marca,
          modelo: dados.modelo,
          imei: dados.imei,
          senha: dados.senha,
          senhaDesenho: dados.senhaDesenho,
          relatoCliente: dados.relatoCliente,
          condicaoFisica: dados.condicaoFisica,
          acessorios: dados.acessorios,
          status: dados.status,
          observacoesInternas: dados.observacoesInternas,
          itensOrcamento: itensTratados,
        },
      }
    );

    return ordemCriada;
  });

  revalidatePath("/os");
  revalidatePath(`/os/${novaOS.id}`);
  revalidatePath("/");

  return novaOS;
}

export async function atualizarStatusOrdemServico(osId: string, status: StatusOS) {
  // C1: exige sessao valida antes de alterar dados.
  const usuario = await exigirSessao();

  if (!osId) {
    throw new Error("ID da ordem de servico nao informado.");
  }

  if (!statusValidos.includes(status)) {
    throw new Error("Status da ordem de servico invalido.");
  }

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoStatusDelegate;
    OrdemServico?: OrdemServicoStatusDelegate;
    notificacao?: NotificacaoDelegate;
    Notificacao?: NotificacaoDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!ordemServicoDelegate?.update) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  await prisma.$transaction(async (tx) => {
    const txAny = tx as typeof tx & {
      ordemServico?: OrdemServicoStatusDelegate;
      OrdemServico?: OrdemServicoStatusDelegate;
    };
    const txOrdemServico = txAny.ordemServico ?? txAny.OrdemServico;

    if (!txOrdemServico?.update || !txOrdemServico.findUnique) {
      throw new Error("Delegate Prisma de OrdemServico nao disponivel na transacao.");
    }

    const antes = await txOrdemServico.findUnique({
      where: { id: osId },
      select: { id: true, status: true, archivedAt: true },
    });

    if (!antes?.id) {
      throw new Error("Ordem de servico nao encontrada.");
    }

    try {
      await txOrdemServico.update({
        where: {
          id: osId,
        },
        data: {
          status,
          ...(status !== "ENTREGUE" ? { archivedAt: null } : {}),
        },
      });
    } catch (error) {
      if (!archivedAtUnsupported(error) || status === "ENTREGUE") {
        throw error;
      }

      await tx.$executeRaw`
        UPDATE "OrdemServico"
        SET status = ${status}::"StatusOS",
            "archivedAt" = NULL,
            "atualizadoEm" = NOW()
        WHERE id = ${osId}
      `;
    }

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/os.ts:atualizarStatusOrdemServico"),
      {
        acao: ACOES_AUDITORIA.ATUALIZAR_STATUS,
        entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
        entidadeId: osId,
        dadosAntes: {
          status: antes.status,
          archivedAt: antes.archivedAt,
        },
        dadosDepois: {
          status,
          archivedAt: status === "ENTREGUE" ? antes.archivedAt : null,
        },
      }
    );
  });

  // Cria notificação para status relevantes — falha silenciosa para não bloquear a operação principal.
  const statusComNotificacao: Record<string, { titulo: string; mensagem: (n: number) => string }> = {
    APROVADO:         { titulo: "OS Aprovada",             mensagem: (n) => `A OS #${n} foi aprovada pelo cliente e pode seguir para a manutenção.` },
    AGUARDANDO_PECA:  { titulo: "OS Aguardando Peça",      mensagem: (n) => `A OS #${n} está aguardando chegada de peça para prosseguir.` },
    EM_MANUTENCAO:    { titulo: "OS em Manutenção",        mensagem: (n) => `A OS #${n} está em manutenção pelo técnico.` },
    GARANTIA_RETORNO: { titulo: "OS em Garantia",          mensagem: (n) => `A OS #${n} entrou em fluxo de retorno de garantia.` },
    PRONTO:           { titulo: "OS Pronta para Retirada", mensagem: (n) => `A OS #${n} foi concluída e está pronta para retirada pelo cliente.` },
    ENTREGUE:         { titulo: "OS Entregue",             mensagem: (n) => `A OS #${n} foi entregue ao cliente com sucesso.` },
  };

  const config = statusComNotificacao[status];
  if (config) {
    try {
      const os = await ordemServicoDelegate.findUnique({
        where: { id: osId },
        select: { numeroOs: true },
      });
      const numeroOs = os?.numeroOs ?? osId;

      const notifDelegate = prismaAny.notificacao ?? prismaAny.Notificacao;
      if (notifDelegate?.create) {
        await notifDelegate.create({
          data: {
            titulo: config.titulo,
            mensagem: config.mensagem(Number(numeroOs)),
          },
        });
      }
    } catch {
      // Notificação opcional — não bloqueia a atualização de status em caso de falha.
    }
  }

  revalidatePath("/os");
  revalidatePath(`/os/${osId}`);
  revalidatePath("/");
}

export type FinalizarOrdemServicoInput = {
  osId: string;
  prazoGarantiaDias: number;
};

export async function archiveDeliveredOrderService(input: FinalizarOrdemServicoInput) {
  const usuario = await exigirSessao();
  const orderServiceId = String(input?.osId ?? "").trim();
  const prazoGarantiaDias = validarPrazoGarantiaDias(input?.prazoGarantiaDias);

  if (!orderServiceId) {
    throw new Error("ID da ordem de servico nao informado.");
  }

  const prismaAny = prisma as typeof prisma & Record<string, unknown>;
  const orderServiceDelegate = (prismaAny.ordemServico ?? prismaAny.OrdemServico) as
    | {
        findUnique?: (args: unknown) => Promise<{
          id: string;
          status?: string | null;
          archivedAt?: Date | null;
          excluidaEm?: Date | null;
        } | null>;
        update?: (args: unknown) => Promise<unknown>;
      }
    | undefined;

  if (!orderServiceDelegate?.findUnique || !orderServiceDelegate?.update) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  let orderService: {
    id: string;
    status?: string | null;
    archivedAt?: Date | null;
    excluidaEm?: Date | null;
  } | null = null;

  try {
    orderService = await orderServiceDelegate.findUnique({
      where: {
        id: orderServiceId,
      },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        excluidaEm: true,
      },
    });
  } catch (error) {
    if (!archivedAtUnsupported(error)) {
      throw error;
    }

    const fallbackRows = await prisma.$queryRaw<Array<{
      id: string;
      status: string;
      archivedAt: Date | null;
      excluidaEm: Date | null;
    }>>`
      SELECT id, status::text AS status, "archivedAt", "excluidaEm"
      FROM "OrdemServico"
      WHERE id = ${orderServiceId}
      LIMIT 1
    `;

    orderService = fallbackRows[0] ?? null;
  }

  if (!orderService) {
    throw new Error("Ordem de servico nao encontrada.");
  }

  if (orderService.excluidaEm) {
    throw new Error("Nao e permitido finalizar uma OS excluida.");
  }

  if (String(orderService.status) !== "ENTREGUE") {
    throw new Error("A OS precisa estar com status Entregue antes de ser finalizada.");
  }

  await prisma.$transaction(async (tx) => {
    const txAny = tx as typeof tx & Record<string, unknown>;
    const txOrderServiceDelegate = (txAny.ordemServico ?? txAny.OrdemServico) as
      | {
          update?: (args: unknown) => Promise<unknown>;
        }
      | undefined;

    if (!txOrderServiceDelegate?.update) {
      throw new Error("Delegate Prisma de OrdemServico nao disponivel na transacao.");
    }

    if (!orderService.archivedAt) {
      await txOrderServiceDelegate.update({
        where: {
          id: orderServiceId,
        },
        data: {
          archivedAt: new Date(),
        },
      });
    }

    await garantirTermoGarantiaPorOS(tx, {
      osId: orderServiceId,
      criadoPorId: String(usuario.id),
      prazoGarantiaDias,
    });

    await registrarLogAuditoria(
      tx,
      contextoAuditoriaDoUsuario(usuario, "app/actions/os.ts:archiveDeliveredOrderService"),
      {
        acao: ACOES_AUDITORIA.FINALIZAR,
        entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
        entidadeId: orderServiceId,
        dadosAntes: {
          status: orderService.status,
          archivedAt: orderService.archivedAt,
        },
        dadosDepois: {
          status: orderService.status,
          archivedAt: new Date().toISOString(),
          prazoGarantiaDias,
        },
      }
    );
  });

  revalidatePath("/os");
  revalidatePath("/os/garantias");
  revalidatePath(`/os/${orderServiceId}`);
  revalidatePath(`/os/${orderServiceId}/garantia`);
  revalidatePath("/");
  revalidatePath("/financeiro");

  return {
    success: true,
  };
}

export type ResultadoExcluirOrdemServico =
  | {
      sucesso: true;
      mensagem: string;
    }
  | {
      sucesso: false;
      erro: string;
    };

export type DadosOrdemServicoExcluida = {
  id: string;
  numeroOs: number;
  clienteNome: string;
  equipamento: string;
  totalOrcamento: number;
  statusAnterior: string;
  motivoExclusao: string;
  excluidaEm: Date;
  excluidaPorNome: string;
};

export type EntradaExcluirOrdemServico = {
  osId: string;
  motivoExclusao: string;
};

function normalizarMotivoExclusao(valor: string): string | null {
  const motivo = String(valor ?? "").trim();

  if (motivo.length < 5 || motivo.length > 500) {
    return null;
  }

  return motivo;
}

export async function excluirOrdemServico(input: EntradaExcluirOrdemServico): Promise<ResultadoExcluirOrdemServico> {
  try {
    const usuario = await exigirSessao();

    const idNormalizado = String(input.osId ?? "").trim();
    const motivoNormalizado = normalizarMotivoExclusao(input.motivoExclusao);

    if (!idNormalizado) {
      return {
        sucesso: false,
        erro: "Não foi possível excluir a OS. Tente novamente.",
      };
    }

    if (!motivoNormalizado) {
      return {
        sucesso: false,
        erro: "Informe o motivo da exclusão.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const txAny = tx as typeof tx & Record<string, unknown>;
      const ordemServicoDelegate =
        (txAny.ordemServico as
          | {
              findUnique?: (args: unknown) => Promise<{
                id: string;
                archivedAt?: Date | null;
                excluidaEm?: Date | null;
                status?: string | null;
                excluidaPorId?: string | null;
                numeroOs?: number | null;
              } | null>;
              update?: (args: unknown) => Promise<unknown>;
            }
          | undefined) ??
        (txAny.OrdemServico as
          | {
              findUnique?: (args: unknown) => Promise<{
                id: string;
                archivedAt?: Date | null;
                excluidaEm?: Date | null;
                status?: string | null;
                excluidaPorId?: string | null;
                numeroOs?: number | null;
              } | null>;
              update?: (args: unknown) => Promise<unknown>;
            }
          | undefined);

      if (!ordemServicoDelegate?.findUnique || !ordemServicoDelegate.update) {
        throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
      }

      const osExistente = await ordemServicoDelegate.findUnique({
        where: { id: idNormalizado },
        select: {
          id: true,
          archivedAt: true,
          excluidaEm: true,
          excluidaPorId: true,
          numeroOs: true,
          status: true,
        },
      });

      if (!osExistente?.id) {
        throw new Error("OS inexistente");
      }

      if (osExistente.excluidaEm) {
        throw new Error("OS ja excluida");
      }

      await ordemServicoDelegate.update({
        where: {
          id: idNormalizado,
        },
        data: {
          excluidaEm: new Date(),
          excluidaPorId: String(usuario.id),
          motivoExclusao: motivoNormalizado,
          statusAnterior: String(osExistente.status ?? "AGUARDANDO_ORCAMENTO"),
          archivedAt: new Date(),
          atualizadoEm: new Date(),
        },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/os.ts:excluirOrdemServico"),
        {
          acao: ACOES_AUDITORIA.EXCLUIR_LOGICO,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: idNormalizado,
          dadosAntes: {
            status: osExistente.status,
            excluidaEm: osExistente.excluidaEm,
            archivedAt: osExistente.archivedAt,
          },
          dadosDepois: {
            status: osExistente.status,
            excluidaEm: new Date().toISOString(),
            archivedAt: new Date().toISOString(),
          },
          motivo: motivoNormalizado,
        }
      );
    });

    revalidatePath("/");
    revalidatePath("/os");
    revalidatePath("/os/garantias");
    revalidatePath(`/os/${idNormalizado}`);
    revalidatePath(`/os/${idNormalizado}/garantia`);
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/inteligencia");
    revalidatePath("/pdv");

    return {
      sucesso: true,
      mensagem: "OS excluída com sucesso.",
    };
  } catch (erro) {
    const mensagemInterna = erro instanceof Error ? erro.message : "";

    if (mensagemInterna.includes("OS ja excluida")) {
      return {
        sucesso: false,
        erro: "Esta OS já foi excluída.",
      };
    }

    return {
      sucesso: false,
      erro: "Não foi possível excluir a OS. Tente novamente.",
    };
  }
}

export async function listarOrdensServicoExcluidas(): Promise<DadosOrdemServicoExcluida[]> {
  await exigirSessao();

  try {
    const ordensExcluidas = await prisma.$queryRaw<Array<{
      id: string;
      numeroOs: number;
      equipamento: string;
      statusAnterior: string | null;
      statusAtual: string | null;
      motivoExclusao: string | null;
      excluidaEm: Date;
      clienteNome: string | null;
      excluidaPorNome: string | null;
      totalOrcamento: number | null;
    }>>`
      SELECT
        os.id,
        os."numeroOs",
        os.equipamento,
        os."statusAnterior"::text AS "statusAnterior",
        os.status::text AS "statusAtual",
        os."motivoExclusao",
        os."excluidaEm",
        c."nomeRazaoSocial" AS "clienteNome",
        u.nome AS "excluidaPorNome",
        COALESCE(SUM(i."valorCobrado"), 0) AS "totalOrcamento"
      FROM "OrdemServico" os
      LEFT JOIN "Cliente" c ON c.id = os."clienteId"
      LEFT JOIN "Usuario" u ON u.id = os."excluidaPorId"
      LEFT JOIN "ItemOS" i ON i."osId" = os.id
      WHERE os."excluidaEm" IS NOT NULL
      GROUP BY
        os.id,
        os."numeroOs",
        os.equipamento,
        os."statusAnterior",
        os.status,
        os."motivoExclusao",
        os."excluidaEm",
        c."nomeRazaoSocial",
        u.nome
      ORDER BY os."excluidaEm" DESC
    `;

    return ordensExcluidas.map((os) => ({
      id: String(os.id),
      numeroOs: Number(os.numeroOs ?? 0),
      clienteNome: String(os.clienteNome ?? "Cliente nao informado"),
      equipamento: String(os.equipamento ?? "Nao informado"),
      totalOrcamento: Number(os.totalOrcamento ?? 0),
      statusAnterior: String(os.statusAnterior ?? os.statusAtual ?? "Nao informado"),
      motivoExclusao: String(os.motivoExclusao ?? "Nao informado"),
      excluidaEm: new Date(os.excluidaEm),
      excluidaPorNome: String(os.excluidaPorNome ?? "Usuário não identificado"),
    }));
  } catch {
    return [];
  }
}

export async function gerarPedidoVendaPorOS(osId: string) {
  // C1: exige sessao valida antes de gerar pedido/venda.
  await exigirSessao();

  if (!osId) {
    throw new Error("ID da ordem de servico nao informado.");
  }

  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoPedidoDelegate;
    OrdemServico?: OrdemServicoPedidoDelegate;
    contaReceber?: ContaReceberPedidoDelegate;
    ContaReceber?: ContaReceberPedidoDelegate;
  };
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;
  const contaReceberDelegate = prismaAny.contaReceber ?? prismaAny.ContaReceber;

  if (!ordemServicoDelegate?.findUnique || !contaReceberDelegate?.findFirst) {
    throw new Error("Delegates Prisma necessarios para gerar pedido de venda nao disponiveis.");
  }

  const os = await ordemServicoDelegate.findUnique({
    where: { id: osId },
    select: {
      id: true,
      clienteId: true,
      status: true,
      numeroOs: true,
      itens: {
        select: {
          valorCobrado: true,
        },
      },
    },
  });

  if (!os) {
    throw new Error("Ordem de servico nao encontrada.");
  }

  if (String(os.status) !== "PRONTO") {
    throw new Error("A OS precisa estar com status PRONTO para gerar pedido de venda.");
  }

  const pedidoExistente = await contaReceberDelegate.findFirst({
    where: {
      ordemServicoId: osId,
      origem: "ORDEM_SERVICO",
      vendaId: {
        not: null,
      },
    },
    select: {
      vendaId: true,
    },
  });

  if (pedidoExistente?.vendaId) {
    return {
      vendaId: String(pedidoExistente.vendaId),
      pedidoJaExistia: true,
    };
  }

  const totalPedido = (os.itens ?? []).reduce((acumulado: number, item: OrdemServicoPedidoItem) => {
    const valor = typeof item.valorCobrado === "number" ? item.valorCobrado : Number(item.valorCobrado ?? 0);
    return acumulado + (Number.isFinite(valor) ? valor : 0);
  }, 0);

  if (totalPedido <= 0) {
    throw new Error("Nao foi possivel gerar o pedido: a OS nao possui valor de itens maior que zero.");
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const txAny = tx as typeof tx & {
      venda?: VendaCreateDelegate;
      Venda?: VendaCreateDelegate;
      contaReceber?: ContaReceberCreateDelegate;
      ContaReceber?: ContaReceberCreateDelegate;
    };
    const txVenda = txAny.venda ?? txAny.Venda;
    const txContaReceber = txAny.contaReceber ?? txAny.ContaReceber;

    if (!txVenda?.create || !txContaReceber?.create) {
      throw new Error("Delegates Prisma de venda/contaReceber nao disponiveis para transacao.");
    }

    const novaVenda = await txVenda.create({
      data: {
        clienteId: String(os.clienteId),
        formaPagamento: "PIX",
        valorTotal: totalPedido,
        desconto: 0,
      },
      select: {
        id: true,
      },
    });

    await txContaReceber.create({
      data: {
        descricao: `OS #${String(os.numeroOs)} - Pedido de venda`,
        valor: totalPedido,
        clienteId: String(os.clienteId),
        ordemServicoId: String(os.id),
        vendaId: String(novaVenda.id),
        dataVencimento: new Date(),
        status: "PENDENTE",
        formaRecebimento: "PIX",
        origem: "ORDEM_SERVICO",
        notaFiscalEmitida: false,
      },
    });

    return {
      vendaId: String(novaVenda.id),
      pedidoJaExistia: false,
    };
  });

  revalidatePath("/os");
  revalidatePath(`/os/${osId}`);
  revalidatePath("/");
  revalidatePath("/financeiro");

  return resultado;
}
