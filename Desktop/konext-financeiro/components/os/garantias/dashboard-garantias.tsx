"use client";

import { Card } from "@/components/ui/card";
import type { DashboardGarantiasOS } from "@/app/actions/garantias";

type DashboardGarantiasProps = {
  dados: DashboardGarantiasOS;
};

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatarPercentual(valor: number): string {
  return `${valor.toFixed(2)}%`;
}

export function DashboardGarantias({ dados }: DashboardGarantiasProps) {
  const cards = [
    { titulo: "Garantias ativas", valor: String(dados.garantiasAtivas) },
    { titulo: "Vencem em 7 dias", valor: String(dados.vencemEm7Dias) },
    { titulo: "Garantias vencidas", valor: String(dados.garantiasVencidas) },
    { titulo: "Com retorno", valor: String(dados.comRetorno) },
    { titulo: "Taxa de retorno", valor: formatarPercentual(dados.taxaRetorno) },
    { titulo: "Valor em garantia", valor: formatarMoeda(dados.valorEmGarantia) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.titulo} className="p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{card.titulo}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-2">{card.valor}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Principais serviços em retorno</h3>
          <div className="mt-3 space-y-2">
            {dados.principaisServicosEmRetorno.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem retornos registrados.</p>
            ) : (
              dados.principaisServicosEmRetorno.map((item) => (
                <div key={`${item.nome}-${item.quantidade}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{item.nome}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.quantidade}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Peças com mais retorno</h3>
          <div className="mt-3 space-y-2">
            {dados.pecasComMaisRetorno.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem retornos registrados.</p>
            ) : (
              dados.pecasComMaisRetorno.map((item) => (
                <div key={`${item.nome}-${item.quantidade}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{item.nome}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.quantidade}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
