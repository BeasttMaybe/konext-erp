import { DashboardOS } from "@/components/os/dashboard-os";
import { prisma } from "@/lib/prisma";
import type { OrdemServico, StatusOS, TipoPecaOrcamento } from "@/types/os";

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
  observacoes?: unknown;
  archivedAt?: unknown;
  criadoEm?: unknown;
  atualizadoEm?: unknown;
  itens?: RawItemOS[];
};

export const metadata = {
  title: "Ordem de Serviço - Konext ERP",
  description: "Gerenciar ordens de serviço e manutenção",
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

function archivedAtUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message.includes("archivedAt") || message.includes("Unknown argument") || message.includes("Invalid `ordemServico");
}

function mapOrderService(order: RawOrdemServico): OrdemServico {
  const budgetItems = (order.itens ?? []).map((item) => ({
    id: String(item.id),
    tipo: String(item.tipoPeca ?? item.tipo ?? "OUTROS") as TipoPecaOrcamento,
    descricao: String(item.descricao ?? ""),
    custoPeca: Number(item.custoPeca ?? 0),
    valorCobrado: Number(item.valorCobrado ?? 0),
  }));

  const budgetTotal = budgetItems.reduce(
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
    itensOrcamento: budgetItems,
    totalOrcamento: budgetTotal,
    status: String(order.status) as StatusOS,
    observacoesInternas: order.observacoes ? String(order.observacoes) : undefined,
    dataCriacao: normalizarDataISO(order.criadoEm),
    dataAtualizacao: normalizarDataISO(order.atualizadoEm),
  };
}

export default async function OSPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const clienteIdInicial = params.clienteId ?? null;

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
  };

  let activeOrdersFromDatabase: RawOrdemServico[] = [];
  let archivedOrdersFromDatabase: RawOrdemServico[] = [];

  try {
    [activeOrdersFromDatabase, archivedOrdersFromDatabase] = await Promise.all([
      ordemServicoDelegate.findMany({
        where: {
          archivedAt: null,
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
        },
        include: includeOrderRelations,
        orderBy: {
          atualizadoEm: "desc",
        },
      }),
    ]);
  } catch (error) {
    if (!archivedAtUnsupported(error)) {
      throw error;
    }

    const [allOrders, archiveRows] = await Promise.all([
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
    ]);

    const archivedIds = new Set(
      archiveRows.filter((row) => row.archivedAt !== null).map((row) => String(row.id))
    );

    activeOrdersFromDatabase = allOrders.filter((order) => !archivedIds.has(String(order.id)));
    archivedOrdersFromDatabase = allOrders.filter((order) => archivedIds.has(String(order.id)));
  }

  const activeOrderServices = activeOrdersFromDatabase.map(mapOrderService);
  const archivedOrderServices = archivedOrdersFromDatabase.map(mapOrderService);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent">
      {/* Header Section */}
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            Ordem de Serviço (OS)
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
            Gerenciar entradas, orçamentos e status de manutenção de equipamentos
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <DashboardOS
              activeOrderServices={activeOrderServices}
              archivedOrderServices={archivedOrderServices}
              clienteIdInicial={clienteIdInicial}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
