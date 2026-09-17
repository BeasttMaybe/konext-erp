import { DashboardOS } from "@/components/os/dashboard-os";
import { obterDadosDashboardOS } from "@/app/actions/os";
import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

export const metadata = {
  title: "Ordem de Serviço - Konext ERP",
  description: "Gerenciar ordens de serviço e manutenção",
};


export default async function OSPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const clienteIdInicial = params.clienteId ?? null;
  const modoParam = String(params.modo ?? "").toLowerCase();
  const modoInicial =
    modoParam === "lista"
      ? "LISTA_FINALIZADAS"
      : modoParam === "excluidas"
        ? "LISTA_EXCLUIDAS"
        : "KANBAN";

  const [dadosDashboard, configuracoes, contexto] = await Promise.all([
    obterDadosDashboardOS(),
    obterConfiguracoes(),
    exigirContextoTenant(),
  ]);

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
              activeOrderServices={dadosDashboard.ordensAtivas}
              archivedOrderServices={dadosDashboard.ordensArquivadas}
              deletedOrderServices={dadosDashboard.ordensExcluidas}
              clienteIdInicial={clienteIdInicial}
              modoInicial={modoInicial}
              papelUsuario={String(contexto.usuarioOperacional.role ?? "")}
              prazoGarantiaPadraoDias={configuracoes.prazoGarantiaPadraoDias}
              prazoMinimoGarantiaDias={configuracoes.prazoMinimoGarantiaDias}
              prazoMaximoGarantiaDias={configuracoes.prazoMaximoGarantiaDias}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
