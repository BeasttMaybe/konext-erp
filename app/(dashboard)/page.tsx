import { obterConfiguracoes } from "@/app/actions/configuracoes";
import {
  obterDashboardExecutivoSeguro,
  type PeriodoDashboard,
} from "@/app/actions/dashboard";
import { BandaKpis } from "@/components/dashboard/banda-kpis";
import { BarraContexto } from "@/components/dashboard/barra-contexto";
import { BlocoGarantia } from "@/components/dashboard/bloco-garantia";
import { BlocoMetas } from "@/components/dashboard/bloco-metas";
import { FaixaAcoes } from "@/components/dashboard/faixa-acoes";
import { FilaOs } from "@/components/dashboard/fila-os";
import { GraficoResultado } from "@/components/dashboard/grafico-resultado";
import { GraficoSaldo } from "@/components/dashboard/grafico-saldo";
import { ListaMovimentacoes } from "@/components/dashboard/lista-movimentacoes";
import { MedidoresOrcamento } from "@/components/dashboard/medidores-orcamento";
import { TabelaDre } from "@/components/dashboard/tabela-dre";
import { TabelaParados } from "@/components/dashboard/tabela-parados";

export const dynamic = "force-dynamic";

function normalizarPeriodo(valor: string | string[] | undefined): PeriodoDashboard {
  const bruto = Array.isArray(valor) ? valor[0] : valor;

  if (bruto === "7d" || bruto === "30d" || bruto === "mes") {
    return bruto;
  }

  return "hoje";
}

type PropsPaginaDashboard = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaginaDashboard({ searchParams }: PropsPaginaDashboard) {
  const query = await searchParams;
  const periodo = normalizarPeriodo(query.periodo);

  const [resultadoDashboard, configuracoes] = await Promise.all([
    obterDashboardExecutivoSeguro(periodo),
    obterConfiguracoes(),
  ]);

  if (!resultadoDashboard.sucesso) {
    return (
      <div className="py-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-base font-medium text-foreground">Falha ao carregar o dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">{resultadoDashboard.erro}</p>
        </div>
      </div>
    );
  }

  const dashboard = resultadoDashboard.dados;
  const painel = dashboard.painel;
  const metas = dashboard.metasResumo;
  const mostrarMetas = Boolean(metas && metas.principais.length > 0);

  return (
    <div className="space-y-2.5 py-3">
      <BarraContexto empresa={configuracoes.nomeFantasia} periodo={dashboard.periodo} />

      <FaixaAcoes acoes={dashboard.acoes} />

      <BandaKpis painel={painel} />

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
        <GraficoResultado dados={[...painel.serieMensal]} />
        <MedidoresOrcamento
          receita={painel.orcamentoReceita}
          despesa={painel.orcamentoDespesa}
          custoPecas={painel.orcamentoCustoPecas}
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
        <GraficoSaldo dados={painel.saldoAcumuladoPorMes} />
        <TabelaDre dre={painel.dre} />
      </div>

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
        <FilaOs fila={dashboard.operacao.fila} />
        <TabelaParados parados={dashboard.operacao.parados} limite={5} />
        <BlocoGarantia garantia={dashboard.operacao.garantia} />
      </div>

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
        {mostrarMetas && metas ? <BlocoMetas resumo={metas} /> : <div />}
        <ListaMovimentacoes itens={dashboard.ultimasMovimentacoes} />
      </div>
    </div>
  );
}
