"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarRange,
  Landmark,
  Users,
} from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Segmento = "PF" | "PJ" | "PUBLICO";
type Periodo = "ESTA_SEMANA" | "ESTE_MES" | "ESTE_ANO" | "PERSONALIZADO";

type LinhaReceita = {
  periodo: string;
  receitaPF: number;
  receitaPJ: number;
  receitaPublico: number;
  despesas: number;
};

type ClienteRanking = {
  nome: string;
  segmento: Segmento;
  totalGasto: number;
};

type CategoriaDespesa = {
  categoria: string;
  participacao: number;
};

type LinhaLiquidezPublica = {
  periodo: string;
  capitalInvestido: number;
  previsaoRecebimentoEmpenho: number;
};

type LinhaRentabilidadeNegocio = {
  unidadeNegocio: string;
  faturamentoBruto: number;
  lucroLiquido: number;
};

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dadosReceitaMensalMock: LinhaReceita[] = [
  { periodo: "Jan", receitaPF: 29000, receitaPJ: 52000, receitaPublico: 34000, despesas: 72000 },
  { periodo: "Fev", receitaPF: 30500, receitaPJ: 56000, receitaPublico: 32500, despesas: 73500 },
  { periodo: "Mar", receitaPF: 33200, receitaPJ: 59000, receitaPublico: 36200, despesas: 76000 },
  { periodo: "Abr", receitaPF: 35400, receitaPJ: 60500, receitaPublico: 38100, despesas: 79200 },
  { periodo: "Mai", receitaPF: 36800, receitaPJ: 64500, receitaPublico: 39800, despesas: 81500 },
  { periodo: "Jun", receitaPF: 38100, receitaPJ: 68200, receitaPublico: 42400, despesas: 84000 },
  { periodo: "Jul", receitaPF: 39600, receitaPJ: 70500, receitaPublico: 44000, despesas: 86500 },
  { periodo: "Ago", receitaPF: 41800, receitaPJ: 73200, receitaPublico: 46100, despesas: 89200 },
  { periodo: "Set", receitaPF: 43500, receitaPJ: 75800, receitaPublico: 48400, despesas: 91800 },
  { periodo: "Out", receitaPF: 45200, receitaPJ: 79200, receitaPublico: 50300, despesas: 94600 },
  { periodo: "Nov", receitaPF: 46800, receitaPJ: 82500, receitaPublico: 52600, despesas: 97800 },
  { periodo: "Dez", receitaPF: 48900, receitaPJ: 86400, receitaPublico: 54800, despesas: 101500 },
];

const dadosReceitaSemanalMock: LinhaReceita[] = [
  { periodo: "Sem 1", receitaPF: 11200, receitaPJ: 18600, receitaPublico: 9700, despesas: 25800 },
  { periodo: "Sem 2", receitaPF: 12400, receitaPJ: 20300, receitaPublico: 10500, despesas: 27100 },
  { periodo: "Sem 3", receitaPF: 13700, receitaPJ: 21900, receitaPublico: 11200, despesas: 28600 },
  { periodo: "Sem 4", receitaPF: 14900, receitaPJ: 23400, receitaPublico: 11800, despesas: 30100 },
];

const clientesRankingMock: ClienteRanking[] = [
  { nome: "TechCorp LTDA", segmento: "PJ", totalGasto: 248000 },
  { nome: "Prefeitura Municipal de Itaquera", segmento: "PUBLICO", totalGasto: 239500 },
  { nome: "João Silva", segmento: "PF", totalGasto: 182400 },
  { nome: "Inova Sistemas SA", segmento: "PJ", totalGasto: 171900 },
  { nome: "Secretaria Estadual de Educação", segmento: "PUBLICO", totalGasto: 169700 },
  { nome: "Marina Carvalho", segmento: "PF", totalGasto: 154300 },
  { nome: "Grupo Atlas B2B", segmento: "PJ", totalGasto: 148800 },
  { nome: "Câmara Municipal de Guarulhos", segmento: "PUBLICO", totalGasto: 133500 },
];

