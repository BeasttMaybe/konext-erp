"use client";

import { Badge } from "@/components/ui/badge";
import type { PrioridadeMeta } from "@prisma/client";

const configPrioridade: Record<PrioridadeMeta, { label: string; classe: string }> = {
  BAIXA:   { label: "Baixa",   classe: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600" },
  MEDIA:   { label: "Média",   classe: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700" },
  ALTA:    { label: "Alta",    classe: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700" },
  CRITICA: { label: "Crítica", classe: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700" },
};

export function BadgePrioridadeMeta({ prioridade }: { prioridade: PrioridadeMeta }) {
  const cfg = configPrioridade[prioridade];
  return (
    <Badge className={`border text-xs font-medium ${cfg.classe}`}>
      {cfg.label}
    </Badge>
  );
}
