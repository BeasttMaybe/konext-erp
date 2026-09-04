import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BarraFiltrosProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Uma única linha horizontal acima do conteúdo que ela filtra.
 * Busca, alternadores de visão e selects moram aqui — nunca dentro de um cartão.
 */
export function BarraFiltros({ children, className }: BarraFiltrosProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}