const categoriasDespesasBase: CategoriaDespesa[] = [
  { categoria: "Fornecedores de Peças", participacao: 0.29 },
  { categoria: "Folha de Pagamento", participacao: 0.24 },
  { categoria: "Impostos e Taxas", participacao: 0.18 },
  { categoria: "Infraestrutura de Rede", participacao: 0.13 },
  { categoria: "Marketing", participacao: 0.1 },
  { categoria: "Logística e Fretes", participacao: 0.06 },
];

const dadosLiquidezPublicaMock: LinhaLiquidezPublica[] = [
  {
    periodo: "Mês Atual",
    capitalInvestido: 5000,
    previsaoRecebimentoEmpenho: 3200,
  },
  {
    periodo: "Próximos 30 dias",
    capitalInvestido: 7600,
    previsaoRecebimentoEmpenho: 11800,
  },
  {
    periodo: "60 dias",
    capitalInvestido: 9200,
    previsaoRecebimentoEmpenho: 17400,
  },
  {
    periodo: "90 dias",
    capitalInvestido: 10400,
    previsaoRecebimentoEmpenho: 22600,
  },
];

const dadosRentabilidadeUnidadeMock: LinhaRentabilidadeNegocio[] = [
  {
    unidadeNegocio: "Assistência Técnica",
    faturamentoBruto: 348000,
    lucroLiquido: 119500,
  },
  {
    unidadeNegocio: "Venda de Acessórios",
    faturamentoBruto: 214000,
    lucroLiquido: 92800,
  },
  {
    unidadeNegocio: "Infraestrutura/B2B",
    faturamentoBruto: 472000,
    lucroLiquido: 151200,
  },
  {
    unidadeNegocio: "Licitações",
    faturamentoBruto: 538000,
    lucroLiquido: 104300,
  },
];

function somarReceitaPorSegmento(linha: LinhaReceita, segmento: "TODOS" | Segmento): number {
  if (segmento === "PF") return linha.receitaPF;
  if (segmento === "PJ") return linha.receitaPJ;
  if (segmento === "PUBLICO") return linha.receitaPublico;
  return linha.receitaPF + linha.receitaPJ + linha.receitaPublico;
}

function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(valor);
}

function calcularPercentualTendencia(valorAtual: number, valorAnterior: number): number {
  if (valorAnterior === 0) return 0;
  return ((valorAtual - valorAnterior) / valorAnterior) * 100;
}

interface ContainerGraficoSeguroProps {
  children: ReactNode;
}

function ContainerGraficoSeguro({ children }: ContainerGraficoSeguroProps) {
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!montado) {
    return <div className="h-full w-full" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      {children}
    </ResponsiveContainer>
  );
}

