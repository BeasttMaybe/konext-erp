import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, CircleDot } from "lucide-react";

export type TomStatus = "ok" | "atencao" | "critico" | "neutro";

type ChipStatusProps = {
  rotulo: string;
  tom?: TomStatus;
  icone?: ReactNode;
};

const CORES: Record<TomStatus, string | undefined> = {
  ok: "var(--status-ok)",
  atencao: "var(--status-atencao)",
  critico: "var(--status-critico)",
  neutro: undefined,
};

const ICONES: Record<TomStatus, ReactNode> = {
  ok: <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />,
  atencao: <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />,
  critico: <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />,
  neutro: <CircleDot aria-hidden="true" className="h-3.5 w-3.5" />,
};

/**
 * Cor de status sempre acompanhada de ícone e palavra — nunca cor sozinha.
 */
export function ChipStatus({ rotulo, tom = "neutro", icone }: ChipStatusProps) {
  const cor = CORES[tom];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
      style={cor ? { color: cor } : undefined}
    >
      {icone ?? ICONES[tom]}
      {rotulo}
    </span>
  );
}
