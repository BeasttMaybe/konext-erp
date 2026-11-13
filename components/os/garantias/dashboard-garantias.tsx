"use client";

import { ShieldCheck, CalendarClock, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CartaoIndicador } from "@/components/ui/cartao-indicador";
import type { DashboardGarantiasOS } from "@/app/actions/garantias";

type DashboardGarantiasProps = {
  dados: DashboardGarantiasOS;
};

/**
 * Fase 3-2B, Parte 2: só os 3 KPIs pedidos no topo (ativas, vencendo em 7
 * dias, retornos em conserto). "Garantias vencidas", "Taxa de retorno" e
 * "Valor em garantia" saíram do resumo do topo — não pedidos na lista de 3 —
 * mas continuam calculados em obterDashboardGarantiasOS() e disponíveis no
 * tipo DashboardGarantiasOS, só não têm mais cartão aqui. Reportado no
 * retorno desta fase pra confirmar se isso é o esperado.
 */
export function DashboardGarantias({ dados }: DashboardGarantiasProps) {
  return (
    <div className="space-y-kx-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-kx-4">
        <CartaoIndicador
          variante="garantia"
          titulo="Garantias ativas"
          valor={dados.garantiasAtivas}
          icone={<ShieldCheck />}
        />
        <CartaoIndicador
          variante="alerta"
          titulo="Vencendo em 7 dias"
          valor={dados.vencemEm7Dias}
          icone={<CalendarClock />}
        />
        <CartaoIndicador
          variante="azul"
          titulo="Retornos em conserto"
          valor={dados.retornosEmConserto}
          icone={<Wrench />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-kx-4">
        <Card className="p-kx-4 border border-kx-painel-borda bg-kx-cartao">
          <h3 className="font-semibold text-kx-texto">Principais serviços em retorno</h3>
          <div className="mt-3 space-y-2">
            {dados.principaisServicosEmRetorno.length === 0 ? (
              <p className="text-sm text-kx-legenda">Sem retornos registrados.</p>
            ) : (
              dados.principaisServicosEmRetorno.map((item) => (
                <div key={`${item.nome}-${item.quantidade}`} className="flex items-center justify-between text-sm">
                  <span className="text-kx-texto-2">{item.nome}</span>
                  <span className="font-semibold text-kx-texto">{item.quantidade}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-kx-4 border border-kx-painel-borda bg-kx-cartao">
          <h3 className="font-semibold text-kx-texto">Peças com mais retorno</h3>
          <div className="mt-3 space-y-2">
            {dados.pecasComMaisRetorno.length === 0 ? (
              <p className="text-sm text-kx-legenda">Sem retornos registrados.</p>
            ) : (
              dados.pecasComMaisRetorno.map((item) => (
                <div key={`${item.nome}-${item.quantidade}`} className="flex items-center justify-between text-sm">
                  <span className="text-kx-texto-2">{item.nome}</span>
                  <span className="font-semibold text-kx-texto">{item.quantidade}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
