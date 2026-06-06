import { ConteudoPrincipal } from "@/components/layout/conteudo-principal";
import { Rodape } from "@/components/layout/rodape";
import { CartaoKPI } from "@/components/dashboard/cartao-kpi";
import { GraficoFaturamento } from "@/components/dashboard/grafico-faturamento";
import { GraficoStatusOS } from "@/components/dashboard/grafico-status-os";
import { TabelaAtividade } from "@/components/dashboard/tabela-atividade";
import {
  kpisExemplo,
  dadosFaturamento,
  dadosStatusOS,
  transacoesRecentes,
} from "@/dados/moqueado";
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
export default function PaginaDashboard() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Conteúdo Principal com Margin Dinâmico */}
      <ConteudoPrincipal>
        <div className="container mx-auto p-6">
          <div className="space-y-8">
            {/* Cabeçalho da Página */}
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Dashboard
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                Bem-vindo! Aqui estão os principais indicadores do seu negócio.
              </p>
            </div>

            {/* Grid de KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <CartaoKPI
                titulo="Faturamento Mensal"
                valor="R$ 125.450"
                variacao={12.5}
                cor="verde"
                icone={<TrendingUp className="h-5 w-5 text-emerald-600" />}
              />
              <CartaoKPI
                titulo="OS Concluídas"
                valor={48}
                variacao={8.3}
                cor="azul"
                icone={<Wrench className="h-5 w-5 text-blue-600" />}
                descricao="Ordens de Serviço"
              />
              <CartaoKPI
                titulo="Vendas no PDV"
                valor="R$ 87.320"
                variacao={-2.1}
                cor="violeta"
                icone={<ShoppingCart className="h-5 w-5 text-violet-600" />}
              />
              <CartaoKPI
                titulo="Clientes Ativos"
                valor={342}
                variacao={5.7}
                cor="laranja"
                icone={<Users className="h-5 w-5 text-orange-600" />}
                descricao="Com atividade no mês"
              />
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <GraficoFaturamento dados={dadosFaturamento} />
              </div>
              <div className="lg:col-span-1">
                <GraficoStatusOS dados={dadosStatusOS} />
              </div>
            </div>

            {/* Tabela de Atividades */}
            <TabelaAtividade transacoes={transacoesRecentes} />
          </div>
        </div>
      </ConteudoPrincipal>

      <Rodape />
    </div>
  );
}
