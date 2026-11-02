"use client";

import { Badge } from"@/components/ui/badge";
import type { PrioridadeMeta } from"@prisma/client";

/**
 * Cada nível aponta pra uma família de feedback do design system, em vez de
 * escolher um tom do Tailwind por conta: baixa é neutra, média é informativa,
 * alta avisa e crítica é erro. Os tokens já cobrem tema claro e escuro, então
 * não existe mais metade `dark:` pra manter em sincronia com a clara.
 */
const configPrioridade: Record<PrioridadeMeta, { label: string; classe: string }> = {
  BAIXA:   { label:"Baixa",   classe:"bg-kx-superficie text-kx-legenda border-kx-painel-borda" },
  MEDIA:   { label:"Média",   classe:"bg-kx-info-fundo text-kx-info-texto border-kx-info" },
  ALTA:    { label:"Alta",    classe:"bg-kx-alerta-fundo text-kx-alerta-texto border-kx-alerta" },
  CRITICA: { label:"Crítica", classe:"bg-kx-erro-fundo text-kx-erro-texto border-kx-erro-borda" },
};

export function BadgePrioridadeMeta({ prioridade }: { prioridade: PrioridadeMeta }) {
  const cfg = configPrioridade[prioridade];
  return (
    <Badge className={`border text-xs font-medium ${cfg.classe}`}>
      {cfg.label}
    </Badge>
  );
}
