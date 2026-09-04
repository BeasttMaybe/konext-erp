import type { ReactNode } from "react";

type CabecalhoPaginaProps = {
  titulo: string;
  acoes?: ReactNode;
};

/**
 * Título curto da página e, opcionalmente, suas ações.
 * Não existe slot para subtítulo: a linha explicativa sob o título foi removida do sistema.
 */
export function CabecalhoPagina({ titulo, acoes }: CabecalhoPaginaProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-base font-medium text-foreground">{titulo}</h1>
      {acoes ? <div className="flex items-center gap-2">{acoes}</div> : null}
    </div>
  );
}
