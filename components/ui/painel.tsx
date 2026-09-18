import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Painel (Fase 3-1) — a superfície de agrupamento do design system Konext:
 * cantos bem arredondados (22–24px), fundo `--kx-painel`, borda sutil. É o
 * bloco que a barra lateral, o corpo de uma tela e seções grandes usam —
 * mais "pesado" que `Card` (que continua sendo o cartão de conteúdo denso,
 * 16px de raio). Sem cor hardcoded: tudo vem de `--kx-*` via os utilitários
 * `bg-kx-painel`/`border-kx-painel-borda`/`rounded-kx-painel` do Tailwind.
 */
const Painel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-kx-painel border border-kx-painel-borda bg-kx-painel text-kx-texto shadow-kx-painel",
        className
      )}
      {...props}
    />
  )
);
Painel.displayName = "Painel";

const PainelCabecalho = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-kx-6 pb-kx-4", className)} {...props} />
  )
);
PainelCabecalho.displayName = "PainelCabecalho";

const PainelTitulo = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold leading-none text-kx-texto", className)} {...props} />
  )
);
PainelTitulo.displayName = "PainelTitulo";

const PainelDescricao = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-kx-legenda", className)} {...props} />
  )
);
PainelDescricao.displayName = "PainelDescricao";

const PainelConteudo = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-kx-6 pt-0", className)} {...props} />
);
PainelConteudo.displayName = "PainelConteudo";

export { Painel, PainelCabecalho, PainelTitulo, PainelDescricao, PainelConteudo };
