"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FaturamentoHome } from "@/app/actions/dashboard";
import { Painel } from "@/components/ui/painel";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { CabecalhoCard } from "./cabecalho-card";
import { formatarMoeda, formatarMoedaCompacta, formatarPercentual } from "@/components/ui/pagina";

type GraficoReceitaProps = {
  serie: FaturamentoHome["serie"];
  margemLiquidaPercentual: number | null;
};

// Teto derivado dos dados e arredondado para um número limpo. Nunca fixo.
function arredondarTeto(valor: number): number {
  if (valor <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(valor));
  const passo = magnitude / 2;
  return Math.ceil(valor / passo) * passo;
}

const inscreverSemNotificar = () => () => {};

/**
 * `true` só depois da hidratação — via `useSyncExternalStore` (não
 * `useEffect` + `setState`, que o eslint-plugin-react-hooks recusa por
 * cascata de render) pra nunca montar o `ResponsiveContainer` do Recharts no
 * servidor, onde ele mede largura/altura -1 e solta warning.
 */
function useMontadoNoCliente(): boolean {
  return useSyncExternalStore(
    inscreverSemNotificar,
    () => true,
    () => false
  );
}

export function GraficoReceita({ serie, margemLiquidaPercentual }: GraficoReceitaProps) {
  const montado = useMontadoNoCliente();
  const [mostrarTabela, setMostrarTabela] = useState(false);

  const temDado = serie.some((linha) => linha.servicos > 0 || linha.produtos > 0);
  const maiorValor = serie.reduce((maior, linha) => Math.max(maior, linha.servicos, linha.produtos), 0);
  const teto = arredondarTeto(maiorValor) || 100;

  return (
    <Painel>
      <CabecalhoCard
        titulo="Receita — serviços × produtos"
        acao={
          temDado ? (
            <button
              type="button"
              onClick={() => setMostrarTabela((atual) => !atual)}
              aria-pressed={mostrarTabela}
              className="hover:text-kx-texto"
            >
              {mostrarTabela ? "Ver gráfico" : "Ver tabela"}
            </button>
          ) : null
        }
      />

      <div className="px-kx-4 pb-kx-4 pt-kx-3">
        <p className="mb-kx-3 text-sm text-kx-legenda">
          Margem líquida do período:{" "}
          <span className="font-semibold text-kx-texto">
            {margemLiquidaPercentual === null ? "—" : formatarPercentual(margemLiquidaPercentual)}
          </span>
        </p>

        {!temDado ? (
          <EstadoVazio
            titulo="Sem receita no período"
            descricao="Nenhuma venda ou OS finalizada nesse intervalo ainda."
          />
        ) : mostrarTabela ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kx-painel-borda text-left text-xs text-kx-legenda">
                  <th scope="col" className="py-2 pr-3 font-normal">
                    Dia
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">
                    Serviços
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Produtos
                  </th>
                </tr>
              </thead>
              <tbody>
                {serie.map((linha, indice) => (
                  <tr key={`${linha.dia}-${indice}`} className="border-b border-kx-painel-borda/60 last:border-0">
                    <td className="py-2 pr-3 text-kx-legenda">{linha.dia}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-kx-texto">
                      {formatarMoeda(linha.servicos)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-kx-texto">{formatarMoeda(linha.produtos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-[300px]">
            {montado ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={[...serie]} margin={{ top: 16, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--kx-painel-borda)" />
                  <XAxis
                    dataKey="dia"
                    stroke="var(--kx-painel-borda)"
                    tick={{ fill: "var(--kx-legenda)", fontSize: 12 }}
                    tickLine={false}
                    className="tabular-nums"
                  />
                  <YAxis
                    domain={[0, teto]}
                    stroke="var(--kx-painel-borda)"
                    tick={{ fill: "var(--kx-legenda)", fontSize: 12 }}
                    tickLine={false}
                    width={70}
                    tickFormatter={(valor: number) => formatarMoedaCompacta(valor)}
                    className="tabular-nums"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--kx-superficie)", fillOpacity: 0.5 }}
                    contentStyle={{
                      background: "var(--kx-cartao)",
                      border: "1px solid var(--kx-painel-borda)",
                      borderRadius: "0.5rem",
                      color: "var(--kx-texto)",
                      fontSize: 12,
                    }}
                    formatter={(valor, nome) => [formatarMoeda(Number(valor)), String(nome)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="servicos"
                    name="Serviços"
                    stroke="var(--kx-destaque)"
                    fill="var(--kx-destaque)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="produtos"
                    name="Produtos"
                    stroke="var(--kx-pronto)"
                    fill="var(--kx-pronto)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        )}
      </div>
    </Painel>
  );
}
