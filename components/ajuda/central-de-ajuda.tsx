"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ARTIGOS_AJUDA, buscarArtigos, CATEGORIAS_AJUDA, type ArtigoAjuda } from "@/lib/ajuda/artigos";

/**
 * Central de Ajuda: busca no topo e os guias agrupados por assunto. Cada guia
 * abre numa pagina propria (/ajuda/[slug]) com os passos e um botao que leva
 * direto a tela certa.
 */
export function CentralDeAjuda() {
  const [termo, setTermo] = useState("");
  const buscando = termo.trim().length >= 2;
  const resultados = useMemo(() => (buscando ? buscarArtigos(termo) : []), [buscando, termo]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda" aria-hidden />
        <Input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="O que você quer fazer? Ex.: abrir OS, cadastrar produto, fechar caixa"
          aria-label="Buscar na ajuda"
          className="h-12 border-kx-campo-borda bg-kx-superficie pl-10 text-base"
        />
      </div>

      {buscando ? (
        <section aria-live="polite" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-kx-texto-2">
            {resultados.length === 0
              ? `Nenhum guia para "${termo.trim()}". Tente outra palavra.`
              : `${resultados.length} ${resultados.length === 1 ? "guia encontrado" : "guias encontrados"}`}
          </h2>
          <ListaDeGuias artigos={resultados} mostrarCategoria />
        </section>
      ) : (
        CATEGORIAS_AJUDA.map((categoria) => (
          <section key={categoria} className="flex flex-col gap-3" aria-labelledby={`ajuda-${categoria}`}>
            <h2 id={`ajuda-${categoria}`} className="text-base font-bold text-kx-texto">
              {categoria}
            </h2>
            <ListaDeGuias artigos={ARTIGOS_AJUDA.filter((a) => a.categoria === categoria)} />
          </section>
        ))
      )}
    </div>
  );
}

function ListaDeGuias({ artigos, mostrarCategoria = false }: { artigos: ArtigoAjuda[]; mostrarCategoria?: boolean }) {
  if (artigos.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {artigos.map((artigo) => (
        <li key={artigo.slug}>
          <Link
            href={`/ajuda/${artigo.slug}`}
            className="flex h-full items-center gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-4 transition-colors hover:border-kx-destaque focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco"
          >
            <span className="min-w-0 flex-1">
              {mostrarCategoria ? (
                <span className="block text-xs font-semibold text-kx-destaque">{artigo.categoria}</span>
              ) : null}
              <span className="block font-semibold text-kx-texto">{artigo.titulo}</span>
              <span className="mt-0.5 block text-sm text-kx-legenda">{artigo.resumo}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-kx-legenda" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
