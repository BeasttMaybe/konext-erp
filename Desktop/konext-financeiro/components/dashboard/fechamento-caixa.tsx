import { obterDadosFechamentoCaixa } from "@/app/actions/dashboard-inicial";
import { META_DIARIA_REAIS, type ItemFormaFechamento } from "@/types/fechamento-caixa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  ShoppingCart,
  Wrench,
  Banknote,
  Target,
  CreditCard,
  Wallet,
  QrCode,
  Receipt,
  Building2,
  BadgeDollarSign,
} from "lucide-react";

// ── Formatador de moeda brasileira ────────────────────────────────────────────
const moedaBr = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ── Configuração visual por forma de pagamento ────────────────────────────────
const CONFIG_FORMA: Record<
  string,
  { cor: string; corTexto: string; corBarra: string; Icone: React.ElementType }
> = {
  PIX:            { cor: "bg-teal-50 dark:bg-teal-950/30",    corTexto: "text-teal-700 dark:text-teal-300",     corBarra: "bg-teal-500",   Icone: QrCode          },
  TED:            { cor: "bg-cyan-50 dark:bg-cyan-950/30",    corTexto: "text-cyan-700 dark:text-cyan-300",     corBarra: "bg-cyan-500",   Icone: QrCode          },
  DINHEIRO:       { cor: "bg-emerald-50 dark:bg-emerald-950/30", corTexto: "text-emerald-700 dark:text-emerald-300", corBarra: "bg-emerald-500", Icone: Wallet          },
  CARTAO_CREDITO: { cor: "bg-violet-50 dark:bg-violet-950/30", corTexto: "text-violet-700 dark:text-violet-300",  corBarra: "bg-violet-500", Icone: CreditCard      },
  CARTAO_CREDITO_AVISTA: { cor: "bg-fuchsia-50 dark:bg-fuchsia-950/30", corTexto: "text-fuchsia-700 dark:text-fuchsia-300", corBarra: "bg-fuchsia-500", Icone: CreditCard },
  CARTAO_CREDITO_PARCELADO: { cor: "bg-pink-50 dark:bg-pink-950/30", corTexto: "text-pink-700 dark:text-pink-300", corBarra: "bg-pink-500", Icone: CreditCard },
  CARTAO_DEBITO:  { cor: "bg-blue-50 dark:bg-blue-950/30",    corTexto: "text-blue-700 dark:text-blue-300",     corBarra: "bg-blue-500",   Icone: CreditCard      },
  BOLETO:         { cor: "bg-orange-50 dark:bg-orange-950/30", corTexto: "text-orange-700 dark:text-orange-300",  corBarra: "bg-orange-500", Icone: Receipt         },
  CREDIARIO:      { cor: "bg-amber-50 dark:bg-amber-950/30",  corTexto: "text-amber-700 dark:text-amber-300",   corBarra: "bg-amber-500",  Icone: BadgeDollarSign },
  EMPENHO_PUBLICO:{ cor: "bg-slate-50 dark:bg-slate-800/50",  corTexto: "text-slate-700 dark:text-slate-300",   corBarra: "bg-slate-500",  Icone: Building2       },
};

const FALLBACK_CONFIG = {
  cor: "bg-slate-50 dark:bg-slate-800/50",
  corTexto: "text-slate-600 dark:text-slate-400",
  corBarra: "bg-slate-400",
  Icone: Banknote,
};

// ── Sub-componentes ───────────────────────────────────────────────────────────

