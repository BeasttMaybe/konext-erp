import "server-only";

import { extrairSinaisSeo, problemasDeSeo, type SinaisSeo } from "./sinais";

/**
 * Busca a página e extrai os sinais de SEO (lib/seo/sinais.ts). Só servidor:
 * roda no runtime do ERP (Vercel), que alcança a internet. Nunca lança — em
 * caso de falha devolve { ok: false } para a análise seguir sem o site.
 */

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 1_500_000;

export type ResultadoAuditoria = { ok: true; sinais: SinaisSeo; problemas: string[] } | { ok: false; erro: string };

function normalizarUrl(bruto: string): string | null {
  const v = String(bruto ?? "").trim();
  if (!v) return null;
  const comEsquema = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(comEsquema);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function auditarSite(urlBruta: string): Promise<ResultadoAuditoria> {
  const url = normalizarUrl(urlBruta);
  if (!url) return { ok: false, erro: "Endereço de site inválido." };

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "KonextERP-SEO/1.0", Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, erro: "Não foi possível acessar o site (fora do ar ou lento)." };
  }
  if (!resposta.ok) return { ok: false, erro: `O site respondeu com erro ${resposta.status}.` };

  const tipo = resposta.headers.get("content-type") ?? "";
  if (!/text\/html|xml/i.test(tipo)) return { ok: false, erro: "O endereço não devolveu uma página HTML." };

  let html: string;
  try {
    const buffer = await resposta.arrayBuffer();
    html = new TextDecoder("utf-8").decode(buffer.byteLength > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer);
  } catch {
    return { ok: false, erro: "Não foi possível ler o conteúdo do site." };
  }

  const sinais = extrairSinaisSeo(html, resposta.url || url);
  return { ok: true, sinais, problemas: problemasDeSeo(sinais) };
}
