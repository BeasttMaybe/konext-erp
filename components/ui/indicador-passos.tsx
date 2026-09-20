import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PassoIndicador = {
  numero: number;
  titulo: string;
  descricao: string;
  estado: "concluido" | "atual" | "pendente";
};

type PropsIndicadorPassos = {
  passos: PassoIndicador[];
  onEscolher?: (numero: number) => void;
};

/**
 * Indicador de progresso em etapas (referência: docs/design/referencia-os-nova.html) —
 * genérico o bastante pra qualquer assistente de N passos, não só a Nova OS.
 */
export function IndicadorPassos({ passos, onEscolher }: PropsIndicadorPassos) {
  return (
    <div className="flex items-center gap-0">
      {passos.map((passo) => {
        const concluido = passo.estado === "concluido";
        const atual = passo.estado === "atual";
        const podeEscolher = Boolean(onEscolher) && (concluido || atual);

        return (
          <button
            key={passo.numero}
            type="button"
            aria-current={atual ? "step" : undefined}
            disabled={!podeEscolher}
            onClick={() => podeEscolher && onEscolher?.(passo.numero)}
            className={cn(
              "flex flex-grow items-center gap-2.5 border-b-2 px-3 pb-3.5 text-left transition-colors",
              podeEscolher ? "cursor-pointer" : "cursor-default",
              concluido || atual ? "border-kx-primaria" : "border-kx-painel-borda"
            )}
          >
            <span
              className={cn(
                "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                concluido || atual
                  ? "bg-kx-primaria text-primary-foreground"
                  : "border border-kx-campo-borda bg-kx-superficie text-kx-legenda"
              )}
            >
              {concluido ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : passo.numero}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn("text-sm font-bold", atual || concluido ? "text-kx-texto" : "text-kx-legenda")}>
                {passo.titulo}
              </span>
              <span className="truncate text-[11px] text-kx-legenda">{passo.descricao}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
