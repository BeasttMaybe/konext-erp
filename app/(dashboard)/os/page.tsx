import { DashboardOS } from"@/components/os/dashboard-os";
import { cookies } from "next/headers";

import { modoDaTelaPeloParametro } from "@/lib/dominio/os/modo-da-tela";
import { COOKIE_VISAO_OS, lerVisaoDaOS } from "@/lib/dominio/os/lista-de-os";
import { obterDadosDashboardOS } from"@/app/actions/os";
import { obterConfiguracoes } from"@/app/actions/configuracoes";
import { listarGarantiasOS, obterDashboardGarantiasOS, type DashboardGarantiasOS, type LinhaGarantiaOS } from"@/app/actions/garantias";
import { exigirContextoTenant } from"@/lib/tenant/exigir-contexto-tenant";

export const metadata = {
  title:"Ordem de Serviço - Konext ERP",
  description:"Gerenciar ordens de serviço e manutenção",
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
  busca:"",
  status:"TODAS" as const,
  retorno:"TODAS" as const,
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
  const modoInicial = modoDaTelaPeloParametro(params.modo);
  const visaoInicial = lerVisaoDaOS((await cookies()).get(COOKIE_VISAO_OS)?.value);
  const mostrarExcluidasInicial = String(params.modo ??"").toLowerCase() ==="excluidas";

  const [contexto, dadosDashboard, configuracoes, dashboardGarantias, listagemGarantias] = await Promise.all([
    exigirContextoTenant(),
    obterDadosDashboardOS(),
    obterConfiguracoes(),
    obterDashboardGarantiasOS().catch(() => DASHBOARD_GARANTIAS_VAZIO),
    listarGarantiasOS(FILTROS_GARANTIAS_INICIAIS),
  ]);

  const linhasGarantiasIniciais: LinhaGarantiaOS[] = listagemGarantias.sucesso ? listagemGarantias.dados : [];
  const erroGarantiasInicial = listagemGarantias.sucesso ? null : listagemGarantias.erro;

  return (
    <div className="w-full bg-transparent">
      {/* Header Section */}
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-6 py-6 backdrop-blur-sm lg:px-8">
        <div className="max-w-7xl">
          <h1 className="text-3xl font-bold text-kx-texto">
            Ordem de Serviço (OS)
          </h1>
          <p className="text-kx-legenda mt-2 text-sm">
            Gerenciar entradas, orçamentos e status de manutenção de equipamentos
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 lg:px-8 py-6 pb-10">
        <div className="max-w-7xl mx-auto">
          <DashboardOS
            activeOrderServices={dadosDashboard.ordensAtivas}
            archivedOrderServices={dadosDashboard.ordensArquivadas}
            deletedOrderServices={dadosDashboard.ordensExcluidas}
            clienteIdInicial={clienteIdInicial}
            modoInicial={modoInicial}
          visaoInicial={visaoInicial}
            mostrarExcluidasInicial={mostrarExcluidasInicial}
            prazoGarantiaPadraoDias={configuracoes.prazoGarantiaPadraoDias}
            prazoMinimoGarantiaDias={configuracoes.prazoMinimoGarantiaDias}
            prazoMaximoGarantiaDias={configuracoes.prazoMaximoGarantiaDias}
            dashboardGarantiasInicial={dashboardGarantias}
            linhasGarantiasIniciais={linhasGarantiasIniciais}
            erroGarantiasInicial={erroGarantiasInicial}
            fusoHorario={contexto.fusoHorario}
          />
        </div>
      </div>
    </div>
  );
}
