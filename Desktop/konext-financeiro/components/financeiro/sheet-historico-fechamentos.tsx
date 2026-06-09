"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  TrendingUp,
  Banknote,
  BadgeDollarSign,
  Target,
  CreditCard,
  Wallet,
  QrCode,
  Receipt,
  Building2,
  RefreshCw,
} from "lucide-react";
import {
  obterHistoricoFechamentos,
  obterResumoDataEspecifica,
  type ItemHistoricoFechamento,
  type ResumoDataEspecifica,
} from "@/app/actions/caixa";
import { META_DIARIA_REAIS } from "@/types/fechamento-caixa";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { toast } from "sonner";

// ── Formatadores ──────────────────────────────────────────────────────────────

const moedaBr = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const dataCurta = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));

const diaSemana = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date(d));

// ── Config visual por forma de pagamento ──────────────────────────────────────

type CfgForma = {
  cor: string;
  corTexto: string;
  corBarra: string;
  Icone: React.ElementType;
};

const CFG_FORMA: Record<string, CfgForma> = {
  PIX:             { cor: "bg-teal-50 dark:bg-teal-950/30",      corTexto: "text-teal-700 dark:text-teal-300",      corBarra: "bg-teal-500",    Icone: QrCode          },
  DINHEIRO:        { cor: "bg-emerald-50 dark:bg-emerald-950/30", corTexto: "text-emerald-700 dark:text-emerald-300", corBarra: "bg-emerald-500", Icone: Wallet          },
  CARTAO_CREDITO:  { cor: "bg-violet-50 dark:bg-violet-950/30",  corTexto: "text-violet-700 dark:text-violet-300",   corBarra: "bg-violet-500",  Icone: CreditCard      },
  CARTAO_DEBITO:   { cor: "bg-blue-50 dark:bg-blue-950/30",      corTexto: "text-blue-700 dark:text-blue-300",       corBarra: "bg-blue-500",    Icone: CreditCard      },
  BOLETO:          { cor: "bg-orange-50 dark:bg-orange-950/30",  corTexto: "text-orange-700 dark:text-orange-300",   corBarra: "bg-orange-500",  Icone: Receipt         },
  CREDIARIO:       { cor: "bg-amber-50 dark:bg-amber-950/30",    corTexto: "text-amber-700 dark:text-amber-300",     corBarra: "bg-amber-500",   Icone: BadgeDollarSign },
  EMPENHO_PUBLICO: { cor: "bg-slate-50 dark:bg-slate-800/50",    corTexto: "text-slate-700 dark:text-slate-300",     corBarra: "bg-slate-500",   Icone: Building2       },
};
const FALLBACK_CFG: CfgForma = {
  cor: "bg-slate-50 dark:bg-slate-800/50",
  corTexto: "text-slate-600 dark:text-slate-400",
  corBarra: "bg-slate-400",
  Icone: Banknote,
};

const ROTULOS_FORMA: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_DEBITO: "Cartão de Débito",
  BOLETO: "Boleto",
  CREDIARIO: "Crediário",
  EMPENHO_PUBLICO: "Empenho Público",
};

// ── Sub-view: Relatório detalhado de um dia ───────────────────────────────────

