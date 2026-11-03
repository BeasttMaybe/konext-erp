import "server-only";

import { headers } from "next/headers";

/**
 * O endereço público deste site, lido da própria requisição.
 *
 * Existe pro QR code do link de envio de foto, que precisa de uma URL
 * absoluta — o celular que lê o código não tem contexto nenhum pra completar
 * um caminho relativo.
 *
 * Vem do cabeçalho e não de variável de ambiente porque variável de ambiente
 * erra em silêncio: configurada uma vez, ela continua apontando pro endereço
 * antigo depois de uma troca de domínio, e o sintoma aparece lá na frente,
 * num QR code impresso que leva a lugar nenhum. O cabeçalho é, por
 * construção, o endereço por onde a pessoa chegou.
 */
export async function urlBaseDaRequisicao(): Promise<string> {
  const cabecalhos = await headers();

  // `x-forwarded-host` é o que o proxy da Vercel preenche com o domínio que o
  // navegador pediu; `host` é o de trás dele.
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "";

  if (!host) return "";

  // Em produção é sempre https. `x-forwarded-proto` cobre o desenvolvimento
  // local, onde é http e onde um link https não abriria.
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? "https";

  return `${protocolo}://${host}`;
}
