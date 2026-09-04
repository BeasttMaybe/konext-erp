import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SuperficieProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Cartão padrão do sistema: fundo único, fio de 1px, sem gradiente, brilho ou sombra.
 * Substitui qualquer `rounded-xl border ...` escrito à mão.
 */
export function Superficie({ children, className }: SuperficieProps) {
  return <Card className={cn("border-border bg-card", className)}>{children}</Card>;
}
