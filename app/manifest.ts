import type { MetadataRoute } from "next";

import { CORES_DO_APP } from "@/lib/design/cores-do-app";

/**
 * O que faz o TechOS ser instalavel como app: no iPhone, Safari →
 * Compartilhar → "Adicionar a Tela de Inicio".
 *
 * `display: "standalone"` abre sem a barra do navegador. `start_url` e a
 * tela inicial do sistema; quem nao tem sessao e levado ao login pelo proxy,
 * como em qualquer outro acesso.
 *
 * As cores sao as do tema escuro (o que o dono usa): e o fundo que aparece
 * no instante entre tocar no icone e o sistema desenhar a primeira tela.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TechOS ERP",
    short_name: "TechOS",
    description: "Ordens de serviço, PDV e financeiro da assistência técnica.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: CORES_DO_APP.fundoEscuro,
    theme_color: CORES_DO_APP.fundoEscuro,
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-mascaravel-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
