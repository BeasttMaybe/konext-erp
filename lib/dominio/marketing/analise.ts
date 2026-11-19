/**
 * Análise & Dicas — parte PURA: monta o pedido para a IA a partir dos dados
 * reais da loja (Perfil do Google, site/SEO, redes, avaliações) e lê a resposta
 * como uma lista de recomendações. A chamada à IA fica em lib/ia/cliente.ts.
 */

import type { MensagemIA } from "./gerador-de-texto";

export type AreaAnalise = "PERFIL_GOOGLE" | "SITE_SEO" | "REDES" | "AVALIACOES";
export type Prioridade = "Alta" | "Média" | "Baixa";

export type Recomendacao = { area: AreaAnalise; prioridade: Prioridade; titulo: string; dica: string };

export type ContextoAnalise = {
  loja: { nome: string; cidade: string | null; segmento: string };
  google: {
    verificado: boolean;
    site: string | null;
    categoriaPrincipal: string | null;
    qtdCategoriasSecundarias: number;
    temDescricao: boolean;
    descricaoLen: number;
    temHorario: boolean;
    fotos: string;
    impressoes: number;
    ligacoes: number;
    rotas: number;
    cliquesSite: number;
    avaliacoesTotal: number;
    avaliacoesMedia: number;
    avaliacoesSemResposta: number;
  } | null;
  seo: { problemas: string[]; pareceSpa: boolean; palavras: number } | null;
  instagram: { seguidores: number; alcance: number; interacoes: number } | null;
  tiktok: { seguidores: number; visualizacoes: number; curtidas: number } | null;
};

const ROTULO_AREA: Record<AreaAnalise, string> = {
  PERFIL_GOOGLE: "Perfil do Google",
  SITE_SEO: "Site & SEO",
  REDES: "Redes sociais",
  AVALIACOES: "Avaliações",
};

export function rotuloArea(area: AreaAnalise): string {
  return ROTULO_AREA[area];
}

export function montarMensagensAnalise(ctx: ContextoAnalise): MensagemIA[] {
  const sistema = [
    "Você é consultor de marketing local e SEO para uma assistência técnica de celulares no Brasil.",
    "Analisa os dados reais da loja e devolve um plano de melhorias prático, específico e priorizado.",
    "Responda APENAS com um JSON válido: um array de objetos com os campos:",
    '- "area": um de "PERFIL_GOOGLE", "SITE_SEO", "REDES", "AVALIACOES".',
    '- "prioridade": um de "Alta", "Média", "Baixa".',
    '- "titulo": a ação em poucas palavras.',
    '- "dica": 1 a 2 frases explicando o que fazer e por quê, concreto, em português do Brasil.',
    "Regras: entre 8 e 14 itens; baseie-se nos números dados (cite-os quando ajudar); nada de texto fora do JSON;",
    "não invente dados que não foram informados; priorize o que dá mais resultado para aparecer no Google e atrair clientes locais.",
  ].join("\n");

  const linhas: string[] = [`Loja: ${ctx.loja.nome}${ctx.loja.cidade ? ` (${ctx.loja.cidade})` : ""} — ${ctx.loja.segmento}`];

  if (ctx.google) {
    const g = ctx.google;
    linhas.push(
      "",
      "PERFIL DO GOOGLE:",
      `- Verificado: ${g.verificado ? "sim" : "não"}; site cadastrado: ${g.site ?? "nenhum"}.`,
      `- Categoria principal: ${g.categoriaPrincipal ?? "não definida"}; categorias secundárias: ${g.qtdCategoriasSecundarias}.`,
      `- Descrição: ${g.temDescricao ? `sim (${g.descricaoLen} caracteres)` : "não"}; horário cadastrado: ${g.temHorario ? "sim" : "não"}; fotos: ${g.fotos}.`,
      `- Últimos 30 dias: ${g.impressoes} visualizações, ${g.ligacoes} ligações, ${g.rotas} pedidos de rota, ${g.cliquesSite} cliques no site.`,
      `- Avaliações: ${g.avaliacoesTotal} no total, nota média ${g.avaliacoesMedia}, ${g.avaliacoesSemResposta} sem resposta.`
    );
  }

  if (ctx.seo) {
    linhas.push("", "SITE (SEO):");
    if (ctx.seo.pareceSpa) linhas.push("- O conteúdo do site parece carregar por JavaScript; o Google pode ver pouca coisa no HTML.");
    linhas.push(`- Texto aproximado: ${ctx.seo.palavras} palavras.`);
    if (ctx.seo.problemas.length) linhas.push(...ctx.seo.problemas.map((p) => `- ${p}`));
    else linhas.push("- Nenhum problema técnico óbvio detectado no HTML.");
  } else {
    linhas.push("", "SITE: não foi possível analisar o site (sem endereço ou fora do ar).");
  }

  if (ctx.instagram) {
    linhas.push(
      "",
      `INSTAGRAM: ${ctx.instagram.seguidores} seguidores, alcance ${ctx.instagram.alcance}, ${ctx.instagram.interacoes} interações (30 dias).`
    );
  }
  if (ctx.tiktok) {
    linhas.push(
      `TIKTOK: ${ctx.tiktok.seguidores} seguidores, ${ctx.tiktok.visualizacoes} visualizações de vídeo, ${ctx.tiktok.curtidas} curtidas (30 dias).`
    );
  }

  linhas.push("", "Devolva o plano de melhorias como o JSON pedido.");

  return [
    { papel: "system", conteudo: sistema },
    { papel: "user", conteudo: linhas.join("\n") },
  ];
}

const AREAS_VALIDAS = new Set<AreaAnalise>(["PERFIL_GOOGLE", "SITE_SEO", "REDES", "AVALIACOES"]);
const PRIORIDADES_VALIDAS = new Set<Prioridade>(["Alta", "Média", "Baixa"]);

/** Lê a resposta da IA (espera um array JSON) como recomendações, de forma tolerante. */
export function lerRecomendacoes(resposta: string): Recomendacao[] {
  const inicio = resposta.indexOf("[");
  const fim = resposta.lastIndexOf("]");
  if (inicio < 0 || fim <= inicio) return [];

  let bruto: unknown;
  try {
    bruto = JSON.parse(resposta.slice(inicio, fim + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(bruto)) return [];

  const recs: Recomendacao[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const area = String(o.area ?? "") as AreaAnalise;
    const titulo = String(o.titulo ?? "").trim();
    const dica = String(o.dica ?? "").trim();
    if (!AREAS_VALIDAS.has(area) || !titulo || !dica) continue;
    const prioridadeBruta = String(o.prioridade ?? "Média") as Prioridade;
    const prioridade = PRIORIDADES_VALIDAS.has(prioridadeBruta) ? prioridadeBruta : "Média";
    recs.push({ area, prioridade, titulo: titulo.slice(0, 120), dica: dica.slice(0, 400) });
  }
  return recs.slice(0, 20);
}

/** Ordena por prioridade (Alta → Baixa), mantendo a ordem dentro de cada nível. */
export function ordenarPorPrioridade(recs: Recomendacao[]): Recomendacao[] {
  const peso: Record<Prioridade, number> = { Alta: 0, "Média": 1, Baixa: 2 };
  return [...recs].sort((a, b) => peso[a.prioridade] - peso[b.prioridade]);
}
