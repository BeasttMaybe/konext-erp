import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pílula de status (Fase 3-1) — o "pill-shaped status" da direção visual
 * aprovada, usado nas tabelas e cartões de OS. Cada variante já embute o par
 * fundo/texto certo (--kx-*), com contraste AA conferido em
 * docs/design/sistema-visual.md — nunca escolher cor "avulsa" aqui.
 */
const pilulaStatusVariants = cva(
  "inline-flex items-center gap-1.5 rounded-kx-pilula px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variante: {
        orcamento: "bg-kx-alerta-fundo text-kx-alerta-texto",
        conserto: "bg-kx-conserto-fundo text-kx-conserto-texto",
        pronto: "bg-kx-sucesso-fundo text-kx-sucesso-texto",
        entregue: "bg-kx-entregue-fundo text-kx-entregue-texto",
        garantia: "bg-kx-garantia-pilula-fundo text-kx-garantia-pilula-texto",
        sucesso: "bg-kx-sucesso-fundo text-kx-sucesso-texto",
        alerta: "bg-kx-alerta-fundo text-kx-alerta-texto",
        erro: "bg-kx-erro-fundo text-kx-erro-texto",
        neutro: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variante: "neutro",
    },
  }
);

export type PropsPilulaStatus = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof pilulaStatusVariants> & {
    /** Ponto colorido antes do texto — opcional, pra reforçar a cor em telas densas (Kanban). */
    comPonto?: boolean;
  };

function PilulaStatus({ className, variante, comPonto = false, children, ...props }: PropsPilulaStatus) {
  return (
    <span className={cn(pilulaStatusVariants({ variante }), className)} {...props}>
      {comPonto && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export { PilulaStatus, pilulaStatusVariants };
