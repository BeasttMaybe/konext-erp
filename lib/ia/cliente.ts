import "server-only";

import type { MensagemIA } from "@/lib/dominio/marketing/gerador-de-texto";

/**
 * Cliente de IA — fala com um serviço compatível com a API de Chat da OpenAI
 * (a mesma interface que a maioria dos provedores oferece). O dono configura:
 *
 * - IA_API_KEY    (obrigatório para ligar o recurso)
 * - IA_MODELO     (opcional, padrão "gpt-4o-mini")
 * - IA_BASE_URL   (opcional, padrão "https://api.openai.com/v1")
 *
 * Sem a chave, `iaConfigurada()` é falso e a tela explica o que falta. A
 * chave nunca passa pelo chat nem pelo navegador: só vive no servidor.
 */

const BASE_PADRAO = "https://api.openai.com/v1";
const MODELO_PADRAO = "gpt-4o-mini";

export function iaConfigurada(): boolean {
  return (process.env.IA_API_KEY ?? "").trim().length > 0;
}

export class ErroIA extends Error {}

export async function gerarComIA(mensagens: MensagemIA[], opcoes: { maxTokens?: number; temperatura?: number } = {}): Promise<string> {
  const chave = (process.env.IA_API_KEY ?? "").trim();
  if (!chave) throw new ErroIA("IA não configurada.");
  const base = (process.env.IA_BASE_URL ?? BASE_PADRAO).replace(/\/+$/, "");
  const modelo = (process.env.IA_MODELO ?? MODELO_PADRAO).trim();

  let resposta: Response;
  try {
    resposta = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: modelo,
        messages: mensagens.map((m) => ({ role: m.papel, content: m.conteudo })),
        temperature: opcoes.temperatura ?? 0.8,
        max_tokens: opcoes.maxTokens ?? 900,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ErroIA("Não foi possível falar com o serviço de IA agora. Tente de novo em instantes.");
  }

  if (resposta.status === 401 || resposta.status === 403) {
    throw new ErroIA("A chave de IA foi recusada. Confira a IA_API_KEY nas configurações.");
  }
  if (resposta.status === 429) {
    throw new ErroIA("O serviço de IA está ocupado ou sem créditos. Tente de novo em instantes.");
  }
  if (!resposta.ok) {
    throw new ErroIA("O serviço de IA respondeu com erro. Tente de novo.");
  }

  const dados = (await resposta.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  const texto = dados?.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new ErroIA("A IA não devolveu nenhum texto. Tente de novo.");
  return texto;
}
