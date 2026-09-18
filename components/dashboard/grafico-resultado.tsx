"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CabecalhoCard } from "./cabecalho-card";
import { Superficie, formatarMoeda, formatarMoedaCompacta } from "@/components/ui/pagina";

type LinhaResultado = {
  mes: string;
  receita: number;
  despesas: number;
  lucro: number;
};

type GraficoResultadoProps = {
  dados: LinhaResultado[];
};

// Teto derivado dos dados e arredondado para um número limpo. Nunca fixo.
function arredondarTeto(valor: number): number {
  if (valor <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(valor));
  const passo = magnitude / 2;
  return Math.ceil(valor / passo) * passo;
}

function lerNumero(objeto: object, chave: string): number | null {
  if (!(chave in objeto)) return null;
  const valor = Reflect.get(objeto, chave);
  return typeof valor === "number" ? valor : null;
}

export function GraficoResultado({ dados }: GraficoResultadoProps) {
  const [montado, setMontado] = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  const ultimoIndice = dados.length - 1;

  const maiorValor = dados.reduce(
    (maior, linha) => Math.max(maior, linha.receita, linha.despesas, linha.lucro),
    0
  );
  const menorLucro = dados.reduce((menor, linha) => Math.min(menor, linha.lucro), 0);

  const teto = arredondarTeto(maiorValor) || 100;
  const piso = menorLucro < 0 ? -arredondarTeto(Math.abs(menorLucro)) : 0;

  return (
    <Superficie className="gap-0 p-0">
      <CabecalhoCard
        titulo="Receita × Despesa × Lucro — 12 meses"
        acao={
          <button
            type="button"
            onClick={() => setMostrarTabela((atual) => !atual)}
            aria-pressed={mostrarTabela}
            className="hover:text-foreground"
          >
            {mostrarTabela ? "Ver gráfico" : "Ver tabela"}
          </button>
        }
      />
      <div className="px-3 pb-3 pt-2.5">

      {mostrarTabela ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-normal">Mês</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Receita</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Despesa</th>
                <th scope="col" className="py-2 text-right font-normal">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((linha) => (
                <tr key={linha.mes} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">{linha.mes}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                    {formatarMoeda(linha.receita)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                    {formatarMoeda(linha.despesas)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-foreground">
                    {formatarMoeda(linha.lucro)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[300px]">
          {montado ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dados} margin={{ top: 16, right: 16, bottom: 0, left: 8 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="mes"
                  stroke="var(--border)"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickLine={false}
                  className="tabular-nums"
                />
                <YAxis
                  domain={[piso, teto]}
                  stroke="var(--border)"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickLine={false}
                  width={78}
                  tickFormatter={(valor: number) => formatarMoedaCompacta(valor)}
                  className="tabular-nums"
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(valor, nome) => [formatarMoeda(Number(valor)), String(nome)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="receita"
                  name="Receita"
                  fill="var(--receita)"
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="despesas"
                  name="Despesa"
                  fill="var(--despesa)"
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="linear"
                  dataKey="lucro"
                  name="Lucro"
                  stroke="var(--lucro)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                >
                  <LabelList
                    dataKey="lucro"
                    content={(props: unknown) => {
                      if (typeof props !== "object" || props === null) return null;

                      const indice = lerNumero(props, "index");
                      const x = lerNumero(props, "x");
                      const y = lerNumero(props, "y");
                      const valor = lerNumero(props, "value");

                      if (indice !== ultimoIndice || x === null || y === null || valor === null) {
                        return null;
                      }

                      return (
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="end"
                          fill="var(--foreground)"
                          fontSize={12}
                        >
                          {formatarMoedaCompacta(valor)}
                        </text>
                      );
                    }}
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      )}
      </div>
    </Superficie>
  );
}
