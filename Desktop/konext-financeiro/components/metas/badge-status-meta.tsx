"use client";

import { Badge } from "@/components/ui/badge";
import type { StatusMeta } from "@prisma/client";

const configStatus: Record<StatusMeta, { label: string; classe: string }> = {
  EM_ANDAMENTO: { label: "Em andamento", classe: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700" },
  ATENCAO:      { label: "Atenção",       classe: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-700" },
  ATRASADA:     { label: "Atrasada",      classe: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700" },
  CONCLUIDA:    { label: "Concluída",     classe: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700" },
  PAUSADA:      { label: "Pausada",       classe: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" },
  CANCELADA:    { label: "Cancelada",     classe: "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-700 line-through" },
};

export function BadgeStatusMeta({ status }: { status: StatusMeta }) {
  const cfg = configStatus[status];
  return (
    <Badge className={`border text-xs font-medium ${cfg.classe}`}>
      {cfg.label}
    </Badge>
  );
}
