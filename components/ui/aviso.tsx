import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Aviso (Fase 3-1) — banner info/sucesso/alerta/erro. "info" usa os tokens
 * neutros de superfície (sem token de cor próprio no mockup); os outros três
 * usam os pares fundo/texto/ícone --kx-* já auditados pra contraste.
 */
const avisoVariants = cva("flex items-start gap-3 rounded-kx-cartao border p-kx-4 text-sm", {
  variants: {
    variante: {
      info: "border-border bg-muted text-foreground",
      sucesso: "border-transparent bg-kx-sucesso-fundo text-kx-sucesso-texto",
      alerta: "border-transparent bg-kx-alerta-fundo text-kx-alerta-texto",
      erro: "border-transparent bg-kx-erro-fundo text-kx-erro-texto",
    },
  },
  defaultVariants: {
    variante: "info",
  },
});

const ICONE_POR_VARIANTE = {
  info: Info,
  sucesso: CheckCircle2,
  alerta: TriangleAlert,
  erro: AlertCircle,
} as const;

export type PropsAviso = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof avisoVariants> & {
    titulo?: string;
    onFechar?: () => void;
  };

function Aviso({ className, variante = "info", titulo, onFechar, children, ...props }: PropsAviso) {
  const Icone = ICONE_POR_VARIANTE[variante ?? "info"];

  return (
    <div role="status" className={cn(avisoVariants({ variante }), className)} {...props}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-current/90">{children}</div>}
      </div>
      {onFechar && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onFechar}
          className="-mr-1 -mt-1 shrink-0 text-current hover:bg-current/10 hover:text-current"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar aviso</span>
        </Button>
      )}
    </div>
  );
}

export { Aviso, avisoVariants };
