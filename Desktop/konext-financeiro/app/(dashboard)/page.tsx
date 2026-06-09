import { CartaoKPI } from "@/components/dashboard/cartao-kpi";
import { GraficoFaturamento } from "@/components/dashboard/grafico-faturamento";
import { GraficoStatusOS } from "@/components/dashboard/grafico-status-os";
import { TabelaAtividade } from "@/components/dashboard/tabela-atividade";
import { FechamentoCaixa } from "@/components/dashboard/fechamento-caixa";
import { DialogFechamentoCaixa } from "@/components/dashboard/dialog-fechamento-caixa";
import { obterDadosDashboardInicial } from "@/app/actions/dashboard-inicial";
import {
  TrendingUp,
  Users,
  ShoppingCart,
  Wrench,
} from "lucide-react";

/**
 * Página Principal do Dashboard
 * Exibe KPIs, gráficos e atividades recentes
 */
export default async function PaginaDashboard() {
  const dados = await obterDadosDashboardInicial();

  const moedaBr = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <CartaoKPI
            titulo="Faturamento Mensal"
            valor={moedaBr.format(dados.metricas.faturamentoMensal.valor)}
            variacao={dados.metricas.faturamentoMensal.variacao}
            cor="verde"
            icone={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          />
          <CartaoKPI
            titulo="OS Concluídas"
            valor={dados.metricas.osConcluidas.valor}
            variacao={dados.metricas.osConcluidas.variacao}
            cor="azul"
            icone={<Wrench className="h-5 w-5 text-blue-600" />}
            descricao="Ordens de Serviço"
          />
          <CartaoKPI
            titulo="Vendas no PDV"
            valor={dados.metricas.vendasPdv.valor}
            variacao={dados.metricas.vendasPdv.variacao}
            cor="violeta"
            icone={<ShoppingCart className="h-5 w-5 text-violet-600" />}
            descricao="Quantidade de vendas no mês"
          />
          <CartaoKPI
            titulo="Clientes Ativos"
            valor={dados.metricas.clientesAtivos.valor}
            variacao={dados.metricas.clientesAtivos.variacao}
            cor="laranja"
            icone={<Users className="h-5 w-5 text-orange-600" />}
            descricao="Com atividade no mês"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <GraficoFaturamento dados={dados.faturamentoUltimos6Meses} />
          </div>
          <div className="lg:col-span-1">
            <GraficoStatusOS dados={dados.statusOs} />
          </div>
        </div>

        <TabelaAtividade transacoes={dados.atividadesRecentes} />
      </div>
    </div>
  );
}
