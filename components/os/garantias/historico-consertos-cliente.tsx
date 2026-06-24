"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { obterHistoricoConsertosCliente, type HistoricoConsertoCliente } from "@/app/actions/garantias";

type HistoricoConsertosClienteProps = {
  osId: string | null;
};

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

export function HistoricoConsertosCliente({ osId }: HistoricoConsertosClienteProps) {
  const [carregando, setCarregando] = useState(false);
  const [linhas, setLinhas] = useState<HistoricoConsertoCliente[]>([]);

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      if (!osId) {
        setLinhas([]);
        return;
      }

      setCarregando(true);
      try {
        const resposta = await obterHistoricoConsertosCliente({ osId });
        if (!ativo) return;
        setLinhas(resposta);
      } catch {
        if (!ativo) return;
        setLinhas([]);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();

    return () => {
      ativo = false;
    };
  }, [osId]);

  return (
    <Card className="p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Histórico de consertos</h3>

      {carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Carregando histórico...</p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Nenhum histórico disponível.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {linhas.map((linha) => (
            <div key={linha.osId} className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-slate-100">{linha.numeroOS}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(linha.data).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{linha.equipamento}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{linha.defeitoRelatado}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Valor: {formatarMoeda(linha.valorCobrado)} | Status: {linha.statusFinal.replaceAll("_", " ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
