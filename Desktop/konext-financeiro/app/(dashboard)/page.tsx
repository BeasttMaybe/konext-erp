import { Suspense } from "react";
import { CartaoKPI } from "@/components/dashboard/cartao-kpi";
import { GraficoFaturamento } from "@/components/dashboard/grafico-faturamento";
import { GraficoStatusOS } from "@/components/dashboard/grafico-status-os";
import { TabelaAtividade } from "@/components/dashboard/tabela-atividade";
import {
  obterAtividadesRecentesDashboard,
  obterFaturamentoUltimos6MesesDashboard,
  obterMetricasDashboardInicial,
  obterStatusOsDashboard,
} from "@/app/actions/dashboard-inicial";
import {
  TrendingUp,
  Users,
  ShoppingCart,
  Wrench,
} from "lucide-react";

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-slate-950/40">
      <div className="space-y-4 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="space-y-2">
          <div className="h-8 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-24 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
        <div className="h-4 w-36 rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-slate-950/40">
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-[300px] w-full rounded bg-zinc-100 dark:bg-zinc-900" aria-label={title} />
      </div>
    </div>
  );
}

async function SecaoMetricas() {
  const dados = await obterMetricasDashboardInicial();

  const moedaBr = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <CartaoKPI
        titulo="Faturamento Mensal"
        valor={moedaBr.format(dados.faturamentoMensal.valor)}
        variacao={dados.faturamentoMensal.variacao}
        cor="verde"
        icone={<TrendingUp className="h-5 w-5 text-emerald-600" />}
      />
      <CartaoKPI
        titulo="OS Concluídas"
        valor={dados.osConcluidas.valor}
        variacao={dados.osConcluidas.variacao}
        cor="azul"
        icone={<Wrench className="h-5 w-5 text-blue-600" />}
        descricao="Ordens de Serviço"
      />
      <CartaoKPI
        titulo="Vendas no PDV"
        valor={dados.vendasPdv.valor}
        variacao={dados.vendasPdv.variacao}
        cor="violeta"
        icone={<ShoppingCart className="h-5 w-5 text-violet-600" />}
        descricao="Quantidade de vendas no mês"
      />
      <CartaoKPI
        titulo="Clientes Ativos"
        valor={dados.clientesAtivos.valor}
        variacao={dados.clientesAtivos.variacao}
        cor="laranja"
        icone={<Users className="h-5 w-5 text-orange-600" />}
        descricao="Com atividade no mês"
      />
    </div>
  );
}

async function PainelFaturamento() {
  const dados = await obterFaturamentoUltimos6MesesDashboard();

  return <GraficoFaturamento dados={dados} />;
}

async function PainelStatusOs() {
  const dados = await obterStatusOsDashboard();

  return <GraficoStatusOS dados={dados} />;
}

async function PainelAtividades() {
  const dados = await obterAtividadesRecentesDashboard();

  return <TabelaAtividade transacoes={dados} />;
}

/**
 * Página Principal do Dashboard
 * Exibe KPIs, gráficos e atividades recentes
 */
export default async function PaginaDashboard() {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Bem-vindo! Aqui estão os principais indicadores do seu negócio.
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          }
        >
          <SecaoMetricas />
        </Suspense>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Suspense fallback={<PanelSkeleton title="Faturamento - Últimos 6 Meses" />}>
              <PainelFaturamento />
            </Suspense>
          </div>
          <div className="lg:col-span-1">
            <Suspense fallback={<PanelSkeleton title="Status das Ordens de Serviço" />}>
              <PainelStatusOs />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<PanelSkeleton title="Atividades Recentes" />}>
          <PainelAtividades />
        </Suspense>
      </div>
    </div>
  );
}
