import { DashboardOS } from "@/components/os/dashboard-os";
import { obterDadosDashboardOS } from "@/app/actions/os";
import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { listarGarantiasOS, obterDashboardGarantiasOS, type DashboardGarantiasOS, type LinhaGarantiaOS } from "@/app/actions/garantias";

export const metadata = {
  title: "Ordem de Serviço - Konext ERP",
  description: "Gerenciar ordens de serviço e manutenção",
};

const DASHBOARD_GARANTIAS_VAZIO: DashboardGarantiasOS = {
  garantiasAtivas: 0,
  vencemEm7Dias: 0,
  garantiasVencidas: 0,
  comRetorno: 0,
  taxaRetorno: 0,
  valorEmGarantia: 0,
  retornosEmConserto: 0,
  principaisServicosEmRetorno: [],
  pecasComMaisRetorno: [],
};

const FILTROS_GARANTIAS_INICIAIS = {
  busca: "",
  status: "TODAS" as const,
  retorno: "TODAS" as const,
  pagina: 1,
  tamanhoPagina: 20,
};

export default async function OSPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const clienteIdInicial = params.clienteId ?? null;
  const modoParam = String(params.modo ?? "").toLowerCase();
  // "excluidas" e o link antigo de uma aba propria — vira o filtro de
  // excluidas ja ligado dentro da aba Finalizadas (Fase 1C-3, Parte 5).
  const modoInicial =
    modoParam === "lista" || modoParam === "excluidas"
      ? "LISTA_FINALIZADAS"
      : modoParam === "garantia"
        ? "GARANTIA"
        : "KANBAN";
  const mostrarExcluidasInicial = modoParam === "excluidas";

  const [dadosDashboard, configuracoes, dashboardGarantias, listagemGarantias] = await Promise.all([
    obterDadosDashboardOS(),
    obterConfiguracoes(),
    obterDashboardGarantiasOS().catch(() => DASHBOARD_GARANTIAS_VAZIO),
    listarGarantiasOS(FILTROS_GARANTIAS_INICIAIS),
  ]);

  const linhasGarantiasIniciais: LinhaGarantiaOS[] = listagemGarantias.sucesso ? listagemGarantias.dados : [];
  const erroGarantiasInicial = listagemGarantias.sucesso ? null : listagemGarantias.erro;

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
              mostrarExcluidasInicial={mostrarExcluidasInicial}
              prazoGarantiaPadraoDias={configuracoes.prazoGarantiaPadraoDias}
              prazoMinimoGarantiaDias={configuracoes.prazoMinimoGarantiaDias}
              prazoMaximoGarantiaDias={configuracoes.prazoMaximoGarantiaDias}
              dashboardGarantiasInicial={dashboardGarantias}
              linhasGarantiasIniciais={linhasGarantiasIniciais}
              erroGarantiasInicial={erroGarantiasInicial}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
