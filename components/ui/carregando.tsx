import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TAMANHOS = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
} as const;

export type PropsCarregando = React.HTMLAttributes<HTMLDivElement> & {
  tamanho?: keyof typeof TAMANHOS;
  /** Texto opcional ao lado do spinner (ex.: "Carregando usuários..."). */
  texto?: string;
};

/** Spinner de carregamento (Fase 3-1) — cor sempre `--kx-primaria`, nunca hardcoded. */
function Carregando({ className, tamanho = "md", texto, ...props }: PropsCarregando) {
  return (
    <div role="status" className={cn("flex items-center gap-2 text-kx-legenda", className)} {...props}>
      <Loader2 className={cn(TAMANHOS[tamanho], "animate-spin text-kx-primaria")} aria-hidden="true" />
      {texto && <span className="text-sm">{texto}</span>}
      <span className="sr-only">Carregando</span>
    </div>
  );
}

/** Cobre a tela/painel inteiro enquanto carrega — usa quando não há esqueleto específico pra aquele conteúdo. */
function CarregandoTelaCheia({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center">
      <Carregando tamanho="lg" texto={texto} className="flex-col" />
    </div>
  );
}

export { Carregando, CarregandoTelaCheia };
