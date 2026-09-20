"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarraLateral } from "./barra-lateral";
import { BarraSuperior } from "./barra-superior";
import { PaletaComando } from "./paleta-comando";

/**
 * Composição do shell (Fase 3-1, Parte 3; card flutuante na Fase 3-2C):
 * barra lateral + barra superior + conteúdo, dentro de UM cartão arredondado
 * flutuando sobre --kx-fora (fundo da janela, mais escuro que --kx-fundo).
 *
 * A barra lateral era `fixed` relativa ao VIEWPORT antes do cartão existir;
 * agora é só um item flex normal dentro da linha do cartão — sua altura
 * vem do `stretch` padrão do flex, não mais de `inset-y-0`. Isso também é o
 * que faz ela compartilhar a MESMA borda superior da barra superior (nenhum
 * "degrau" no canto): as duas nascem no y=0 da mesma linha flex.
 *
 * Rolagem agora acontece SÓ dentro de `<main>` (`overflow-y-auto`), não mais
 * na janela inteira — o cartão e a barra superior ficam parados. Por isso
 * cada `min-h-0` abaixo é obrigatório: sem ele, um item flex teimosamente
 * cresce pra caber o conteúdo em vez de encolher e deixar o `overflow-y-auto`
 * de um descendente realmente entrar em ação.
 *
 * `overflow-hidden` no cartão é o que arredonda visualmente o canto
 * quadrado da barra lateral — ela não precisa (nem deve) ter raio próprio.
 *
 * No mobile (abaixo de `lg`) a margem é zero e o raio some: o cartão
 * simplesmente preenche a tela, como já era antes desta fase.
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
    <div className="flex h-screen flex-col bg-kx-fora lg:p-4 xl:p-6">
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-kx-fundo shadow-kx-flutuante lg:rounded-[28px]">
        <BarraLateral />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <BarraSuperior onAbrirBusca={() => setBuscaAberta(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">{children}</div>
          </main>
        </div>
      </div>
      <PaletaComando aberta={buscaAberta} onAbertaChange={setBuscaAberta} />
    </div>
  );
}
