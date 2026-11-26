"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarraSuperior } from "./barra-superior";
import { PaletaComando } from "./paleta-comando";

/**
 * Composição do shell (redesenho 11/2026) — cabeçalho horizontal no topo
 * (`BarraSuperior`, que já inclui a navegação dos módulos) + conteúdo, agora
 * FULL-BLEED: o app preenche a janela inteira, sem a margem externa, o raio
 * de 28px, a sombra flutuante e o fundo --kx-fora que faziam tudo parecer um
 * cartão encolhido no meio da tela ("encaixotado"). A barra lateral saiu de
 * cena — a navegação mora no cabeçalho.
 *
 * A rolagem acontece só dentro de `<main>` (`overflow-y-auto`), com o
 * cabeçalho sticky parado no topo. O `min-h-0` é obrigatório: sem ele o
 * `<main>` cresceria pra caber o conteúdo em vez de encolher e deixar o
 * `overflow-y-auto` entrar em ação.
 */
export function ShellDashboard({ children }: { children: ReactNode }) {
  const [buscaAberta, setBuscaAberta] = useState(false);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "k" && (evento.metaKey || evento.ctrlKey)) {
        evento.preventDefault();
        setBuscaAberta((atual) => !atual);
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-kx-fundo">
      <BarraSuperior onAbrirBusca={() => setBuscaAberta(true)} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1760px] px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </main>
      <PaletaComando aberta={buscaAberta} onAbertaChange={setBuscaAberta} />
    </div>
  );
}
