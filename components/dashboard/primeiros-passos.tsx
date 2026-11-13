"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, Circle, Rocket, X } from "lucide-react";

import type { PassoInicial } from "@/lib/dominio/primeiros-passos";

const CHAVE = "konext-primeiros-passos-oculto";

function lerOculto(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

const assinantes = new Set<() => void>();
function assinar(aviso: () => void) {
  assinantes.add(aviso);
  return () => assinantes.delete(aviso);
}

/**
 * Lista de "Primeiros passos" no Dashboard (lib/dominio/primeiros-passos.ts).
 * Some sozinha quando tudo esta feito; "Ocultar" esconde neste navegador.
 */
export function PrimeirosPassos({ passos }: { passos: PassoInicial[] }) {
  // null no servidor: so decide depois de ler o navegador, sem piscar a lista.
  const oculto = useSyncExternalStore(assinar, lerOculto, () => null);
  const [aberto, setAberto] = useState(true);
  const feitos = passos.filter((p) => p.feito).length;

  if (oculto !== false || feitos === passos.length) return null;

  const ocultar = () => {
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {}
    assinantes.forEach((aviso) => aviso());
  };

  return (
    <section aria-label="Primeiros passos" className="rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-kx-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kx-superficie text-kx-link">
          <Rocket className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-kx-texto">Primeiros passos</h2>
          <p className="text-xs text-kx-legenda">
            {feitos} de {passos.length} prontos — deixe a loja pronta para o dia a dia.
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-kx-superficie" aria-hidden>
            <div className="h-full rounded-full bg-kx-sucesso" style={{ width: `${(feitos / passos.length) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={aberto ? "Recolher primeiros passos" : "Mostrar primeiros passos"}
          className="flex h-9 w-9 items-center justify-center rounded-kx-botao text-kx-legenda hover:bg-kx-superficie"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={ocultar}
          aria-label="Ocultar primeiros passos"
          title="Ocultar"
          className="flex h-9 w-9 items-center justify-center rounded-kx-botao text-kx-legenda hover:bg-kx-superficie"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {aberto ? (
        <ol className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {passos.map((passo) => (
            <li key={passo.id}>
              <Link
                href={passo.href}
                className={`flex h-full items-start gap-2.5 rounded-kx-botao border px-3 py-2.5 transition-colors ${
                  passo.feito ? "border-kx-painel-borda bg-kx-superficie" : "border-kx-campo-borda hover:bg-kx-superficie"
                }`}
              >
                {passo.feito ? (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-kx-sucesso-texto" aria-label="Feito" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-kx-legenda" aria-label="A fazer" />
                )}
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${passo.feito ? "text-kx-legenda line-through" : "text-kx-texto"}`}>
                    {passo.titulo}
                  </span>
                  {!passo.feito && <span className="block text-xs text-kx-texto-2">{passo.descricao}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
