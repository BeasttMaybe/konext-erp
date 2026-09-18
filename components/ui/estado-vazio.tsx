import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio (Fase 3-1) — pra seções/páginas inteiras sem dado ainda
 * (diferente de `TabelaVazia`, que é uma linha dentro de uma tabela). Ícone
 * + título + descrição opcional + ação opcional, sempre centralizado.
 */
export type PropsEstadoVazio = React.HTMLAttributes<HTMLDivElement> & {
  icone?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
};

function EstadoVazio({ className, icone, titulo, descricao, acao, ...props }: PropsEstadoVazio) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-kx-cartao border border-dashed border-kx-painel-borda p-kx-12 text-center",
        className
      )}
      {...props}
    >
      {icone && <div className="text-kx-legenda [&_svg]:h-10 [&_svg]:w-10">{icone}</div>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-kx-texto">{titulo}</p>
        {descricao && <p className="max-w-sm text-sm text-kx-legenda">{descricao}</p>}
      </div>
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

export { EstadoVazio };
