"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  type DadosAnaliticosFinanceiros,
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
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

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
  const [filtroData, setFiltroData] = useState<FiltroDataAnalitico>("MENSAL");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [dados, setDados] = useState<DadosAnaliticosFinanceiros | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregarDados = async () => {
    try {
      setCarregando(true);

      const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`) : undefined;
      const fim = dataFim ? new Date(`${dataFim}T23:59:59`) : undefined;

      const resposta = await obterDadosAnaliticos(filtroData, inicio, fim);
      setDados({
        ...resposta,
        periodo: {
          ...resposta.periodo,
          inicio: new Date(resposta.periodo.inicio),
          fim: new Date(resposta.periodo.fim),
        },
      });
    } catch {
      toast.error("Nao foi possivel carregar os dados analiticos.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const dadosGraficoTopGastos = useMemo(() => {
    if (!dados) return [];
    return [...dados.topGastos].sort((a, b) => b.valor - a.valor);
  }, [dados]);

  const textoEquilibrio = useMemo(() => {
    if (!dados) return "Sem dados para avaliacao.";

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

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
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

      <div className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-6 lg:px-8 py-3">
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
              <p className="text-sm text-muted-foreground">Receita Recorrente (MRR)</p>
              <p className="text-3xl font-bold text-emerald-500 mt-2">
                {formatarMoeda(dados?.indicadores.receitaRecorrenteMensal ?? 0)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Receita previsivel de contratos e clube de beneficios.
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
                {`${(dados?.indicadores.pontoEquilibrioPercentual ?? 0).toFixed(2)}% do objetivo`}
              </p>
            </Card>
          </div>

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
