"use client";

import { useSyncExternalStore } from "react";

/**
 * Onde o sistema troca para as telas de celular (OS rapida, PDV de celular).
 * Mesmo corte do `md:` do Tailwind: abaixo de 768px e celular.
 */
export const CONSULTA_DE_TELA_DE_CELULAR = "(max-width: 767px)";

function assinar(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_DE_TELA_DE_CELULAR);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

/**
 * `true` no celular, `false` no computador e `null` enquanto nao se sabe —
 * no servidor e no primeiro desenho do navegador. O `null` existe para a
 * tela nao desenhar a versao de computador e trocar em seguida: no celular
 * isso seria um piscar da tela errada a cada abertura.
 */
export function useTelaDeCelular(): boolean | null {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA_DE_TELA_DE_CELULAR).matches,
    () => null
  );
}
