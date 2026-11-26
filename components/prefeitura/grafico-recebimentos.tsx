"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PontoRecebimentoMes } from "@/app/actions/prefeitura";

const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
const moedaCurta = (valor: number) =>
  valor >= 1000 ? `${(valor / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `${valor}`;

function TooltipRecebido({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-3 py-2 text-xs shadow-kx-cartao">
      <p className="mb-1 font-bold text-kx-texto">{label}</p>
      <p className="text-kx-texto-2">
        Recebido: <span className="font-semibold text-kx-texto">{moeda(payload[0].value)}</span>
      </p>
    </div>
  );
}

export function GraficoRecebimentos({ dados }: { dados: PontoRecebimentoMes[] }) {
  const pontos = dados.map((p) => ({ rotulo: p.rotulo, Recebido: p.valorCentavos / 100 }));
  const vazio = pontos.every((p) => p.Recebido === 0);

  return (
    <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-kx-texto">Recebimentos por mês</span>
        <span className="text-xs text-kx-legenda">Quanto a prefeitura pagou em cada mês (últimos 12 meses).</span>
      </div>
      {vazio ? (
        <p className="py-8 text-center text-sm text-kx-legenda">Ainda não há recebimentos registrados.</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%" minHeight={160}>
            <BarChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-kx-painel-borda" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} className="fill-kx-legenda" axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                className="fill-kx-legenda"
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) => moedaCurta(v)}
              />
              <Tooltip content={<TooltipRecebido />} cursor={{ fill: "var(--kx-superficie)" }} />
              <Bar dataKey="Recebido" fill="var(--kx-sucesso)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
