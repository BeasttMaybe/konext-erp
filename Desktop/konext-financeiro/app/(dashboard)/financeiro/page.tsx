"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  BarChart3,
  Receipt,
  RefreshCcw,
  Wallet,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  obterResumoDashboardFinanceiro,
  type ResumoDashboardFinanceiro,
} from "@/app/actions/financeiro-hub";
import { SheetHistoricoFechamentos } from "@/components/financeiro/sheet-historico-fechamentos";
import { toast } from "sonner";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

/**
 * Centro de Comando Financeiro
 * Dashboard principal com resumo e navegacao dos modulos financeiros
 */
export default function FinanceiroPage() {
  const [resumo, setResumo] = useState<ResumoDashboardFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(false);
  // Controla a abertura do Sheet de histórico de fechamentos
  const [sheetHistoricoAberto, setSheetHistoricoAberto] = useState(false);

  const carregarResumo = async () => {
    try {
      setCarregando(true);
      const dados = await obterResumoDashboardFinanceiro();
      setResumo(dados);
    } catch {
      toast.error("Nao foi possivel carregar o resumo financeiro.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarResumo();
  }, []);

  return (
    <>
    <div className="w-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Cabeçalho */}
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Centro de Comando Financeiro
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
              Visao executiva das obrigacoes e recebimentos do dia
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={carregarResumo} disabled={carregando}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${carregando ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Resumo do Dia
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
              <Card className="border-sky-200/60 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-sky-700 dark:text-sky-300">Vendas do Dia</p>
                    <p className="text-2xl font-bold text-sky-900 dark:text-sky-100 mt-2">
                      {formatarMoeda(resumo?.totalVendasHoje ?? 0)}
                    </p>
                  </div>
                  <ShoppingCart className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                </div>
              </Card>

              <Card className="border-blue-200/60 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-red-700 dark:text-red-300">A Pagar (Hoje/Atrasado)</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                      {formatarMoeda(resumo?.totalPagarHoje ?? 0)}
                    </p>
                  </div>
                  <ArrowDownRight className="h-5 w-5 text-red-600 dark:text-red-300" />
                </div>
              </Card>

              <Card className="border-red-200/60 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">A Receber (Hoje/Atrasado)</p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-2">
                      {formatarMoeda(resumo?.totalReceberHoje ?? 0)}
                    </p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
              </Card>

              <Card className="border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">Saldo Previsto</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-2">
                      {formatarMoeda(resumo?.saldoPrevisto ?? 0)}
                    </p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
              </Card>

              {/* Cartão de Faturamento (Caixa Fechado) — clicável para abrir o histórico */}
              <Card
                className="border-amber-200/60 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20 cursor-pointer hover:ring-2 hover:ring-amber-400/50 hover:shadow-md transition-all"
                onClick={() => setSheetHistoricoAberto(true)}
                title="Clique para ver o histórico de fechamentos"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-amber-700 dark:text-amber-300">Faturamento (Caixa Fechado)</p>
                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-2">
                      {formatarMoeda(resumo?.faturamentoCaixaFechadoHoje ?? 0)}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Ver histórico →
                    </p>
                  </div>
                  <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                </div>
              </Card>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Navegacao de Modulos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/financeiro/receber" className="block">
                  <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 hover:border-primary transition-colors cursor-pointer h-full">
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
                  <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 hover:border-primary transition-colors cursor-pointer h-full">
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
                  <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 hover:border-primary transition-colors cursor-pointer h-full">
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
                  <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 hover:border-primary transition-colors cursor-pointer h-full">
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

    {/* Sheet do histórico de fechamentos de caixa */}
    <SheetHistoricoFechamentos
      aberto={sheetHistoricoAberto}
      aoFechar={() => setSheetHistoricoAberto(false)}
    />
  </>
  );
}
