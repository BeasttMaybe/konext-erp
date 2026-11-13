"use client";

import { createContext, useContext } from "react";

/**
 * O que a moldura do sistema (barra lateral e barra superior) mostra de quem
 * esta logado e da loja: nome, e-mail, foto e logo.
 *
 * O QUE ISTO SUBSTITUI
 *
 * Cada barra buscava esses dados por conta propria, num `useEffect`, chamando
 * a mesma Server Action. Medido com o sistema rodando: abrir qualquer tela
 * fazia DUAS requisicoes extras ao servidor pela mesma resposta — e cada uma
 * resolvia a sessao do zero no banco central antes de chegar ao que queria.
 *
 * Alem do custo, havia o efeito visivel: as barras nasciam vazias (a letra
 * "K" no lugar do logo, o nome em branco) e so se completavam depois que a
 * pagina ja estava na tela.
 *
 * Agora o layout do dashboard, que ja resolve o contexto de quem esta logado,
 * le esses quatro valores no servidor e os entrega por aqui. Nenhuma
 * requisicao a mais, e as barras ja chegam prontas no primeiro desenho.
 *
 * Quando o perfil ou o logo mudam, quem salva chama `revalidatePath("/",
 * "layout")` — o layout e refeito e o valor novo desce por este contexto.
 */
export type PerfilDaMoldura = {
  nome: string;
  email: string;
  fotoPerfilUrl: string | null;
  logoUrl: string | null;
  /** Nome fantasia da loja — sai ao lado da logo na barra lateral. */
  nomeDaLoja: string;
};

export const PERFIL_VAZIO: PerfilDaMoldura = {
  nome: "",
  email: "",
  fotoPerfilUrl: null,
  logoUrl: null,
  nomeDaLoja: "",
};

const ContextoPerfil = createContext<PerfilDaMoldura>(PERFIL_VAZIO);

export function ProvedorPerfil({
  perfil,
  children,
}: {
  perfil: PerfilDaMoldura;
  children: React.ReactNode;
}) {
  return <ContextoPerfil.Provider value={perfil}>{children}</ContextoPerfil.Provider>;
}

/**
 * Fora do provedor devolve o perfil vazio, e nao lanca: as barras tem
 * substituto para cada campo (a marca "K", as iniciais), e moldura nao pode
 * derrubar a tela por falta de enfeite.
 */
export function usePerfilDaMoldura(): PerfilDaMoldura {
  return useContext(ContextoPerfil);
}
