"use client";

import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PontoProjecaoSaldo } from "@/app/actions/financeiro-fluxo";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatarDataCurta = (data: Date) => new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

interface TooltipPayloadItem {
  payload: { data: Date; saldo: number };
}

function TooltipProjecao({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0]!.payload;
  return (
    <div className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-3 py-2 text-xs shadow-kx-cartao">
      <p className="mb-1 font-bold text-kx-texto">{formatarDataCurta(ponto.data)}</p>
      <p className={ponto.saldo < 0 ? "font-semibold text-kx-erro" : "text-kx-texto-2"}>Saldo projetado: {formatarMoeda(ponto.saldo)}</p>
    </div>
  );
}

export function GraficoProjecaoSaldo({ pontos, menorPonto }: { pontos: PontoProjecaoSaldo[]; menorPonto: PontoProjecaoSaldo }) {
  const dados = pontos.map((ponto) => ({ ...ponto, rotulo: formatarDataCurta(ponto.data) }));
  const temSaldoNegativo = menorPonto.saldo < 0;

  return (
    <div className="min-h-0 flex-1">
      <ResponsiveContainer width="100%" height="100%" minHeight={180}>
        <AreaChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradienteSaldoProjetado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--kx-primaria)" stopOpacity={0.28} />
              <stop offset="95%" stopColor="var(--kx-primaria)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-kx-painel-borda" vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 11 }}
            className="fill-kx-legenda"
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(dados.length / 7) - 1)}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="fill-kx-legenda"
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(valor: number) => formatarMoeda(valor).replace(",00", "")}
          />
          <Tooltip content={<TooltipProjecao />} />
          <ReferenceLine y={0} stroke="var(--kx-legenda)" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="saldo" stroke="var(--kx-primaria)" strokeWidth={2.5} fill="url(#gradienteSaldoProjetado)" />
          {temSaldoNegativo && (
            <ReferenceDot
              x={formatarDataCurta(menorPonto.data)}
              y={menorPonto.saldo}
              r={6}
              fill="var(--kx-fundo)"
              stroke="var(--kx-erro)"
              strokeWidth={3}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
