"use client";

import { cn } from "@/lib/utils";

type BarraProgressoMetaProps = {
  progresso: number; // 0-100
  status?: string;
  className?: string;
  showLabel?: boolean;
};

function corBarra(progresso: number, status?: string): string {
  if (status === "CONCLUIDA") return "bg-emerald-500";
  if (status === "CANCELADA" || status === "PAUSADA") return "bg-slate-400";
  if (status === "ATRASADA") return "bg-red-500";
  if (status === "ATENCAO") return "bg-yellow-500";
  if (progresso >= 80) return "bg-emerald-500";
  if (progresso >= 50) return "bg-blue-500";
  return "bg-slate-500";
}

export function BarraProgressoMeta({ progresso, status, className, showLabel = true }: BarraProgressoMetaProps) {
  const cor = corBarra(progresso, status);
  const pct = Math.min(100, Math.max(0, progresso));

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", cor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">
          {pct}%
        </p>
      )}
    </div>
  );
}
