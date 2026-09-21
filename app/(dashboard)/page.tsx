import { obterConfiguracoes } from "@/app/actions/configuracoes";
import {
  obterFaturamentoHomeSeguro,
  obterPainelOperacionalHomeSeguro,
  type PeriodoDashboard,
} from "@/app/actions/dashboard";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { CabecalhoDashboard } from "@/components/dashboard/cabecalho-dashboard";
import { KpisHome } from "@/components/dashboard/kpis-home";
import { GraficoReceita } from "@/components/dashboard/grafico-receita";
import { FluxoOs } from "@/components/dashboard/fluxo-os";
import { MovimentacoesHome } from "@/components/dashboard/movimentacoes-home";
import { MetasHome } from "@/components/dashboard/metas-home";
import { PendenciasHome } from "@/components/dashboard/pendencias-home";

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

/**
 * Home operacional (Fase 3-2A): "o que está na minha bancada hoje?" —
 * profundidade financeira (DRE, orçamento, saldo) mora em `/financeiro`.
 * O painel operacional é sempre buscado; o faturamento só quando o contexto
 * tem `dashboard.financeiro` — sem essa permissão, a home nunca fica cinza,
 * só omite o card de Faturamento, o gráfico de receita e as pendências
 * financeiras.
 */
export default async function PaginaDashboard({ searchParams }: PropsPaginaDashboard) {
  const query = await searchParams;
  const periodo = normalizarPeriodo(query.periodo);

  const contexto = await exigirContextoTenant();
  const temFinanceiro = temPermissao(contexto, "dashboard.financeiro");

  const [resultadoOperacional, resultadoFaturamento, configuracoes] = await Promise.all([
    obterPainelOperacionalHomeSeguro(periodo),
    temFinanceiro ? obterFaturamentoHomeSeguro(periodo) : Promise.resolve(null),
    obterConfiguracoes(),
  ]);

  if (!resultadoOperacional.sucesso) {
    return (
      <div className="py-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-base font-medium text-foreground">Falha ao carregar o painel</h1>
          <p className="mt-2 text-sm text-muted-foreground">{resultadoOperacional.erro}</p>
        </div>
      </div>
    );
  }

  const painel = resultadoOperacional.dados;
  const faturamento = resultadoFaturamento?.sucesso ? resultadoFaturamento.dados : null;
  const erroFaturamento = resultadoFaturamento && !resultadoFaturamento.sucesso ? resultadoFaturamento.erro : null;

  const pendencias = [...painel.pendencias, ...(faturamento?.pendenciasFinanceiras ?? [])];

  return (
    <div className="space-y-kx-4 py-3">
      <CabecalhoDashboard
        empresa={configuracoes.nomeFantasia}
        periodo={painel.periodo}
        fusoHorario={contexto.fusoHorario}
      />

      <PendenciasHome itens={pendencias} />

      <KpisHome
        temFinanceiro={temFinanceiro}
        faturamento={faturamento}
        fluxoEtapas={painel.fluxoEtapas}
        prontasAguardandoRetirada={painel.operacao.prontasAguardandoRetirada}
        garantia={painel.operacao.garantia}
      />

      {temFinanceiro ? (
        <div className="grid grid-cols-1 items-start gap-kx-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {faturamento ? (
            <GraficoReceita serie={faturamento.serie} margemLiquidaPercentual={faturamento.margemLiquidaPercentual} />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-kx-cartao border border-kx-erro-borda bg-kx-erro-fundo p-kx-4 text-center text-sm text-kx-erro-texto">
              {erroFaturamento ?? "Não foi possível carregar os indicadores financeiros."}
            </div>
          )}
          <FluxoOs fluxoEtapas={painel.fluxoEtapas} />
        </div>
      ) : (
        <FluxoOs fluxoEtapas={painel.fluxoEtapas} />
      )}

      {painel.metasResumo ? (
        <div className="grid grid-cols-1 items-start gap-kx-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <MovimentacoesHome itens={painel.ultimasMovimentacoes} />
          <MetasHome resumo={painel.metasResumo} />
        </div>
      ) : (
        <MovimentacoesHome itens={painel.ultimasMovimentacoes} />
      )}
    </div>
  );
}
