import {
  Activity,
  BadgeDollarSign,
  CircleDollarSign,
  HandCoins,
  ShieldAlert,
  Wallet,
  Wrench,
} from "lucide-react";
import { obterDashboardExecutivo } from "@/app/actions/dashboard";
import { CardExecutivo } from "@/components/dashboard/card-executivo";
import { GraficoResultadoMensal } from "@/components/dashboard/grafico-resultado-mensal";
import { FunilOrdensServico } from "@/components/dashboard/funil-ordens-servico";
import { BlocoAtencaoHoje } from "@/components/dashboard/bloco-atencao-hoje";
import { ResumoMetasDashboard } from "@/components/dashboard/resumo-metas-dashboard";
import { ResumoGarantiasDashboard } from "@/components/dashboard/resumo-garantias-dashboard";
import { UltimasMovimentacoes } from "@/components/dashboard/ultimas-movimentacoes";

const moedaBr = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function PaginaDashboard() {
  const dashboard = await obterDashboardExecutivo();

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Centro de Comando Executivo</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Resumo acionavel do negocio para decisao rapida sem duplicar os modulos internos.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Visao executiva</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CardExecutivo
              titulo="Faturamento do mes"
              valor={moedaBr.format(dashboard.cardsPrincipais.faturamentoMes.valor)}
              variacao={dashboard.cardsPrincipais.faturamentoMes.variacao}
              destaque="verde"
              icone={<BadgeDollarSign className="h-5 w-5" />}
            />
            <CardExecutivo
              titulo="Lucro estimado"
              valor={moedaBr.format(dashboard.cardsPrincipais.lucroEstimado.valor)}
              variacao={dashboard.cardsPrincipais.lucroEstimado.variacao}
              descricao="Receita menos custos e despesas do periodo"
              destaque="azul"
              icone={<CircleDollarSign className="h-5 w-5" />}
            />
            <CardExecutivo
              titulo="A receber hoje/atrasado"
              valor={moedaBr.format(dashboard.cardsPrincipais.receberHojeAtrasado.total)}
              rodape={`Atrasado: ${moedaBr.format(dashboard.cardsPrincipais.receberHojeAtrasado.atrasado)}`}
              destaque="ambar"
              icone={<HandCoins className="h-5 w-5" />}
            />
            <CardExecutivo
              titulo="A pagar hoje/atrasado"
              valor={moedaBr.format(dashboard.cardsPrincipais.pagarHojeAtrasado.total)}
              rodape={`Atrasado: ${moedaBr.format(dashboard.cardsPrincipais.pagarHojeAtrasado.atrasado)}`}
              destaque="vermelho"
              icone={<Wallet className="h-5 w-5" />}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Operacao OS</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CardExecutivo
              titulo="OS abertas"
              valor={String(dashboard.cardsOperacionais.osAbertas)}
              destaque="azul"
              icone={<Wrench className="h-5 w-5" />}
            />
            <CardExecutivo
              titulo="OS concluidas no mes"
              valor={String(dashboard.cardsOperacionais.osConcluidasMes)}
              destaque="verde"
              icone={<Activity className="h-5 w-5" />}
            />
            <CardExecutivo
              titulo="Garantia/Retorno"
              valor={String(dashboard.cardsOperacionais.garantiaRetorno)}
              destaque="ambar"
              icone={<ShieldAlert className="h-5 w-5" />}
            />
            <CardExecutivo
              titulo="Ticket medio OS"
              valor={moedaBr.format(dashboard.cardsOperacionais.ticketMedioOS)}
              destaque="azul"
              icone={<BadgeDollarSign className="h-5 w-5" />}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <GraficoResultadoMensal dados={dashboard.graficoResultado6Meses} />
          </div>
          <div className="xl:col-span-1">
            <FunilOrdensServico itens={dashboard.funilOS} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <BlocoAtencaoHoje alertas={dashboard.atencaoHoje} />
          <UltimasMovimentacoes itens={dashboard.ultimasMovimentacoes} />
          <ResumoMetasDashboard resumo={dashboard.metasResumo} />
          <ResumoGarantiasDashboard resumo={dashboard.garantiasResumo} />
        </section>
      </div>
    </div>
  );
}
