"use client";

import { useSyncExternalStore } from "react";

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { DadosStatusOS } from "@/types/indice";

interface GraficoStatusOSProps {
  dados: DadosStatusOS[];
}

/**
 * Componente de Gráfico em Donut para Status de Ordens de Serviço
 */
export function GraficoStatusOS({ dados }: GraficoStatusOSProps) {
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Status das Ordens de Serviço
        </h2>

        {!montado && <div className="h-[300px] w-full" />}

        {montado && (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dados}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="quantidade"
                nameKey="nome"
              >
                {dados.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cor} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => value}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}

        {/* Legenda Detalhada */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          {dados.map((item) => (
            <div key={item.nome} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.cor }}
              />
              <div className="text-sm">
                <p className="text-zinc-700 dark:text-zinc-300">{item.nome}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  {item.quantidade} ({item.percentual}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
