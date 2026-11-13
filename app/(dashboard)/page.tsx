import { obterConfiguracoes } from "@/app/actions/configuracoes";
import {
  obterFaturamentoHomeSeguro,
  obterPainelOperacionalHomeSeguro,
  type PeriodoDashboard,
} from "@/app/actions/dashboard";
import { dataDeCalendario } from "@/lib/datas";
import { validarIntervalo } from "@/lib/filtro-periodo";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { CabecalhoDashboard } from "@/components/dashboard/cabecalho-dashboard";
import { KpisHome } from "@/components/dashboard/kpis-home";
import { GraficoReceita } from "@/components/dashboard/grafico-receita";
import { FluxoOs } from "@/components/dashboard/fluxo-os";
import { MovimentacoesHome } from "@/components/dashboard/movimentacoes-home";
import { MetasHome } from "@/components/dashboard/metas-home";
import { PendenciasHome } from "@/components/dashboard/pendencias-home";
import { PrimeirosPassos } from "@/components/dashboard/primeiros-passos";
import { AgendaHome } from "@/components/dashboard/agenda-home";
import { obterProximosDaAgenda } from "@/app/actions/agenda";
import { primeirosPassosDaLoja } from "@/lib/primeiros-passos-da-loja";

export const dynamic = "force-dynamic";

function normalizarPeriodo(valor: string | string[] | undefined): PeriodoDashboard {
  const bruto = Array.isArray(valor) ? valor[0] : valor;

  if (bruto === "7d" || bruto === "30d" || bruto === "mes" || bruto === "custom") {
    return bruto;
  }

  return "hoje";
}

function obterParamUnico(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
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

  // Pill "Personalizado" (Fase 2A-1, `FiltroPeriodo`) — só tem efeito quando
  // periodo === "custom" E os dois lados (inicio/fim) são datas válidas;
  // caso contrário `resolverIntervaloPeriodo` (app/actions/dashboard.ts) cai
  // no mesmo intervalo de "hoje", nunca fica sem janela.
  const inicioCustomTexto = obterParamUnico(query.inicio);
  const fimCustomTexto = obterParamUnico(query.fim);
  const inicioCustom = inicioCustomTexto ? dataDeCalendario(inicioCustomTexto) : null;
  const fimCustom = fimCustomTexto ? dataDeCalendario(fimCustomTexto) : null;
  const intervaloCustom =
    inicioCustom && fimCustom && validarIntervalo(inicioCustom, fimCustom).valido
      ? { inicio: inicioCustom, fim: fimCustom }
      : undefined;

  const [resultadoOperacional, resultadoFaturamento, configuracoes, agenda] = await Promise.all([
    obterPainelOperacionalHomeSeguro(periodo, intervaloCustom),
    temFinanceiro ? obterFaturamentoHomeSeguro(periodo, intervaloCustom) : Promise.resolve(null),
    obterConfiguracoes(),
    // A agenda nunca derruba a home.
    obterProximosDaAgenda(6).catch((erro) => {
      console.error("[dashboard] agenda", erro instanceof Error ? erro.message : erro);
      return null;
    }),
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

  // So para quem configura a loja: os passos levam a telas de administracao.
  const passos = temPermissao(contexto, "configuracoes.empresa") ? await primeirosPassosDaLoja(contexto, configuracoes) : null;

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

      {passos ? <PrimeirosPassos passos={passos} /> : null}

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

      <div className="grid grid-cols-1 items-start gap-kx-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <MovimentacoesHome itens={painel.ultimasMovimentacoes} />
        <div className="flex flex-col gap-kx-4">
          {agenda ? <AgendaHome hoje={agenda.hoje} eventos={agenda.eventos} /> : null}
          {painel.metasResumo ? <MetasHome resumo={painel.metasResumo} /> : null}
        </div>
      </div>
    </div>
  );
}
