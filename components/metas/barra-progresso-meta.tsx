"use client";

import { cn } from "@/lib/utils";

type BarraProgressoMetaProps = {
  progresso: number; // 0-100
  status?: string;
  className?: string;
  showLabel?: boolean;
};

function corBarra(progresso: number, status?: string): string {
  if (status === "CONCLUIDA") return "bg-kx-sucesso";
  if (status === "CANCELADA" || status === "PAUSADA") return "bg-kx-legenda";
  if (status === "ATRASADA") return "bg-kx-erro";
  if (status === "ATENCAO") return "bg-kx-alerta";
  if (progresso >= 80) return "bg-kx-sucesso";
  if (progresso >= 50) return "bg-kx-info";
  return "bg-kx-superficie0";
}

export function BarraProgressoMeta({ progresso, status, className, showLabel = true }: BarraProgressoMetaProps) {
  const cor = corBarra(progresso, status);
  const pct = Math.min(100, Math.max(0, progresso));

  return (
    <div className={cn("w-full", className)}>
      <div className= "w-full bg-kx-painel-borda rounded-full h-2 overflow-hidden">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", cor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className= "text-xs text-kx-legenda mt-1 text-right">
          {pct}%
        </p>
      )}
    </div>
  );
}
