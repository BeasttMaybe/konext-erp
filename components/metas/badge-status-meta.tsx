"use client";

import { Badge } from"@/components/ui/badge";
import type { StatusMeta } from"@prisma/client";

/**
 * Mesma ideia do badge de prioridade: cada status vira uma família de
 * feedback do design system. Em andamento é informativo, atenção avisa,
 * atrasada é erro, concluída é sucesso, e os dois estados inertes (pausada e
 * cancelada) são neutros — a cancelada mantém o risco no texto, que é o que
 * de fato a distingue da pausada.
 */
const configStatus: Record<StatusMeta, { label: string; classe: string }> = {
  EM_ANDAMENTO: { label:"Em andamento", classe:"bg-kx-info-fundo text-kx-info-texto border-kx-info" },
  ATENCAO:      { label:"Atenção",       classe:"bg-kx-alerta-fundo text-kx-alerta-texto border-kx-alerta" },
  ATRASADA:     { label:"Atrasada",      classe:"bg-kx-erro-fundo text-kx-erro-texto border-kx-erro-borda" },
  CONCLUIDA:    { label:"Concluída",     classe:"bg-kx-sucesso-fundo text-kx-sucesso-texto border-kx-sucesso" },
  PAUSADA:      { label:"Pausada",       classe:"bg-kx-superficie text-kx-texto-2 border-kx-painel-borda" },
  CANCELADA:    { label:"Cancelada",     classe:"bg-kx-superficie text-kx-legenda border-kx-painel-borda line-through" },
};

export function BadgeStatusMeta({ status }: { status: StatusMeta }) {
  const cfg = configStatus[status];
  return (
    <Badge className={`border text-xs font-medium ${cfg.classe}`}>
      {cfg.label}
    </Badge>
  );
}
