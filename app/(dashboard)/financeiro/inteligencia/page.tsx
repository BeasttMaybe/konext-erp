"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, CalendarDays, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  obterDadosAnaliticos,
  obterInteligenciaTaxasPagamento,
  type DadosAnaliticosFinanceiros,
  type DadosInteligenciaTaxasPagamento,
  type FiltroDataAnalitico,
} from "@/app/actions/financeiro-inteligencia";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const coresPizza = ["#334155", "#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#14b8a6"];

interface PontoTooltip {
  color?: string;
  name?: string;
  value?: number | string;
}

interface PropsTooltipCustom {
  active?: boolean;
  label?: string | number;
  payload?: PontoTooltip[];
}

interface ContainerGraficoSeguroProps {
  children: ReactNode;
  height?: number;
}

function ContainerGraficoSeguro({ children, height = 280 }: ContainerGraficoSeguroProps) {
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!montado) {
    return <div className="w-full" style={{ height }} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

function TooltipCustom({ active, label, payload }: PropsTooltipCustom) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 shadow-lg px-3 py-2">
      {typeof label !== "undefined" && (
        <p className="text-xs text-slate-300 mb-2">{String(label)}</p>
      )}
      <div className="space-y-1">
        {payload.map((item, indice) => {
          const valorNumero = typeof item.value === "number" ? item.value : Number(item.value ?? 0);
          return (
            <div key={`${item.name ?? "item"}-${indice}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color || "#94a3b8" }}
                />
                <span className="text-xs text-slate-100">{item.name || "Valor"}</span>
              </div>
              <span className="text-xs font-semibold text-white">{formatarMoeda(valorNumero)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FinanceiroInteligenciaPage() {
  const podeVerFinanceiro = useTemPermissao("dashboard.financeiro");
  const [filtroData, setFiltroData] = useState<FiltroDataAnalitico>("MENSAL");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [dados, setDados] = useState<DadosAnaliticosFinanceiros | null>(null);
  const [dadosTaxas, setDadosTaxas] = useState<DadosInteligenciaTaxasPagamento | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);

      const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`) : undefined;
      const fim = dataFim ? new Date(`${dataFim}T23:59:59`) : undefined;

      const [resposta, respostaTaxas] = await Promise.all([
        obterDadosAnaliticos(filtroData, inicio, fim),
        obterInteligenciaTaxasPagamento(filtroData, inicio, fim),
      ]);
      setDados({
        ...resposta,
        periodo: {
          ...resposta.periodo,
          inicio: new Date(resposta.periodo.inicio),
          fim: new Date(resposta.periodo.fim),
        },
      });
      setDadosTaxas(respostaTaxas);
    } catch {
      toast.error("Nao foi possivel carregar os dados analiticos.");
    } finally {
      setCarregando(false);
    }
  }, [dataFim, dataInicio, filtroData]);

  useEffect(() => {
    // Sem a permissao, nem tenta buscar — a action recusaria mesmo assim.
    if (!podeVerFinanceiro) return;

    const timerId = setTimeout(() => {
      void carregarDados();
    }, 0);

    return () => {
      clearTimeout(timerId);
    };
  }, [carregarDados, podeVerFinanceiro]);

  const dadosGraficoTopGastos = useMemo(() => {
    if (!dados) return [];
    return [...dados.topGastos].sort((a, b) => b.valor - a.valor);
  }, [dados]);

  const textoEquilibrio = useMemo(() => {
    if (!dados) return "Sem dados para avaliacao.";

    if (dados.indicadores.pontoEquilibrioSemBase) {
      return "Sem base de despesas no periodo selecionado para calcular o ponto de equilibrio.";
    }

    if (dados.indicadores.pontoEquilibrioAtingido) {
      return "Ponto de equilibrio atingido no periodo selecionado.";
    }

    return "Ponto de equilibrio ainda nao atingido no periodo selecionado.";
  }, [dados]);

  const totalCurvaAbc = useMemo(() => {
    return (dados?.curvaAbcProdutos ?? []).reduce((acumulado, item) => acumulado + item.valor, 0);
  }, [dados]);

  const saldoPrevisto = useMemo(() => {
    if (!dados) return 0;

    const ultimoPonto = dados.previsaoCaixa[dados.previsaoCaixa.length - 1];
    if (ultimoPonto) return ultimoPonto.saldoProjetado;

    return dados.indicadores.saldoPrevisto;
  }, [dados]);

  const semDadosTaxas = (dadosTaxas?.quantidadePagamentos ?? 0) === 0;

  if (!podeVerFinanceiro) {
    return <AcessoNegado />;
  }

  return (
    <div className="w-full min-h-full flex flex-col bg-transparent">
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full space-y-2">
          <Link
            href="/financeiro"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            Inteligencia Financeira
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Painel analitico com indicadores, composicao de receitas, gastos e previsibilidade de caixa.
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-kx-sticky border-b border-zinc-200/70 bg-white/70 px-6 py-3 backdrop-blur-md dark:border-zinc-800/70 dark:bg-slate-900/55 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="w-full lg:w-52">
            <Label className="text-xs text-muted-foreground">Intervalo</Label>
            <Select value={filtroData} onValueChange={(valor: FiltroDataAnalitico) => setFiltroData(valor)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOJE">Hoje</SelectItem>
                <SelectItem value="SEMANAL">Semanal</SelectItem>
                <SelectItem value="MENSAL">Mensal</SelectItem>
                <SelectItem value="ANUAL">Anual</SelectItem>
                <SelectItem value="CUSTOMIZADO">Customizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtroData === "CUSTOMIZADO" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="lg:min-w-[260px] justify-start">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {dataInicio && dataFim ? `${dataInicio} ate ${dataFim}` : "Selecionar periodo"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 space-y-3">
                <div className="space-y-2">
                  <Label>Data inicial</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(evento) => setDataInicio(evento.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data final</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(evento) => setDataFim(evento.target.value)}
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button onClick={carregarDados} disabled={carregando}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5">
              <p className="text-sm text-muted-foreground">Faturamento Bruto</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {formatarMoeda(dados?.indicadores.faturamentoBruto ?? 0)}
              </p>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5">
              <p className="text-sm text-muted-foreground">Receita Recorrente Estimada (MRR)</p>
              <p className="text-3xl font-bold text-emerald-500 mt-2">
                {formatarMoeda(dados?.indicadores.receitaRecorrenteMensal ?? 0)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Estimativa com base em contas a receber recorrentes e titulos com descricao de clube.
              </p>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5">
              <p className="text-sm text-muted-foreground">Despesas Totais</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {formatarMoeda(dados?.indicadores.despesasTotais ?? 0)}
              </p>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5">
              <p className="text-sm text-muted-foreground">Saldo Previsto</p>
              <p
                className={`text-3xl font-bold mt-2 ${saldoPrevisto >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              >
                {formatarMoeda(saldoPrevisto)}
              </p>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5">
              <p className="text-sm text-muted-foreground">Ponto de Equilibrio</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">{textoEquilibrio}</p>
              <div className="mt-3">
                <Progress value={Math.min(dados?.indicadores.pontoEquilibrioPercentual ?? 0, 100)} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {dados?.indicadores.pontoEquilibrioSemBase
                  ? "Sem base de despesas para percentual"
                  : `${(dados?.indicadores.pontoEquilibrioPercentual ?? 0).toFixed(2)}% do objetivo`}
              </p>
            </Card>
          </div>

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Taxas de Pagamento</p>
                <p className="text-sm text-muted-foreground">
                  Analise de custo por forma com base em registros de VendaPagamento no periodo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <Card className="border-zinc-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                <p className="text-xs text-muted-foreground">Taxas pagas</p>
                <p className="text-2xl font-bold text-rose-500 mt-1">{formatarMoeda(dadosTaxas?.totalTaxas ?? 0)}</p>
              </Card>
              <Card className="border-zinc-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                <p className="text-xs text-muted-foreground">Liquido estimado</p>
                <p className="text-2xl font-bold text-emerald-500 mt-1">{formatarMoeda(dadosTaxas?.totalLiquido ?? 0)}</p>
              </Card>
              <Card className="border-zinc-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                <p className="text-xs text-muted-foreground">Taxa media</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {(dadosTaxas?.percentualMedioTaxa ?? 0).toFixed(2)}%
                </p>
              </Card>
              <Card className="border-zinc-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                <p className="text-xs text-muted-foreground">Maior custo</p>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-2">
                  {dadosTaxas?.formaMaiorCusto ?? "Sem dados"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pagamentos em cartao: {dadosTaxas?.quantidadePagamentosCartao ?? 0}
                </p>
              </Card>
            </div>

            {semDadosTaxas ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ainda nao ha pagamentos com taxa registrados no periodo.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Forma de pagamento</th>
                        <th className="px-3 py-2 text-right font-medium">Bruto</th>
                        <th className="px-3 py-2 text-right font-medium">Taxas</th>
                        <th className="px-3 py-2 text-right font-medium">Liquido</th>
                        <th className="px-3 py-2 text-right font-medium">Taxa media</th>
                        <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dadosTaxas?.porForma ?? []).map((linha) => (
                        <tr key={linha.formaPagamento} className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{linha.formaPagamento}</td>
                          <td className="px-3 py-2 text-right">{formatarMoeda(linha.totalBruto)}</td>
                          <td className="px-3 py-2 text-right text-rose-500">{formatarMoeda(linha.totalTaxas)}</td>
                          <td className="px-3 py-2 text-right text-emerald-500">{formatarMoeda(linha.totalLiquido)}</td>
                          <td className="px-3 py-2 text-right">{linha.percentualMedioTaxa.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right">{linha.quantidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(dadosTaxas?.cartaoCreditoPorParcela.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Taxas por parcela no cartao de credito
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Parcelas</th>
                            <th className="px-3 py-2 text-right font-medium">Bruto</th>
                            <th className="px-3 py-2 text-right font-medium">Taxas</th>
                            <th className="px-3 py-2 text-right font-medium">Liquido</th>
                            <th className="px-3 py-2 text-right font-medium">Taxa media</th>
                            <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(dadosTaxas?.cartaoCreditoPorParcela ?? []).map((linha) => (
                            <tr key={linha.parcelas} className="border-t border-zinc-200 dark:border-zinc-800">
                              <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{linha.parcelas}x</td>
                              <td className="px-3 py-2 text-right">{formatarMoeda(linha.totalBruto)}</td>
                              <td className="px-3 py-2 text-right text-rose-500">{formatarMoeda(linha.totalTaxas)}</td>
                              <td className="px-3 py-2 text-right text-emerald-500">{formatarMoeda(linha.totalLiquido)}</td>
                              <td className="px-3 py-2 text-right">{linha.percentualMedioTaxa.toFixed(2)}%</td>
                              <td className="px-3 py-2 text-right">{linha.quantidade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5 h-[360px]">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Faturamento vs Despesas
              </p>
              <div className="w-full min-w-0">
                <ContainerGraficoSeguro>
                  <ComposedChart data={dados?.serieFaturamentoDespesas ?? []}>
                    <defs>
                      <linearGradient id="gradFaturamentoBarra" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#064e3b" stopOpacity={0.3} />
                      </linearGradient>
                      <linearGradient id="gradDespesasArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#881337" stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="eixo" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Bar
                      dataKey="faturamento"
                      name="Faturamento"
                      fill="url(#gradFaturamentoBarra)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Area
                      type="monotone"
                      dataKey="despesas"
                      name="Area de Despesas"
                      fill="url(#gradDespesasArea)"
                      stroke="transparent"
                    />
                    <Line
                      type="monotone"
                      dataKey="despesas"
                      name="Despesas"
                      stroke="#fb7185"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ContainerGraficoSeguro>
              </div>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5 h-[360px]">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Maiores Fontes de Receita
              </p>
              <div className="w-full min-w-0">
                <ContainerGraficoSeguro>
                  <PieChart>
                    <Pie
                      data={dados?.fontesReceita ?? []}
                      dataKey="valor"
                      nameKey="nome"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={3}
                    >
                      {(dados?.fontesReceita ?? []).map((_, indice) => (
                        <Cell key={`fonte-${indice}`} fill={coresPizza[indice % coresPizza.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                  </PieChart>
                </ContainerGraficoSeguro>
              </div>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5 h-[360px]">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Maiores Gastos do Periodo
              </p>
              <div className="w-full min-w-0">
                <ContainerGraficoSeguro>
                  <BarChart data={dadosGraficoTopGastos} layout="vertical" margin={{ left: 24, right: 16 }}>
                    <defs>
                      <linearGradient id="gradDespesasBarra" x1="1" y1="0" x2="0" y2="0">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#881337" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis dataKey="nome" type="category" width={130} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip content={<TooltipCustom />} />
                    <Bar dataKey="valor" name="Gasto" fill="url(#gradDespesasBarra)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ContainerGraficoSeguro>
              </div>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5 h-[360px]">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Previsibilidade de Caixa
              </p>
              <div className="w-full min-w-0">
                <ContainerGraficoSeguro>
                  <AreaChart data={dados?.previsaoCaixa ?? []}>
                    <defs>
                      <linearGradient id="gradEntradasPrevisao" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#064e3b" stopOpacity={0.06} />
                      </linearGradient>
                      <linearGradient id="gradSaidasPrevisao" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#881337" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="gradSaldoPrevisao" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#312e81" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="eixo" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="saldoProjetado"
                      name="Saldo Projetado"
                      stroke="#818cf8"
                      fill="url(#gradSaldoPrevisao)"
                      strokeWidth={2.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="entradasPrevistas"
                      name="Entradas Previstas"
                      stroke="#10b981"
                      fill="url(#gradEntradasPrevisao)"
                      strokeWidth={1.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="saidasPrevistas"
                      name="Saidas Previstas"
                      stroke="#fb7185"
                      fill="url(#gradSaidasPrevisao)"
                      strokeWidth={1.8}
                    />
                    <Line
                      type="monotone"
                      dataKey="entradasPrevistas"
                      name="Entradas Previstas"
                      stroke="#10b981"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="saidasPrevistas"
                      name="Saidas Previstas"
                      stroke="#fb7185"
                      dot={false}
                    />
                  </AreaChart>
                </ContainerGraficoSeguro>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5 h-[360px]">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Top 5 Clientes Premium
              </p>
              <div className="w-full min-w-0">
                <ContainerGraficoSeguro>
                  <BarChart data={dados?.topClientes ?? []} layout="vertical" margin={{ left: 12, right: 20 }}>
                    <defs>
                      <linearGradient id="gradClientesPremium" x1="1" y1="0" x2="0" y2="0">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#312e81" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis dataKey="nome" type="category" width={150} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip content={<TooltipCustom />} />
                    <Bar dataKey="valor" name="Faturamento" fill="url(#gradClientesPremium)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ContainerGraficoSeguro>
              </div>
            </Card>

            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5 h-[360px]">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Curva ABC - Produtos Campeoes
              </p>
              <div className="space-y-4">
                {(dados?.curvaAbcProdutos ?? []).map((item, indice) => {
                  const percentual = totalCurvaAbc > 0 ? (item.valor / totalCurvaAbc) * 100 : 0;
                  return (
                    <div key={`${item.nome}-${indice}`}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-sm text-slate-100 truncate">{item.nome}</p>
                        <p className="text-sm font-semibold text-emerald-400">{formatarMoeda(item.valor)}</p>
                      </div>
                      <Progress value={percentual} className="h-2" />
                      <p className="text-xs text-slate-400 mt-1">{percentual.toFixed(2)}% de participacao</p>
                    </div>
                  );
                })}

                {(dados?.curvaAbcProdutos.length ?? 0) === 0 && (
                  <p className="text-sm text-slate-400">Sem dados suficientes para calcular a Curva ABC.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
