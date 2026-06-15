"use client";

import { useSyncExternalStore } from "react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { DadosFaturamento } from "@/types/indice";

interface GraficoFaturamentoProps {
  dados: DadosFaturamento[];
}

/**
 * Componente de Gráfico de Faturamento dos últimos 6 meses
 */
export function GraficoFaturamento({ dados }: GraficoFaturamentoProps) {
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Faturamento - Últimos 6 Meses
        </h2>

        {!montado && <div className="h-[300px] w-full" />}

        {montado && (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dados}>
              <defs>
                <linearGradient
                  id="colorFaturamento"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <XAxis
                dataKey="mes"
                className="text-xs text-zinc-600 dark:text-zinc-400"
              />
              <YAxis className="text-xs text-zinc-600 dark:text-zinc-400" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
                formatter={(value) =>
                  typeof value === "number"
                    ? formatadorMoeda.format(value)
                    : value
                }
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="faturamento"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorFaturamento)"
                name="Faturamento"
              />
              {dados.length > 0 && dados[0].meta && (
                <Area
                  type="monotone"
                  dataKey="meta"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMeta)"
                  name="Meta"
                  strokeDasharray="5 5"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
