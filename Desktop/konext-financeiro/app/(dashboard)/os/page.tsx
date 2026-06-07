import { DashboardOS } from "@/components/os/dashboard-os";
import { prisma } from "@/lib/prisma";
import type { OrdemServico, StatusOS, TipoPecaOrcamento } from "@/types/os";

export const metadata = {
  title: "Ordem de Serviço - Konext ERP",
  description: "Gerenciar ordens de serviço e manutenção",
};

function formatarNumeroOS(numero: number): string {
  return `OS-${String(new Date().getFullYear())}-${String(numero).padStart(3, "0")}`;
}

export default async function OSPage() {
  const prismaAny = prisma as any;
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!ordemServicoDelegate?.findMany) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  const ordensBanco = await ordemServicoDelegate.findMany({
    include: {
      cliente: {
        select: {
          id: true,
          nomeRazaoSocial: true,
        },
      },
      itens: true,
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  const ordensServico: OrdemServico[] = ordensBanco.map((ordem: any) => {
    const itensOrcamento = (ordem.itens ?? []).map((item: any) => ({
      id: String(item.id),
      tipo: String(item.tipoPeca ?? item.tipo ?? "OUTROS") as TipoPecaOrcamento,
      descricao: String(item.descricao ?? ""),
      custoPeca: Number(item.custoPeca ?? 0),
      valorCobrado: Number(item.valorCobrado ?? 0),
    }));

    const totalOrcamento = itensOrcamento.reduce((total: number, item: { valorCobrado: number }) => total + item.valorCobrado, 0);

    return {
      id: String(ordem.id),
      numeroOS: formatarNumeroOS(Number(ordem.numeroOs ?? 0)),
      clienteId: String(ordem.clienteId),
      nomeCliente: String(ordem.cliente?.nomeRazaoSocial ?? "Cliente nao informado"),
      equipamento: String(ordem.equipamento ?? "Nao informado"),
      marca: ordem.marca ? String(ordem.marca) : undefined,
      modelo: ordem.modelo ? String(ordem.modelo) : undefined,
      imei: ordem.imei ? String(ordem.imei) : undefined,
      senha: ordem.senha ? String(ordem.senha) : undefined,
      senhaDesenho: ordem.senhaDesenho ? String(ordem.senhaDesenho) : undefined,
      checklist: {
        relatoCliente: String(ordem.relatoCliente ?? ""),
        condicaoFisica: String(ordem.condicaoFisica ?? ""),
        acessorios: String(ordem.acessorios ?? ""),
      },
      itensOrcamento,
      totalOrcamento,
      status: String(ordem.status) as StatusOS,
      observacoesInternas: ordem.observacoes ? String(ordem.observacoes) : undefined,
      dataCriacao: new Date(ordem.criadoEm).toISOString(),
      dataAtualizacao: new Date(ordem.atualizadoEm).toISOString(),
    };
  });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Header Section */}
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
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
            <DashboardOS ordensServico={ordensServico} />
          </div>
        </div>
      </div>
    </div>
  );
}
