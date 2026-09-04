"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CabecalhoCard } from "./cabecalho-card";
import { Superficie, formatarMoeda, formatarMoedaCompacta } from "@/components/ui/pagina";

type LinhaSaldo = {
  mes: string;
  saldo: number;
};

type GraficoSaldoProps = {
  dados: readonly LinhaSaldo[];
};

function arredondarEscala(valor: number): number {
  if (valor <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(valor));
  const passo = magnitude / 2;
  return Math.ceil(valor / passo) * passo;
}

export function GraficoSaldo({ dados }: GraficoSaldoProps) {
  const [montado, setMontado] = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  const maior = dados.reduce((acc, linha) => Math.max(acc, linha.saldo), 0);
  const menor = dados.reduce((acc, linha) => Math.min(acc, linha.saldo), 0);
  const teto = arredondarEscala(maior) || 100;
  const piso = menor < 0 ? -arredondarEscala(Math.abs(menor)) : 0;

  return (
    <Superficie className="gap-0 p-0">
      <CabecalhoCard
        titulo="Saldo acumulado"
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
                <th scope="col" className="py-2 text-right font-normal">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((linha) => (
                <tr key={linha.mes} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">{linha.mes}</td>
                  <td className="py-2 text-right tabular-nums text-foreground">
                    {formatarMoeda(linha.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[240px]">
          {montado ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...dados]} margin={{ top: 12, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="mes"
                  stroke="hsl(var(--border))"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  className="tabular-nums"
                />
                <YAxis
                  domain={[piso, teto]}
                  stroke="hsl(var(--border))"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  width={78}
                  tickFormatter={(valor: number) => formatarMoedaCompacta(valor)}
                  className="tabular-nums"
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                  formatter={(valor) => [formatarMoeda(Number(valor)), "Saldo"]}
                />
                <Line
                  type="linear"
                  dataKey="saldo"
                  name="Saldo"
                  stroke="var(--receita)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      )}
      </div>
    </Superficie>
  );
}
