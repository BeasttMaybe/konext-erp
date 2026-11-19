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

import type { DiaDeMetrica } from "@/lib/zernio/mapeamento";

const diaCurto = (data: string) => {
  const [, mes, dia] = data.split("-");
  return mes && dia ? `${dia}/${mes}` : data;
};

function TooltipPersonalizado({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-3 py-2 text-xs shadow-kx-cartao">
      <p className="mb-1 font-bold text-kx-texto">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-kx-texto-2">
          {item.name}: <span className="font-semibold text-kx-texto">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

export function GraficoDesempenhoGoogle({ porDia }: { porDia: DiaDeMetrica[] }) {
  const dados = porDia.map((d) => ({
    rotulo: diaCurto(d.data),
    Visualizações: d.impressoes,
    Ligações: d.ligacoes,
    Rotas: d.rotas,
    "Cliques no site": d.cliquesSite,
  }));

  if (dados.length === 0) {
    return <p className="text-sm text-kx-legenda">Sem dados no período. O Google entrega os números com 2 a 3 dias de atraso.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-kx-texto">Visualizações por dia</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradVis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--kx-primaria)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--kx-primaria)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-kx-painel-borda" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip content={<TooltipPersonalizado />} cursor={{ stroke: "var(--kx-painel-borda)" }} />
              <Area type="monotone" dataKey="Visualizações" stroke="var(--kx-primaria)" strokeWidth={2} fill="url(#gradVis)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-kx-texto">Contatos por dia</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-kx-painel-borda" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip content={<TooltipPersonalizado />} cursor={{ fill: "var(--kx-superficie)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ligações" fill="var(--kx-sucesso)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Rotas" fill="var(--kx-destaque)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Cliques no site" fill="var(--kx-pronto)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