function RelatorioDetalhadoDia({
  item,
  resumo,
  aoVoltar,
}: {
  item: ItemHistoricoFechamento;
  resumo: ResumoDataEspecifica;
  aoVoltar: () => void;
}) {
  const percentualMeta = Math.min((resumo.totalVendas / META_DIARIA_REAIS) * 100, 100);
  const metaAtingida = resumo.totalVendas >= META_DIARIA_REAIS;
  const faltaMeta = META_DIARIA_REAIS - resumo.totalVendas;

  return (
    <div className="space-y-5">
      {/* Cabeçalho do drill-down */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={aoVoltar} className="shrink-0 -ml-1">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-50 capitalize">
            {diaSemana(item.dataFechamento)}, {dataCurta(item.dataFechamento)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fechamento: {moedaBr(item.valorFechamento)}
          </p>
        </div>
      </div>

      {/* Meta Diária */}
      <div className="rounded-xl border border-border bg-white dark:bg-slate-900 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500" />
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Meta Diária — {moedaBr(META_DIARIA_REAIS)}
            </span>
            {metaAtingida ? (
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold px-3">
                Meta Atingida! 🚀
              </Badge>
            ) : (
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Faltaram {moedaBr(faltaMeta)}
              </span>
            )}
          </div>
          <Progress value={percentualMeta} className="h-3 rounded-full" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {moedaBr(resumo.totalVendas)}
            </span>
            <span className="text-slate-400 tabular-nums">
              {Math.round(percentualMeta)}% de {moedaBr(META_DIARIA_REAIS)}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Cartões de Resumo */}
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-xl border-l-4 border-l-emerald-500 border border-border bg-white dark:bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">
                Total de Entradas
              </p>
              <p className="text-lg font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                {moedaBr(resumo.totalVendas)}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 shrink-0">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-l-4 border-l-rose-500 border border-border bg-white dark:bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">
                Custo de Mercadoria / Peças
              </p>
              <p className="text-lg font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                {moedaBr(resumo.custoTotal)}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 shrink-0">
              <Banknote className="h-4 w-4 text-rose-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border-l-4 border-l-blue-500 border border-border bg-white dark:bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">
                Lucro Bruto
              </p>
              <p
                className={`text-lg font-extrabold tabular-nums ${
                  resumo.lucroBruto >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {moedaBr(resumo.lucroBruto)}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 shrink-0">
              <BadgeDollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Detalhamento por Forma de Pagamento */}
      <div className="rounded-xl border border-border bg-white dark:bg-slate-900">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Detalhamento por Forma de Pagamento
          </span>
        </div>
        <div className="px-4 pb-4 space-y-2">
          {resumo.totaisPorFormaPagamento.length > 0 ? (
            <>
              {resumo.totaisPorFormaPagamento.map((item) => {
                const cfg = CFG_FORMA[item.formaPagamento] ?? FALLBACK_CFG;
                const { Icone } = cfg;
                const pct =
                  resumo.totalVendas > 0
                    ? Math.round((item.total / resumo.totalVendas) * 100)
                    : 0;
                return (
                  <div
                    key={item.formaPagamento}
                    className={`rounded-xl p-3 ${cfg.cor} flex items-center gap-3`}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-900/60 shadow-sm flex items-center justify-center">
                      <Icone className={`w-4 h-4 ${cfg.corTexto}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold ${cfg.corTexto}`}>
                          {ROTULOS_FORMA[item.formaPagamento] ?? item.formaPagamento}
                        </span>
                        <span className={`text-sm font-bold tabular-nums ${cfg.corTexto}`}>
                          {moedaBr(item.total)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/60 dark:bg-slate-900/40 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cfg.corBarra} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-bold tabular-nums w-8 text-right ${cfg.corTexto} opacity-70`}
                    >
                      {pct}%
                    </span>
                  </div>
                );
              })}
              {/* Total geral */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  Total Geral
                </span>
                <span className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
                  {moedaBr(resumo.totalVendas)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
              Nenhuma venda registrada neste dia.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface SheetHistoricoFechamentosProps {
  aberto: boolean;
  aoFechar: () => void;
}

/**
 * Sheet lateral que exibe o histórico de fechamentos de caixa.
 * Permite drill-down em cada dia para ver o relatório financeiro completo.
 */
export function SheetHistoricoFechamentos({
  aberto,
  aoFechar,
}: SheetHistoricoFechamentosProps) {
  const [historico, setHistorico] = useState<ItemHistoricoFechamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  // Paginação do histórico
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Controla o drill-down: null = lista, item = detalhe do dia
  const [itemSelecionado, setItemSelecionado] = useState<ItemHistoricoFechamento | null>(null);
  const [resumoDetalhe, setResumoDetalhe] = useState<ResumoDataEspecifica | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  // Carrega o histórico ao abrir o Sheet ou ao trocar de página
  const carregarHistorico = async (pagina: number = 1) => {
    try {
      setCarregando(true);
      const resultado = await obterHistoricoFechamentos(pagina, 15);
      setHistorico(resultado.data);
      setCurrentPage(resultado.page);
      setTotalPages(resultado.totalPages);
    } catch {
      toast.error("Não foi possível carregar o histórico de fechamentos.");
    } finally {
      setCarregando(false);
    }
  };

  const irParaPagina = (pagina: number) => {
    carregarHistorico(pagina);
  };

  // Carrega o relatório detalhado de um dia específico
  const abrirDetalhe = async (item: ItemHistoricoFechamento) => {
    try {
      setCarregandoDetalhe(true);
      setItemSelecionado(item);
      const resumo = await obterResumoDataEspecifica(new Date(item.dataFechamento));
      setResumoDetalhe(resumo);
    } catch {
      toast.error("Não foi possível carregar o relatório deste dia.");
      setItemSelecionado(null);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const voltarParaLista = () => {
    setItemSelecionado(null);
    setResumoDetalhe(null);
  };

  const handleOpenChange = (estado: boolean) => {
    if (estado) {
      // Recarrega o histórico sempre que abrir (voltando para a página 1)
      carregarHistorico(1);
      setCurrentPage(1);
      setItemSelecionado(null);
      setResumoDetalhe(null);
    }
    if (!estado) aoFechar();
  };

  return (
    <Sheet open={aberto} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle>Histórico de Fechamentos</SheetTitle>
              <SheetDescription>
                Últimos 30 fechamentos de caixa. Clique em um dia para ver o relatório completo.
              </SheetDescription>
            </div>
            {!itemSelecionado && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => carregarHistorico(currentPage)}
                disabled={carregando}
                className="shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          {/* ── Vista de carregamento do detalhe ── */}
          {carregandoDetalhe && (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando relatório...</span>
            </div>
          )}

          {/* ── Vista de detalhe do dia ── */}
          {!carregandoDetalhe && itemSelecionado && resumoDetalhe && (
            <RelatorioDetalhadoDia
              item={itemSelecionado}
              resumo={resumoDetalhe}
              aoVoltar={voltarParaLista}
            />
          )}

          {/* ── Lista do histórico ── */}
          {!carregandoDetalhe && !itemSelecionado && (
            <>
              {carregando && (
                <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Carregando histórico...</span>
                </div>
              )}

              {!carregando && historico.length === 0 && (
                <div className="py-16 text-center">
                  <Banknote className="h-10 w-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Nenhum fechamento de caixa registrado.
                  </p>
                </div>
              )}

              {!carregando && historico.length > 0 && (
                <div className="space-y-2">
                  {historico.map((item) => {
                    const bateua = item.diferenca === 0;
                    const sobra = item.diferenca > 0;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => abrirDetalhe(item)}
                        className="w-full text-left rounded-xl border border-border bg-white dark:bg-slate-900 p-4 hover:border-primary hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                              {diaSemana(item.dataFechamento)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {dataCurta(item.dataFechamento)}
                            </p>
                          </div>

                          <div className="shrink-0 text-right space-y-1">
                            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                              {moedaBr(item.valorFechamento)}
                            </p>
                            {/* Badge de status */}
                            {bateua ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs px-2 py-0">
                                Fechou certo
                              </Badge>
                            ) : sobra ? (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-2 py-0">
                                Sobra {moedaBr(item.diferenca)}
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs px-2 py-0">
                                Falta {moedaBr(Math.abs(item.diferenca))}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>Vendas: {moedaBr(item.totalVendas)}</span>
                          <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                            Ver relatório →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={irParaPagina}
                    disabled={carregando}
                  />                </div>
              )}
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
