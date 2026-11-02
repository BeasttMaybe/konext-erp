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
  CRIACAO: "bg-kx-info",
  ATUALIZACAO_PROGRESSO: "bg-kx-sucesso",
  ALTERACAO_STATUS: "bg-kx-garantia",
  ALTERACAO_PRAZO: "bg-kx-alerta",
  ALTERACAO_CHECKLIST: "bg-kx-info",
  SINCRONIZACAO_AUTOMATICA: "bg-kx-info",
  CONCLUSAO: "bg-kx-sucesso",
  PAUSA: "bg-kx-superficie0",
  CANCELAMENTO: "bg-kx-erro",
  OBSERVACAO: "bg-kx-legenda",
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
      <p className="text-sm text-kx-legenda text-center py-6">
        Sem histórico registrado.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-kx-painel-borda space-y-4 pl-6">
      {entradas.map((entrada) => (
        <li key={entrada.id} className="relative">
          <span
            className={`absolute -left-[1.35rem] top-1 w-3 h-3 rounded-full border-2 border-kx-painel ${corTipo[entrada.tipo]}`}
          />
          <p className="text-xs font-semibold text-kx-legenda mb-0.5">
            {labelTipo[entrada.tipo]}
            <span className="ml-2 font-normal">
              {formatarDataHoraBrasileira(new Date(entrada.criadoEm))}
            </span>
          </p>
          <p className="text-sm text-kx-texto">{entrada.descricao}</p>
          {(entrada.valorAnterior !== null || entrada.valorNovo !== null) && (
            <p className="text-xs text-kx-legenda mt-0.5">
              {entrada.valorAnterior !== null && `De: ${entrada.valorAnterior} `}
              {entrada.valorNovo !== null && `→ Para: ${entrada.valorNovo}`}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
