import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ARTIGOS_AJUDA, artigoPeloSlug } from "@/lib/ajuda/artigos";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ARTIGOS_AJUDA.map((artigo) => ({ slug: artigo.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artigo = artigoPeloSlug((await params).slug);
  return { title: artigo ? `${artigo.titulo} · Ajuda` : "Ajuda" };
}

export default async function PaginaGuia({ params }: Props) {
  const artigo = artigoPeloSlug((await params).slug);
  if (!artigo) notFound();

  const relacionados = ARTIGOS_AJUDA.filter((a) => a.categoria === artigo.categoria && a.slug !== artigo.slug);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
      <Link href="/ajuda" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-kx-link hover:text-kx-destaque">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Ajuda
      </Link>

      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-kx-destaque">{artigo.categoria}</span>
        <h1 className="text-2xl font-bold text-kx-texto">{artigo.titulo}</h1>
        <p className="text-kx-texto-2">{artigo.resumo}</p>
      </header>

      {artigo.secoes.map((secao, indice) => (
        <section key={secao.titulo ?? indice} className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:p-5">
          {secao.titulo ? <h2 className="mb-3 text-base font-bold text-kx-texto">{secao.titulo}</h2> : null}
          <ol className="flex flex-col gap-3">
            {secao.passos.map((passo, n) => (
              <li key={n} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-kx-primaria text-sm font-bold text-primary-foreground">
                  {n + 1}
                </span>
                <span className="pt-0.5 text-kx-texto">{passo}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {artigo.dicas?.length ? (
        <aside className="rounded-kx-painel border border-kx-info bg-kx-info-fundo p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-kx-info-texto">
            <Lightbulb className="h-4 w-4" aria-hidden />
            {artigo.dicas.length === 1 ? "Dica" : "Dicas"}
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-kx-info-texto">
            {artigo.dicas.map((dica) => (
              <li key={dica}>{dica}</li>
            ))}
          </ul>
        </aside>
      ) : null}

      {artigo.destino ? (
        <Button asChild className="h-12 w-full text-base font-bold sm:w-fit sm:px-6">
          <Link href={artigo.destino.href}>
            {artigo.destino.rotulo}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      ) : null}

      {relacionados.length > 0 ? (
        <section className="flex flex-col gap-2 border-t border-kx-painel-borda pt-5">
          <h2 className="text-sm font-bold text-kx-texto-2">Outros guias de {artigo.categoria}</h2>
          <ul className="flex flex-col gap-1">
            {relacionados.map((r) => (
              <li key={r.slug}>
                <Link href={`/ajuda/${r.slug}`} className="text-sm font-medium text-kx-link hover:text-kx-destaque">
                  {r.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