/** Cartão principal de métrica financeira. */
function CartaoFinanceiro({
  titulo,
  valor,
  sublinhaPositivo,
  sublinhaDescricao,
  icone,
  classeIcone,
  classeBorda,
}: {
  titulo: string;
  valor: number;
  sublinhaPositivo?: boolean;
  sublinhaDescricao?: string;
  icone: React.ReactNode;
  classeIcone: string;
  classeBorda: string;
}) {
  const corValor =
    sublinhaPositivo === undefined
      ? "text-slate-900 dark:text-slate-50"
      : valor >= 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400";

  return (
    <Card className={`border-l-4 ${classeBorda} bg-white dark:bg-slate-900 shadow-sm`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              {titulo}
            </p>
            <p className={`text-2xl font-extrabold tabular-nums leading-tight ${corValor}`}>
              {moedaBr.format(valor)}
            </p>
            {sublinhaDescricao && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 leading-snug">
                {sublinhaDescricao}
              </p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${classeIcone} shrink-0`}>{icone}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Linha individual de uma forma de pagamento no detalhamento. */
function LinhaFormaPagamento({
  item,
  total,
}: {
  item: ItemFormaFechamento;
  total: number;
}) {
  const percentual = total > 0 ? Math.round((item.valor / total) * 100) : 0;
  const cfg = CONFIG_FORMA[item.forma] ?? FALLBACK_CONFIG;
  const { Icone } = cfg;

  return (
    <div className={`rounded-xl p-4 ${cfg.cor} flex items-center gap-4`}>
      {/* Ícone da forma de pagamento */}
      <div className={`shrink-0 w-9 h-9 rounded-lg bg-white dark:bg-slate-900/60 shadow-sm flex items-center justify-center`}>
        <Icone className={`w-4 h-4 ${cfg.corTexto}`} />
      </div>

      {/* Nome + barra de progresso */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold ${cfg.corTexto}`}>{item.rotulo}</span>
          <span className={`text-sm font-bold tabular-nums ${cfg.corTexto}`}>
            {moedaBr.format(item.valor)}
          </span>
        </div>
        {/* Barra de progresso customizada com cor da forma */}
        <div className="w-full h-1.5 rounded-full bg-white/60 dark:bg-slate-900/40 overflow-hidden">
          <div
            className={`h-full rounded-full ${cfg.corBarra} transition-all duration-500`}
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      {/* Percentual do total */}
      <span className={`shrink-0 text-xs font-bold tabular-nums w-9 text-right ${cfg.corTexto} opacity-70`}>
        {percentual}%
      </span>
    </div>
  );
}

// ── Componente principal (Server Component) ───────────────────────────────────

/**
 * Seção completa de Fechamento de Caixa do dia corrente.
 * Inclui meta diária, resumo financeiro e detalhamento por forma de pagamento.
 */
export async function FechamentoCaixa() {
  const dados = await obterDadosFechamentoCaixa();

  // Cálculo do progresso em relação à meta diária (máx. 100% para a barra)
  const percentualMeta = Math.min((dados.faturamentoTotal / META_DIARIA_REAIS) * 100, 100);
  const percentualMetaExibicao = Math.round(percentualMeta);
  const metaAtingida = dados.faturamentoTotal >= META_DIARIA_REAIS;
  const faltaMeta = META_DIARIA_REAIS - dados.faturamentoTotal;

  return (
    <div className="space-y-6">

      {/* ── Cabeçalho da seção ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Fechamento de Caixa
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidado do dia de hoje — PDV e Ordens de Serviço.
          </p>
        </div>
      </div>

      {/* ── 1. Meta Diária ── */}
      <Card className="bg-white dark:bg-slate-900 shadow-sm border-border overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500" />
        <CardHeader className="pb-2 pt-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Meta Diária
            </CardTitle>
            {metaAtingida ? (
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold px-3 py-1">
                Meta Atingida! 🚀
              </Badge>
            ) : (
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Faltam {moedaBr.format(faltaMeta)} para a meta
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-5">
          <Progress value={percentualMeta} className="h-3 rounded-full" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {moedaBr.format(dados.faturamentoTotal)}
            </span>
            <span className="text-slate-400 dark:text-slate-500 tabular-nums">
              {percentualMetaExibicao}% de {moedaBr.format(META_DIARIA_REAIS)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Resumo Financeiro (3 cartões) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CartaoFinanceiro
          titulo="Total de Entradas"
          valor={dados.faturamentoTotal}
          sublinhaDescricao={`PDV ${moedaBr.format(dados.faturamentoPdv)} · OS ${moedaBr.format(dados.faturamentoOs)}`}
          icone={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          classeIcone="bg-emerald-50 dark:bg-emerald-900/20"
          classeBorda="border-l-emerald-500"
        />
        <CartaoFinanceiro
          titulo="Custo de Mercadoria / Peças"
          valor={dados.custoTotal}
          sublinhaDescricao={`PDV ${moedaBr.format(dados.custoPdv)} · Peças OS ${moedaBr.format(dados.custoOs)}`}
          icone={<Banknote className="h-5 w-5 text-rose-600" />}
          classeIcone="bg-rose-50 dark:bg-rose-900/20"
          classeBorda="border-l-rose-500"
        />
        <CartaoFinanceiro
          titulo="Lucro Bruto"
          valor={dados.lucroBruto}
          sublinhaPositivo
          sublinhaDescricao="Entradas menos custo de mercadoria"
          icone={<BadgeDollarSign className="h-5 w-5 text-blue-600" />}
          classeIcone="bg-blue-50 dark:bg-blue-900/20"
          classeBorda="border-l-blue-500"
        />
      </div>

      {/* ── 3. Detalhamento por Forma de Pagamento ── */}
      <Card className="bg-white dark:bg-slate-900 shadow-sm border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-500" />
            Detalhamento por Forma de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dados.porForma.length > 0 ? (
            <div className="space-y-2.5">
              {dados.porForma.map((item) => (
                <LinhaFormaPagamento
                  key={item.forma}
                  item={item}
                  total={dados.faturamentoTotal}
                />
              ))}

              {/* Linha de total */}
              <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  Total Geral
                </span>
                <span className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
                  {moedaBr.format(dados.faturamentoTotal)}
                </span>
              </div>
            </div>
          ) : (
            /* Estado vazio — sem movimentações no dia */
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <ShoppingCart className="h-10 w-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Nenhuma movimentação registrada hoje.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Origem das Receitas (PDV vs OS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-white dark:bg-slate-900 shadow-sm border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Ponto de Venda (PDV)
                </p>
                <p className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50 mt-0.5">
                  {moedaBr.format(dados.faturamentoPdv)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 shadow-sm border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Ordens de Serviço (OS)
                </p>
                <p className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50 mt-0.5">
                  {moedaBr.format(dados.faturamentoOs)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
