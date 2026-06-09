import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingUp, AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  listarContasReceberFiltradas,
  obterResumoReceber,
} from "@/app/actions/financeiro-receber";
import { FiltrosReceber } from "./components/FiltrosReceber";
import { ConteudoReceber } from "./components/ConteudoReceber";

export const metadata = { title: "Contas a Receber | Konext" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function obterParam(
  params: Record<string, string | string[] | undefined>,
  chave: string
): string | undefined {
  const valor = params[chave];
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Página de Contas a Receber — Server Component.
 *
 * Arquitetura:
 * - page.tsx (Server): lê searchParams, busca dados do Prisma, renderiza KPIs reativos
 * - <FiltrosReceber> (Client): atualiza URL Search Params sem useState para filtros
 * - <ConteudoReceber> (Client): tabela + modais de CRUD; chama router.refresh() após mutações
 *
 * URL de filtros: /financeiro/receber?mes=6&ano=2026&categoriaCliente=EMPRESA
 */
export default async function FinanceiroReceberPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const filtros = {
    mes: obterParam(params, "mes"),
    ano: obterParam(params, "ano"),
    categoriaCliente: obterParam(params, "categoriaCliente"),
  };

  const [contas, resumo] = await Promise.all([
    listarContasReceberFiltradas(filtros),
    obterResumoReceber(filtros),
  ]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Cabeçalho */}
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full">
          <Link
            href="/financeiro"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar ao Financeiro
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mt-2">
            Contas a Receber
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            Controle de títulos pendentes, inadimplência e confirmação de recebimento.
          </p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* KPIs — calculados server-side com base nos filtros da URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-border bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendente</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {fmt(resumo.totalPendente)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-border bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Atrasado</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                    {fmt(resumo.totalAtrasado)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-border bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recebido</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {fmt(resumo.totalRecebido)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-border bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {filtros.mes ? "Total no Mês" : "Total no Período"}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {fmt(resumo.totalPeriodo)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Filtros (Client Component) — requer Suspense por usar useSearchParams */}
          <Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded-md" />}>
            <FiltrosReceber />
          </Suspense>

          {/* Tabela e modais (Client Component) */}
          <ConteudoReceber contas={contas} />
        </div>
      </div>
    </div>
  );
}

