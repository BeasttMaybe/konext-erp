"use client";

import { useSyncExternalStore } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  Line,
} from "recharts";
import { Card } from "@/components/ui/card";

type LinhaResultadoMensal = {
  mes: string;
  receita: number;
  despesas: number;
  lucro: number;
};

type GraficoResultadoMensalProps = {
  dados: LinhaResultadoMensal[];
};

export function GraficoResultadoMensal({ dados }: GraficoResultadoMensalProps) {
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const moeda = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <Card className="border-zinc-800 bg-slate-950/40 p-5">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Receita x Despesas x Lucro - ultimos 6 meses
          </h2>
          <p className="text-xs text-zinc-400">Visao consolidada para decisao executiva.</p>
        </div>

        {!montado && <div className="h-[300px]" />}

        {montado ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
              <XAxis dataKey="mes" stroke="#a1a1aa" fontSize={12} />
              <YAxis stroke="#a1a1aa" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
                formatter={(valor) => moeda.format(Number(valor ?? 0))}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="receita"
                name="Receita"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="despesas"
                name="Despesas"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.18}
              />
              <Line
                type="monotone"
                dataKey="lucro"
                name="Lucro estimado"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </Card>
  );
}
