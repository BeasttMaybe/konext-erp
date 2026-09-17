import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  BarChart3,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  BotaoAtualizarFinanceiro,
  CartaoHistoricoFechamentos,
} from "@/components/financeiro/dashboard-financeiro-acoes";
import {
  obterFaturamentoCaixaFechadoHoje,
  obterSaldoPrevisto,
  obterTotalPagarHoje,
  obterTotalReceberHoje,
  obterTotalVendasHoje,
} from "@/app/actions/financeiro-hub";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

function CartaoResumoSkeleton({ className }: { className: string }) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-3 w-full">
          <div className="h-4 w-36 rounded bg-white/60 dark:bg-slate-800/70 animate-pulse" />
          <div className="h-8 w-28 rounded bg-white/70 dark:bg-slate-800/80 animate-pulse" />
        </div>
        <div className="h-5 w-5 rounded-full bg-white/70 dark:bg-slate-800/80 animate-pulse" />
      </div>
    </Card>
  );
}

async function CartaoVendasHoje() {
  const totalVendasHoje = await obterTotalVendasHoje();

  return (
    <Card className="border-sky-200/60 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-sky-700 dark:text-sky-300">Vendas do Dia</p>
          <p className="text-2xl font-bold text-sky-900 dark:text-sky-100 mt-2">
            {formatarMoeda(totalVendasHoje)}
          </p>
        </div>
        <ShoppingCart className="h-5 w-5 text-sky-600 dark:text-sky-300" />
      </div>
    </Card>
  );
}

async function CartaoPagarHoje() {
  const totalPagarHoje = await obterTotalPagarHoje();

  return (
    <Card className="border-red-200/60 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-red-700 dark:text-red-300">A Pagar (Hoje/Atrasado)</p>
          <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-2">
            {formatarMoeda(totalPagarHoje)}
          </p>
        </div>
        <ArrowDownRight className="h-5 w-5 text-red-600 dark:text-red-300" />
      </div>
    </Card>
  );
}

async function CartaoReceberHoje() {
  const totalReceberHoje = await obterTotalReceberHoje();

  return (
    <Card className="border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">A Receber (Hoje/Atrasado)</p>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-2">
            {formatarMoeda(totalReceberHoje)}
          </p>
        </div>
        <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
      </div>
    </Card>
  );
}

async function CartaoSaldoPrevisto() {
  const saldoPrevisto = await obterSaldoPrevisto();

  return (
    <Card className="border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300">Saldo Previsto</p>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-2">
            {formatarMoeda(saldoPrevisto)}
          </p>
        </div>
        <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
      </div>
    </Card>
  );
}

async function CartaoFaturamentoCaixaFechado() {
  const faturamentoCaixaFechadoHoje = await obterFaturamentoCaixaFechadoHoje();

  return <CartaoHistoricoFechamentos faturamentoCaixaFechadoHoje={faturamentoCaixaFechadoHoje} />;
}

/**
 * Centro de Comando Financeiro
 * Renderiza cada indicador em um fluxo independente no servidor.
 */
export default async function FinanceiroPage() {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "financeiro.ver")) {
    return <AcessoNegado />;
  }

  return (
    <div className="w-full min-h-full flex flex-col bg-transparent">
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Centro de Comando Financeiro
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
              Visao executiva das obrigacoes e recebimentos do dia
            </p>
          </div>
          <BotaoAtualizarFinanceiro />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Resumo do Dia
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
              <Suspense fallback={<CartaoResumoSkeleton className="border-sky-200/60 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20" />}>
                <CartaoVendasHoje />
              </Suspense>
              <Suspense fallback={<CartaoResumoSkeleton className="border-blue-200/60 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/20" />}>
                <CartaoPagarHoje />
              </Suspense>
              <Suspense fallback={<CartaoResumoSkeleton className="border-red-200/60 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20" />}>
                <CartaoReceberHoje />
              </Suspense>
              <Suspense fallback={<CartaoResumoSkeleton className="border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20" />}>
                <CartaoSaldoPrevisto />
              </Suspense>
              <Suspense fallback={<CartaoResumoSkeleton className="border-amber-200/60 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20" />}>
                <CartaoFaturamentoCaixaFechado />
              </Suspense>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Navegacao de Modulos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/financeiro/receber" className="block">
                  <Card className="h-full cursor-pointer border-zinc-200 bg-white/85 transition-colors hover:border-primary dark:border-zinc-800 dark:bg-slate-900/55">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Contas a Receber</p>
                      <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Controle de recebimentos, inadimplencia e baixa financeira.
                    </p>
                  </Card>
                </Link>

                <Link href="/financeiro/pagar" className="block">
                  <Card className="h-full cursor-pointer border-zinc-200 bg-white/85 transition-colors hover:border-primary dark:border-zinc-800 dark:bg-slate-900/55">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Contas a Pagar</p>
                      <ArrowDownRight className="h-5 w-5 text-red-500" />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Gestao de obrigacoes, vencimentos e fluxo de saida.
                    </p>
                  </Card>
                </Link>

                <Link href="/financeiro/notas-fiscais" className="block">
                  <Card className="h-full cursor-pointer border-zinc-200 bg-white/85 transition-colors hover:border-primary dark:border-zinc-800 dark:bg-slate-900/55">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Notas Fiscais</p>
                      <Receipt className="h-5 w-5 text-blue-500" />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Emissao, acompanhamento de status e historico fiscal.
                    </p>
                  </Card>
                </Link>

                <Link href="/financeiro/inteligencia" className="block">
                  <Card className="h-full cursor-pointer border-zinc-200 bg-white/85 transition-colors hover:border-primary dark:border-zinc-800 dark:bg-slate-900/55">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Inteligencia</p>
                      <BrainCircuit className="h-5 w-5 text-violet-500" />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Indicadores, previsoes e recomendacoes para decisao.
                    </p>
                  </Card>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
