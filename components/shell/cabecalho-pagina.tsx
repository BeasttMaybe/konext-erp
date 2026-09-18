import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type MigalhaPao = { rotulo: string; href?: string };

export type PropsCabecalhoPagina = {
  /** Trilha de navegação — o último item nunca é link (é a página atual). */
  migalhas?: MigalhaPao[];
  titulo: string;
  descricao?: string;
  /** Botões/ações do canto direito (ex.: "Nova OS"). */
  acoes?: React.ReactNode;
  className?: string;
};

/**
 * Cabeçalho de página (Fase 3-1, Parte 3) — o padrão que toda tela do
 * shell novo usa: trilha de navegação em cima, título e descrição à
 * esquerda, ações à direita. Uma vez só, no topo do conteúdo — não em
 * cada seção da tela.
 */
export function CabecalhoPagina({ migalhas, titulo, descricao, acoes, className }: PropsCabecalhoPagina) {
  return (
    <div className={cn("flex flex-col gap-3 pb-6 pt-6 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1.5">
        {migalhas && migalhas.length > 0 && (
          <nav aria-label="Trilha de navegação" className="flex items-center gap-1 text-xs text-kx-legenda">
            {migalhas.map((migalha, indice) => (
              <span key={`${migalha.rotulo}-${indice}`} className="flex items-center gap-1">
                {indice > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {migalha.href ? (
                  <Link href={migalha.href} className="hover:text-kx-texto-2">
                    {migalha.rotulo}
                  </Link>
                ) : (
                  <span aria-current="page">{migalha.rotulo}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-kx-texto">{titulo}</h1>
        {descricao && <p className="text-sm text-kx-legenda">{descricao}</p>}
      </div>

      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  );
}
