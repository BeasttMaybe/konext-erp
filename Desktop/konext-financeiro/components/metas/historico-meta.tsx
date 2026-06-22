"use client";

import { formatarDataHoraBrasileira } from "@/lib/formatadores";
import type { TipoHistoricoMeta } from "@prisma/client";

const labelTipo: Record<TipoHistoricoMeta, string> = {
  CRIACAO: "Meta criada",
  ATUALIZACAO_PROGRESSO: "Progresso atualizado",
  ALTERACAO_STATUS: "Status alterado",
  ALTERACAO_PRAZO: "Prazo alterado",
  ALTERACAO_CHECKLIST: "Checklist atualizado",
  SINCRONIZACAO_AUTOMATICA: "Sincronização automática",
  CONCLUSAO: "Meta concluída",
  PAUSA: "Meta pausada",
  CANCELAMENTO: "Meta cancelada",
  OBSERVACAO: "Observação",
};

const corTipo: Record<TipoHistoricoMeta, string> = {
  CRIACAO: "bg-blue-500",
  ATUALIZACAO_PROGRESSO: "bg-emerald-500",
  ALTERACAO_STATUS: "bg-violet-500",
  ALTERACAO_PRAZO: "bg-orange-500",
  ALTERACAO_CHECKLIST: "bg-sky-500",
  SINCRONIZACAO_AUTOMATICA: "bg-cyan-500",
  CONCLUSAO: "bg-emerald-600",
  PAUSA: "bg-slate-500",
  CANCELAMENTO: "bg-red-500",
  OBSERVACAO: "bg-slate-400",
};

type EntradaHistorico = {
  id: string;
  tipo: TipoHistoricoMeta;
  descricao: string;
  valorAnterior: number | null;
  valorNovo: number | null;
  criadoEm: string;
};

export function HistoricoMeta({ entradas }: { entradas: EntradaHistorico[] }) {
  if (entradas.length === 0) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
        Sem histórico registrado.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-slate-200 dark:border-slate-700 space-y-4 pl-6">
      {entradas.map((entrada) => (
        <li key={entrada.id} className="relative">
          <span
            className={`absolute -left-[1.35rem] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${corTipo[entrada.tipo]}`}
          />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
            {labelTipo[entrada.tipo]}
            <span className="ml-2 font-normal">
              {formatarDataHoraBrasileira(new Date(entrada.criadoEm))}
            </span>
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{entrada.descricao}</p>
          {(entrada.valorAnterior !== null || entrada.valorNovo !== null) && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {entrada.valorAnterior !== null && `De: ${entrada.valorAnterior} `}
              {entrada.valorNovo !== null && `→ Para: ${entrada.valorNovo}`}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
