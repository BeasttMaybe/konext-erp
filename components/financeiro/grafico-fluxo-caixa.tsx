"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SemanaFluxoCaixa } from "@/app/actions/financeiro-hub";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

/** Tooltip e legenda em texto puro — sem cor hardcoded no SVG do recharts (as cores das barras vêm de CSS var lidas via getComputedStyle, não de classe Tailwind). */
function TooltipFluxo({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-3 py-2 text-xs shadow-kx-cartao">
      <p className="mb-1 font-bold text-kx-texto">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-kx-texto-2">
          {item.name}: <span className="font-semibold text-kx-texto">{formatarMoeda(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function GraficoFluxoCaixa({ semanas }: { semanas: SemanaFluxoCaixa[] }) {
  const dados = semanas.map((semana) => ({
    rotulo: semana.projetado ? `${semana.rotulo}*` : semana.rotulo,
    Entradas: semana.entradas,
    Saídas: semana.saidas,
    projetado: semana.projetado,
  }));

  const temProjecao = semanas.some((semana) => semana.projetado);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* flex-1 + min-h-0 no wrapper do grafico, nao no ResponsiveContainer:
          assim ele disputa altura com o paragrafo de legenda abaixo em vez
          de reivindicar 100% do pai e empurrar a legenda pra fora. */}
      <div className="min-h-0 flex-1">
      <ResponsiveContainer width="100%" height="100%" minHeight={140}>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-kx-painel-borda" vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} className="fill-kx-legenda" axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<TooltipFluxo />} cursor={{ fill: "var(--kx-superficie)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Entradas" fill="var(--kx-sucesso)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Saídas" fill="var(--kx-erro)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      </div>
      {temProjecao && (
        <p className="shrink-0 text-[11px] text-kx-legenda">
          * Semana ainda não concluída — valores são o que está agendado (projeção), não o realizado.
        </p>
      )}
    </div>
  );
}
