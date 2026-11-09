import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * O `state` do fluxo OAuth: quem é a loja, e prova de que fomos nós que
 * começamos.
 *
 * O Bling permite UM link de redirecionamento por aplicativo, e a Konext é um
 * sistema de um banco por loja. Então a mesma URL de callback atende todas as
 * lojas, e é o `state` que diz para qual banco a autorização volta — porque
 * quem chega no callback não tem sessão nenhuma.
 *
 * Isso faz do `state` algo que não pode ser apenas carregado: se ele fosse só
 * o slug em texto, qualquer um poderia mandar o navegador do dono de uma loja
 * para o callback com o slug de OUTRA, e a autorização iria parar no banco
 * errado. Por isso ele é ASSINADO.
 *
 * A assinatura usa o `BLING_CLIENT_SECRET`, que já precisa existir para o
 * fluxo funcionar e nunca sai do servidor. Não é uma chave de propósito geral
 * e não é usada para mais nada aqui.
 *
 * O `nonce` existe para o uso único, conferido do outro lado contra o que
 * ficou guardado no banco da loja: a assinatura prova que o estado é nosso,
 * o nonce prova que é DESTA tentativa e não de uma anterior repetida.
 */

const SEPARADOR = ".";

function chaveDeAssinatura(): string {
  const segredo = (process.env.BLING_CLIENT_SECRET ?? "").trim();

  if (segredo === "") {
    throw new Error("BLING_CLIENT_SECRET precisa estar configurado para assinar o estado.");
  }

  return segredo;
}

function assinar(conteudo: string): string {
  return createHmac("sha256", chaveDeAssinatura()).update(conteudo).digest("base64url");
}

export type EstadoDoFluxo = { slug: string; nonce: string; estado: string };

export function criarEstado(slug: string): EstadoDoFluxo {
  const nonce = randomBytes(24).toString("base64url");
  const conteudo = `${Buffer.from(slug).toString("base64url")}${SEPARADOR}${nonce}`;

  return { slug, nonce, estado: `${conteudo}${SEPARADOR}${assinar(conteudo)}` };
}

/**
 * Lê o estado que voltou do Bling, recusando o que não foi assinado por nós.
 *
 * A comparação é em tempo constante. Não porque este seja um alvo provável,
 * mas porque comparar assinatura com `===` é o tipo de detalhe que, uma vez
 * escrito errado, é copiado para o próximo lugar onde importa de verdade.
 */
export function lerEstado(estado: string): { slug: string; nonce: string } | null {
  const partes = estado.split(SEPARADOR);
  if (partes.length !== 3) return null;

  const [slugCodificado, nonce, assinatura] = partes;
  if (!slugCodificado || !nonce || !assinatura) return null;

  const esperada = assinar(`${slugCodificado}${SEPARADOR}${nonce}`);

  const recebida = Buffer.from(assinatura);
  const correta = Buffer.from(esperada);

  if (recebida.length !== correta.length || !timingSafeEqual(recebida, correta)) return null;

  const slug = Buffer.from(slugCodificado, "base64url").toString("utf8");

  // Um slug só pode ter a forma de slug. A assinatura já garante a origem,
  // mas o valor ainda vira consulta no banco central — e o que não tem forma
  // de slug não precisa chegar lá.
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return null;

  return { slug, nonce };
}

/** O estado vale pelo tempo de uma autorização, não de uma sessão. */
export const MINUTOS_DE_VALIDADE_DO_ESTADO = 15;

export function estadoExpirou(criadoEm: Date, agora: Date = new Date()): boolean {
  return agora.getTime() - criadoEm.getTime() > MINUTOS_DE_VALIDADE_DO_ESTADO * 60 * 1000;
}
