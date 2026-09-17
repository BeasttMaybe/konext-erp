import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingDown, AlertTriangle, Clock, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  listarParcelasPagarFiltradas,
  obterResumoPagar,
} from "@/app/actions/financeiro-pagar";
import { FiltrosPagar } from "./components/FiltrosPagar";
import { ConteudoPagar } from "./components/ConteudoPagar";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

export const metadata = { title: "Contas a Pagar | Konext" };

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
 * Página de Contas a Pagar — Server Component.
 *
 * Arquitetura:
 * - page.tsx (Server): lê searchParams, busca dados do Prisma, renderiza KPIs reativos
 * - <FiltrosPagar> (Client): atualiza URL Search Params sem useState para filtros
 * - <ConteudoPagar> (Client): tabela + modais de CRUD; chama router.refresh() após mutações
 *
 * URL de filtros: /financeiro/pagar?mes=6&ano=2026&categoriaCliente=EMPRESA
 */
export default async function FinanceiroPagarPage({ searchParams }: PageProps) {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "financeiro.ver")) {
    return <AcessoNegado />;
  }

  const params = await searchParams;

  const filtros = {
    mes: obterParam(params, "mes"),
    ano: obterParam(params, "ano"),
    categoriaCliente: obterParam(params, "categoriaCliente"),
  };

  const [parcelas, resumo] = await Promise.all([
    listarParcelasPagarFiltradas(filtros),
    obterResumoPagar(filtros),
  ]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="w-full min-h-full flex flex-col bg-transparent">
      {/* Cabeçalho */}
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full">
          <Link
            href="/financeiro"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar ao Financeiro
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mt-2">
            Contas a Pagar
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            Gestão de despesas únicas, parceladas e recorrências mensais.
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
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
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
                  <p className="text-sm text-muted-foreground">Vence Hoje</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                    {fmt(resumo.venceHoje)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                  <CalendarDays className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
                  <TrendingDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Filtros (Client Component) — requer Suspense por usar useSearchParams */}
          <Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded-md" />}>
            <FiltrosPagar />
          </Suspense>

          {/* Tabela e modais (Client Component) */}
          <ConteudoPagar parcelas={parcelas} />
        </div>
      </div>
    </div>
  );
}

