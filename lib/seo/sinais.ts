/**
 * Extração de sinais de SEO a partir do HTML de uma página — parte PURA
 * (recebe a string do HTML, não busca nada na rede). A busca fica em
 * lib/seo/auditar.ts (só servidor). Serve de insumo para a análise com IA e
 * para a tela mostrar um retrato objetivo do site.
 */

export type SinaisSeo = {
  url: string;
  https: boolean;
  titulo: string | null;
  tituloLen: number;
  descricao: string | null;
  descricaoLen: number;
  viewport: boolean;
  canonical: boolean;
  lang: string | null;
  h1: string[];
  qtdImagens: number;
  imagensSemAlt: number;
  temSchema: boolean;
  tiposSchema: string[];
  qtdOpenGraph: number;
  palavras: number;
  /** Pouco texto no HTML + scripts: provável app JS (conteúdo não vem no HTML). */
  pareceSpa: boolean;
};

function conteudoDaTag(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m?.[1] ? decodeEntidades(m[1].trim()) : null;
}

/** Lê o atributo `content` de uma meta que casa com `reMeta`. */
function contentDaMeta(html: string, reMeta: RegExp): string | null {
  const tag = reMeta.exec(html)?.[0];
  if (!tag) return null;
  const c = /content=["']([^"']*)["']/i.exec(tag);
  return c?.[1] ? decodeEntidades(c[1].trim()) : null;
}

function decodeEntidades(texto: string): string {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function textoVisivel(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extrairSinaisSeo(html: string, url: string): SinaisSeo {
  const titulo = conteudoDaTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const descricao = contentDaMeta(html, /<meta[^>]+name=["']description["'][^>]*>/i);
  const lang = /<html[^>]+lang=["']([^"']+)["']/i.exec(html)?.[1] ?? null;

  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => decodeEntidades(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()))
    .filter(Boolean)
    .slice(0, 10);

  const imagens = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imagensSemAlt = imagens.filter((img) => !/\balt=["'][^"']*\S[^"']*["']/i.test(img)).length;

  const tiposSchema = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((m) => [...m[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((t) => t[1]))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8);

  const qtdOpenGraph = [...html.matchAll(/<meta[^>]+property=["']og:[^"']+["']/gi)].length;
  const texto = textoVisivel(html);
  const palavras = texto ? texto.split(" ").filter(Boolean).length : 0;

  return {
    url,
    https: url.startsWith("https://"),
    titulo,
    tituloLen: titulo?.length ?? 0,
    descricao,
    descricaoLen: descricao?.length ?? 0,
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    canonical: /<link[^>]+rel=["']canonical["']/i.test(html),
    lang,
    h1,
    qtdImagens: imagens.length,
    imagensSemAlt,
    temSchema: tiposSchema.length > 0,
    tiposSchema,
    qtdOpenGraph,
    palavras,
    pareceSpa: palavras < 60 && /<script\b/i.test(html),
  };
}

/** Lista de problemas objetivos (para a tela e para a IA), em português. */
export function problemasDeSeo(s: SinaisSeo): string[] {
  const p: string[] = [];
  if (!s.titulo) p.push("Sem <title> (título da página).");
  else if (s.tituloLen < 15 || s.tituloLen > 65) p.push(`Título com ${s.tituloLen} caracteres (ideal 15–60).`);
  if (!s.descricao) p.push("Sem meta description (resumo que aparece no Google).");
  else if (s.descricaoLen < 70 || s.descricaoLen > 165) p.push(`Meta description com ${s.descricaoLen} caracteres (ideal 70–160).`);
  if (!s.viewport) p.push("Sem meta viewport (prejudica o mobile).");
  if (s.h1.length === 0) p.push("Nenhum H1 (título principal) na página.");
  else if (s.h1.length > 1) p.push(`${s.h1.length} tags H1 (o ideal é uma só).`);
  if (!s.canonical) p.push("Sem link canonical.");
  if (!s.temSchema) p.push("Sem dados estruturados (schema.org) — ajuda o Google a entender o negócio.");
  if (s.qtdOpenGraph === 0) p.push("Sem Open Graph (como o link aparece quando compartilhado).");
  if (s.qtdImagens > 0 && s.imagensSemAlt > 0) p.push(`${s.imagensSemAlt} de ${s.qtdImagens} imagens sem texto alternativo (alt).`);
  if (s.pareceSpa) p.push("O conteúdo parece carregar por JavaScript; o Google pode ver uma página quase vazia no HTML.");
  else if (s.palavras < 150) p.push(`Pouco texto na página (${s.palavras} palavras) — conteúdo fino rende menos no Google.`);
  if (!s.https) p.push("Site sem HTTPS.");
  return p;
}