function CartaoKPI({
  titulo,
  valor,
  tendencia,
  corBorda,
}: {
  titulo: string;
  valor: string;
  tendencia: number;
  corBorda: string;
}) {
  const tendenciaPositiva = tendencia >= 0;

  return (
    <Card className={`p-5 border ${corBorda} bg-card`}>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="text-3xl font-bold text-foreground">{valor}</p>
        <div className={`flex items-center gap-1 text-xs font-medium ${tendenciaPositiva ? "text-emerald-600" : "text-red-600"}`}>
          {tendenciaPositiva ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {Math.abs(tendencia).toFixed(1)}% em relação ao período anterior
        </div>
      </div>
    </Card>
  );
}

export default function PaginaFinanceiroAvancado() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState<Periodo>("ESTE_ANO");
  const [segmentoSelecionado, setSegmentoSelecionado] = useState<"TODOS" | Segmento>("TODOS");
  const [dataInicialPersonalizada, setDataInicialPersonalizada] = useState("");
  const [dataFinalPersonalizada, setDataFinalPersonalizada] = useState("");

  const dadosPeriodo = useMemo(() => {
    if (periodoSelecionado === "ESTE_ANO" || periodoSelecionado === "PERSONALIZADO") {
      return dadosReceitaMensalMock;
    }
    return dadosReceitaSemanalMock;
  }, [periodoSelecionado]);

  const dadosEvolucao = useMemo(() => {
    return dadosPeriodo.map((linha) => ({
      periodo: linha.periodo,
      faturamentoBruto: somarReceitaPorSegmento(linha, segmentoSelecionado),
      despesas: linha.despesas,
    }));
  }, [dadosPeriodo, segmentoSelecionado]);

  const resumoFinanceiro = useMemo(() => {
    const faturamentoBruto = dadosEvolucao.reduce((acumulador, linha) => acumulador + linha.faturamentoBruto, 0);
    const totalDespesas = dadosEvolucao.reduce((acumulador, linha) => acumulador + linha.despesas, 0);
    const lucroLiquido = faturamentoBruto - totalDespesas;
    const margemLucro = faturamentoBruto > 0 ? (lucroLiquido / faturamentoBruto) * 100 : 0;

    const metade = Math.max(1, Math.floor(dadosEvolucao.length / 2));
    const periodoAnterior = dadosEvolucao.slice(0, metade);
    const periodoAtual = dadosEvolucao.slice(metade);

    const faturamentoAnterior = periodoAnterior.reduce((acumulador, linha) => acumulador + linha.faturamentoBruto, 0);
    const faturamentoAtual = periodoAtual.reduce((acumulador, linha) => acumulador + linha.faturamentoBruto, 0);

    const despesasAnterior = periodoAnterior.reduce((acumulador, linha) => acumulador + linha.despesas, 0);
    const despesasAtual = periodoAtual.reduce((acumulador, linha) => acumulador + linha.despesas, 0);

    const lucroAnterior = faturamentoAnterior - despesasAnterior;
    const lucroAtual = faturamentoAtual - despesasAtual;

    const margemAnterior = faturamentoAnterior > 0 ? (lucroAnterior / faturamentoAnterior) * 100 : 0;

    return {
      faturamentoBruto,
      totalDespesas,
      lucroLiquido,
      margemLucro,
      tendenciaFaturamento: calcularPercentualTendencia(faturamentoAtual, faturamentoAnterior),
      tendenciaDespesas: calcularPercentualTendencia(despesasAtual, despesasAnterior),
      tendenciaLucro: calcularPercentualTendencia(lucroAtual, lucroAnterior),
      tendenciaMargem: calcularPercentualTendencia(margemLucro, margemAnterior),
    };
  }, [dadosEvolucao]);

  const dadosPizzaSegmento = useMemo(() => {
    const totalPF = dadosPeriodo.reduce((acumulador, linha) => acumulador + linha.receitaPF, 0);
    const totalPJ = dadosPeriodo.reduce((acumulador, linha) => acumulador + linha.receitaPJ, 0);
    const totalPublico = dadosPeriodo.reduce((acumulador, linha) => acumulador + linha.receitaPublico, 0);

    const total = totalPF + totalPJ + totalPublico;

    const dados = [
      { nome: "Pessoa Física (PF)", valor: segmentoSelecionado === "TODOS" || segmentoSelecionado === "PF" ? totalPF : 0, cor: "#3b82f6" },
      { nome: "Empresa (PJ)", valor: segmentoSelecionado === "TODOS" || segmentoSelecionado === "PJ" ? totalPJ : 0, cor: "#6366f1" },
      { nome: "Órgão Público", valor: segmentoSelecionado === "TODOS" || segmentoSelecionado === "PUBLICO" ? totalPublico : 0, cor: "#f59e0b" },
    ];

    return dados.map((item) => ({
      ...item,
      percentual: total > 0 ? (item.valor / total) * 100 : 0,
    }));
  }, [dadosPeriodo, segmentoSelecionado]);

  const rankingClientes = useMemo(() => {
    const listaFiltrada =
      segmentoSelecionado === "TODOS"
        ? clientesRankingMock
        : clientesRankingMock.filter((cliente) => cliente.segmento === segmentoSelecionado);

    return [...listaFiltrada]
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 6);
  }, [segmentoSelecionado]);

  const rankingDespesas = useMemo(() => {
    const total = resumoFinanceiro.totalDespesas;

    return categoriasDespesasBase
      .map((categoria) => ({
        categoria: categoria.categoria,
        valor: total * categoria.participacao,
        percentual: categoria.participacao * 100,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [resumoFinanceiro.totalDespesas]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-background">
      <div className="px-6 lg:px-8 py-6 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Inteligência Financeira</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Painel avançado de indicadores, tendências e composição financeira
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-auto">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label>Período</Label>
                <Select
                  value={periodoSelecionado}
                  onValueChange={(valor) => setPeriodoSelecionado(valor as Periodo)}
                >
                  <SelectTrigger className="min-w-[190px]">
                    <CalendarRange className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESTA_SEMANA">Esta Semana</SelectItem>
                    <SelectItem value="ESTE_MES">Este Mês</SelectItem>
                    <SelectItem value="ESTE_ANO">Este Ano</SelectItem>
                    <SelectItem value="PERSONALIZADO">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Segmento</Label>
                <Select
                  value={segmentoSelecionado}
                  onValueChange={(valor) =>
                    setSegmentoSelecionado(valor as "TODOS" | Segmento)
                  }
                >
                  <SelectTrigger className="min-w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PF">Pessoa Física</SelectItem>
                    <SelectItem value="PJ">Empresa B2B</SelectItem>
                    <SelectItem value="PUBLICO">Órgão Público</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {periodoSelecionado === "PERSONALIZADO" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Data Inicial</Label>
                    <Input
                      type="date"
                      value={dataInicialPersonalizada}
                      onChange={(evento) => setDataInicialPersonalizada(evento.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data Final</Label>
                    <Input
                      type="date"
                      value={dataFinalPersonalizada}
                      onChange={(evento) => setDataFinalPersonalizada(evento.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <CartaoKPI
                titulo="Faturamento Bruto"
                valor={formatarMoeda(resumoFinanceiro.faturamentoBruto)}
                tendencia={resumoFinanceiro.tendenciaFaturamento}
                corBorda="border-blue-500/30"
              />
              <CartaoKPI
                titulo="Total de Custos/Despesas"
                valor={formatarMoeda(resumoFinanceiro.totalDespesas)}
                tendencia={resumoFinanceiro.tendenciaDespesas}
                corBorda="border-red-500/30"
              />
              <CartaoKPI
                titulo="Lucro Líquido"
                valor={formatarMoeda(resumoFinanceiro.lucroLiquido)}
                tendencia={resumoFinanceiro.tendenciaLucro}
                corBorda="border-emerald-500/30"
              />
              <CartaoKPI
                titulo="Margem de Lucro (%)"
                valor={`${resumoFinanceiro.margemLucro.toFixed(2)}%`}
                tendencia={resumoFinanceiro.tendenciaMargem}
                corBorda="border-violet-500/30"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="xl:col-span-2 p-5 border-border bg-card min-w-0">
                <h2 className="text-base font-semibold text-foreground mb-4">
                  Evolução do Faturamento vs Despesas
                </h2>
                <div className="h-[360px] w-full">
                    <ContainerGraficoSeguro>
                    <AreaChart data={dadosEvolucao}>
                      <defs>
                        <linearGradient id="corReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="corDespesa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="periodo" />
                      <YAxis
                        tickFormatter={(valor) =>
                          new Intl.NumberFormat("pt-BR", {
                            notation: "compact",
                            compactDisplay: "short",
                          }).format(valor)
                        }
                      />
                      <Tooltip
                        formatter={(valor) => formatarMoeda(Number(valor ?? 0))}
                        labelFormatter={(rotulo) => `Período: ${rotulo}`}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="faturamentoBruto"
                        name="Faturamento"
                        stroke="#22c55e"
                        fill="url(#corReceita)"
                        strokeWidth={2.5}
                      />
                      <Line
                        type="monotone"
                        dataKey="despesas"
                        name="Despesas"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </AreaChart>
                  </ContainerGraficoSeguro>
                </div>
              </Card>

              <Card className="p-5 border-border bg-card min-w-0">
                <h2 className="text-base font-semibold text-foreground mb-4">Receita por Segmento</h2>
                <div className="h-[360px] w-full">
                  <ContainerGraficoSeguro>
                    <PieChart>
                      <Pie
                        data={dadosPizzaSegmento}
                        dataKey="valor"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={2}
                      >
                        {dadosPizzaSegmento.map((entrada) => (
                          <Cell key={entrada.nome} fill={entrada.cor} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(valor, _nome, contexto: any) => {
                          const valorNumerico = Number(valor ?? 0);
                          const percentual = contexto?.payload?.percentual ?? 0;
                          return [
                            `${formatarMoeda(valorNumerico)} (${percentual.toFixed(1)}%)`,
                            "Receita",
                          ];
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ContainerGraficoSeguro>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="p-5 border-border bg-card min-w-0">
                <h2 className="text-base font-semibold text-foreground mb-4">
                  Top Clientes (Maiores Receitas)
                </h2>
                <div className="space-y-3">
                  {rankingClientes.map((cliente, indice) => (
                    <div
                      key={cliente.nome}
                      className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">#{indice + 1}</p>
                        <p className="font-medium text-foreground truncate">{cliente.nome}</p>
                      </div>
                      <p className="font-semibold text-foreground">{formatarMoeda(cliente.totalGasto)}</p>
                    </div>
                  ))}
                  {rankingClientes.length === 0 && (
                    <p className="text-sm text-muted-foreground">Não há clientes para o filtro aplicado.</p>
                  )}
                </div>
              </Card>

              <Card className="p-5 border-border bg-card min-w-0">
                <h2 className="text-base font-semibold text-foreground mb-4">
                  Maiores Despesas (Onde o Dinheiro Foi)
                </h2>
                <div className="space-y-3">
                  {rankingDespesas.map((item) => (
                    <div key={item.categoria} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-foreground font-medium">{item.categoria}</span>
                        <span className="text-muted-foreground">{formatarMoeda(item.valor)}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500"
                          style={{ width: `${item.percentual.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5 border-border bg-card">
                <h2 className="text-base font-semibold text-foreground mb-4">
                  Mapa de Liquidez Pública
                </h2>
                <div className="h-[360px] w-full">
                  <ContainerGraficoSeguro>
                    <ComposedChart data={dadosLiquidezPublicaMock}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="periodo" />
                      <YAxis
                        tickFormatter={(valor) =>
                          new Intl.NumberFormat("pt-BR", {
                            notation: "compact",
                            compactDisplay: "short",
                          }).format(valor)
                        }
                      />
                      <Tooltip
                        labelFormatter={(rotulo) => `Período: ${rotulo}`}
                        formatter={(valor, nome) => [
                          formatarMoeda(Number(valor ?? 0)),
                          String(nome),
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="capitalInvestido"
                        name="Capital Investido"
                        fill="#f97316"
                        radius={[6, 6, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="previsaoRecebimentoEmpenho"
                        name="Previsão de Recebimento (Empenho)"
                        stroke="#22c55e"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ContainerGraficoSeguro>
                </div>
              </Card>

              <Card className="p-5 border-border bg-card">
                <h2 className="text-base font-semibold text-foreground mb-4">
                  Rentabilidade por Unidade de Negócio
                </h2>
                <div className="h-[360px] w-full">
                  <ContainerGraficoSeguro>
                    <BarChart data={dadosRentabilidadeUnidadeMock} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="unidadeNegocio" tick={{ fontSize: 11 }} />
                      <YAxis
                        tickFormatter={(valor) =>
                          new Intl.NumberFormat("pt-BR", {
                            notation: "compact",
                            compactDisplay: "short",
                          }).format(valor)
                        }
                      />
                      <Tooltip
                        labelFormatter={(rotulo) => `Unidade: ${rotulo}`}
                        formatter={(valor, nome, contexto: any) => {
                          const valorNumerico = Number(valor ?? 0);
                          const faturamentoBruto = Number(contexto?.payload?.faturamentoBruto ?? 0);
                          const lucroLiquido = Number(contexto?.payload?.lucroLiquido ?? 0);
                          const margemLucro = faturamentoBruto > 0 ? (lucroLiquido / faturamentoBruto) * 100 : 0;

                          if (nome === "Lucro Líquido") {
                            return [
                              `${formatarMoeda(valorNumerico)} (Margem ${margemLucro.toFixed(1)}%)`,
                              String(nome),
                            ];
                          }

                          return [formatarMoeda(valorNumerico), String(nome)];
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="faturamentoBruto"
                        name="Faturamento Bruto"
                        fill="#3b82f6"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="lucroLiquido"
                        name="Lucro Líquido"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ContainerGraficoSeguro>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
