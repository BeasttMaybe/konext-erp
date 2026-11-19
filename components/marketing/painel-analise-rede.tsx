"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AnaliseRede, SerieGrafico } from "@/app/actions/marketing";

const numero = (n: number) => n.toLocaleString("pt-BR");

function TooltipRede({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-3 py-2 text-xs shadow-kx-cartao">
      <p className="mb-1 font-bold text-kx-texto">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-kx-texto-2">
          {item.name}: <span className="font-semibold text-kx-texto">{numero(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Grafico({ grafico }: { grafico: SerieGrafico }) {
  const idGrad = `grad-${grafico.series[0]?.chave ?? "s"}`;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-kx-texto">{grafico.titulo}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {grafico.tipo === "area" ? (
            <AreaChart data={grafico.dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={grafico.series[0]?.cor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={grafico.series[0]?.cor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-kx-painel-borda" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} width={40} allowDecimals={false} />
              <Tooltip content={<TooltipRede />} cursor={{ stroke: "var(--kx-painel-borda)" }} />
              {grafico.series.map((s) => (
                <Area key={s.chave} type="monotone" dataKey={s.chave} name={s.rotulo} stroke={s.cor} strokeWidth={2} fill={`url(#${idGrad})`} />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={grafico.dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-kx-painel-borda" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} width={40} allowDecimals={false} />
              <Tooltip content={<TooltipRede />} cursor={{ fill: "var(--kx-superficie)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {grafico.series.map((s) => (
                <Bar key={s.chave} dataKey={s.chave} name={s.rotulo} fill={s.cor} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PainelAnaliseRede({ analise }: { analise: AnaliseRede }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        {analise.kpis.map((k) => (
          <div key={k.rotulo} className="flex flex-col gap-1 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
            <span className="text-xs font-bold uppercase tracking-wide text-kx-legenda">{k.rotulo}</span>
            <span className="text-2xl font-extrabold text-kx-texto">{numero(k.valor)}</span>
          </div>
        ))}
      </div>

      {analise.graficos.length > 0 ? (
        <div className="flex flex-col gap-5 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5 xl:grid xl:grid-cols-2 xl:gap-6">
          {analise.graficos.map((g) => (
            <Grafico key={g.titulo} grafico={g} />
          ))}
        </div>
      ) : null}

      {analise.aviso ? <p className="text-xs text-kx-legenda">{analise.aviso}</p> : null}
    </>
  );
}
