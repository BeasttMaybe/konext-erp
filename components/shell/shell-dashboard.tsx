"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarraLateral } from "./barra-lateral";
import { BarraSuperior } from "./barra-superior";
import { PaletaComando } from "./paleta-comando";

/**
 * Composição do shell (Fase 3-1, Parte 3): barra lateral fixa + barra
 * superior + conteúdo, com a paleta de comando (Ctrl+K/Cmd+K) compartilhando
 * o mesmo estado de aberta/fechada entre o atalho de teclado e o campo de
 * busca da barra superior.
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
    <div className="min-h-screen bg-background">
      <BarraLateral />
      <div className="flex min-h-screen flex-col lg:pl-[72px] xl:pl-[248px]">
        <BarraSuperior onAbrirBusca={() => setBuscaAberta(true)} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">{children}</div>
        </main>
      </div>
      <PaletaComando aberta={buscaAberta} onAbertaChange={setBuscaAberta} />
    </div>
  );
}
