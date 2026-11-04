"use client";

import { createContext, useContext } from "react";

/**
 * O identificador público da loja, disponível para a árvore do dashboard.
 *
 * Existe por causa dos links públicos. O rastreio do cliente é
 * `/r/<loja>/<os>`, e quem monta esse endereço são botões de cliente — o de
 * copiar o link e o de mandar no WhatsApp. Sem o slug à mão, cada clique
 * teria que ir ao servidor buscá-lo, e aí `navigator.clipboard.writeText`
 * passaria a rodar depois de um `await`: em alguns navegadores isso perde o
 * vínculo com o gesto do usuário e a cópia falha em silêncio.
 *
 * O valor não custa consulta nenhuma: `tenantSlug` já vem no contexto que o
 * layout do dashboard resolve uma vez por navegação.
 *
 * Não é segredo — é o nome da loja no endereço, como em qualquer URL.
 */
const ContextoLoja = createContext<string | null>(null);

export function ProvedorLoja({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return <ContextoLoja.Provider value={slug}>{children}</ContextoLoja.Provider>;
}

/**
 * O slug da loja, ou `null` fora do provedor.
 *
 * Devolve `null` em vez de lançar porque quem usa isto são botões de
 * conveniência: sem o slug, o certo é o botão cair no endereço antigo, não
 * derrubar a tela da OS.
 */
export function useSlugDaLoja(): string | null {
  return useContext(ContextoLoja);
}

/**
 * Reexportado daqui por conveniência de quem já usa o hook acima — a função
 * em si é lógica pura de URL e mora no domínio, junto do construtor do link
 * de foto, que resolve o mesmo problema pela mesma razão.
 */
export { caminhoDeRastreio } from "@/lib/dominio/os/link-de-foto";
