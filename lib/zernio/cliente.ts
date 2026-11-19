import "server-only";

import type { RespostaPerformanceGoogle } from "./mapeamento";
import { limparTextoAvaliacao } from "./mapeamento";

/**
 * Cliente da API Zernio (https://zernio.com/api/v1). A Zernio é quem guarda as
 * contas das redes (Instagram, TikTok, Perfil do Google) e publica de fato; o
 * ERP fala com ela por uma CHAVE de API da loja (Bearer), guardada cifrada
 * (lib/zernio/conexao.ts). A chave nunca aparece no corpo das respostas nem vai
 * para o navegador.
 */

const BASE = "https://zernio.com/api/v1";
const TIMEOUT_MS = 30_000;
const TIMEOUT_UPLOAD_MS = 60_000;

export class ErroZernio extends Error {
  readonly status: number | null;
  readonly codigo: string | null;
  constructor(mensagem: string, status: number | null = null, codigo: string | null = null) {
    super(mensagem);
    this.name = "ErroZernio";
    this.status = status;
    this.codigo = codigo;
  }
}

type Opcoes = {
  query?: Record<string, string | number | boolean | undefined>;
  corpo?: unknown;
  headers?: Record<string, string>;
};

/** Uma chamada à Zernio, já com tratamento de erro traduzido para o dono. */
async function requisitar<T>(chave: string, metodo: string, caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const url = new URL(BASE + caminho);
  for (const [k, v] of Object.entries(opcoes.query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${chave}`,
        ...(opcoes.corpo !== undefined ? { "Content-Type": "application/json" } : {}),
        ...opcoes.headers,
      },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ErroZernio("Não foi possível falar com a Zernio agora. Tente de novo em instantes.");
  }

  if (resposta.status === 401 || resposta.status === 403) {
    throw new ErroZernio("A chave da Zernio foi recusada. Confira a chave em Marketing → Conexões.", resposta.status);
  }
  if (resposta.status === 429) {
    throw new ErroZernio("A Zernio está limitando as requisições agora. Tente de novo em instantes.", 429);
  }

  const texto = await resposta.text().catch(() => "");
  let dados: unknown = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = null;
    }
  }

  if (!resposta.ok) {
    const corpo = (dados ?? {}) as { error?: { message?: string } | string; message?: string; code?: string };
    const codigo = corpo.code ?? null;
    if (resposta.status === 402 || codigo === "analytics_addon_required") {
      throw new ErroZernio(
        "O recurso de análise não está incluído no seu plano Zernio. Ative o add-on de Analytics na Zernio para ver as métricas do Perfil do Google.",
        402,
        "analytics_addon_required"
      );
    }
    const detalhe =
      (typeof corpo.error === "string" ? corpo.error : corpo.error?.message) ||
      corpo.message ||
      texto.replace(/\s+/g, " ").trim();
    throw new ErroZernio(
      `A Zernio recusou (${resposta.status})${detalhe ? `: ${String(detalhe).slice(0, 200)}` : "."}`,
      resposta.status,
      codigo
    );
  }

  return (dados ?? {}) as T;
}

// ── Contas conectadas ─────────────────────────────────────────────────────────

export type ContaZernio = { id: string; plataforma: string; usuario: string };

export async function listarContas(chave: string): Promise<ContaZernio[]> {
  const dados = await requisitar<{ accounts?: Array<Record<string, unknown>> }>(chave, "GET", "/accounts");
  return (dados.accounts ?? [])
    .map((a) => ({
      id: String(a._id ?? a.id ?? ""),
      plataforma: String(a.platform ?? ""),
      usuario: String(a.username ?? a.name ?? a.displayName ?? ""),
    }))
    .filter((c) => c.id && c.plataforma);
}

/** Confere a chave fazendo a chamada mais barata; devolve as contas. Lança ErroZernio se inválida. */
export async function validarChave(chave: string): Promise<ContaZernio[]> {
  return listarContas(chave);
}

// ── Mídia ─────────────────────────────────────────────────────────────────────

/** Sobe um arquivo para a Zernio e devolve a URL pública para usar no post. */
export async function subirMidia(
  chave: string,
  arquivo: { nome: string; tipoConteudo: string; bytes: Uint8Array }
): Promise<string> {
  const presign = await requisitar<{ uploadUrl?: string; publicUrl?: string }>(chave, "POST", "/media/presign", {
    corpo: { filename: arquivo.nome, contentType: arquivo.tipoConteudo, size: arquivo.bytes.byteLength },
  });
  if (!presign.uploadUrl || !presign.publicUrl) {
    throw new ErroZernio("A Zernio não devolveu o endereço de upload da imagem.");
  }

  let resposta: Response;
  try {
    resposta = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": arquivo.tipoConteudo },
      body: Buffer.from(arquivo.bytes),
      signal: AbortSignal.timeout(TIMEOUT_UPLOAD_MS),
    });
  } catch {
    throw new ErroZernio("Falha ao enviar a imagem para a Zernio. Tente de novo.");
  }
  if (!resposta.ok) throw new ErroZernio(`Falha ao enviar a imagem para a Zernio (${resposta.status}).`);

  return presign.publicUrl;
}

// ── Publicar / agendar ────────────────────────────────────────────────────────

export type DestinoPost = { plataforma: string; contaId: string };

export type ResultadoPost = {
  postId: string | null;
  status: string | null;
  porPlataforma: Array<{ plataforma: string; status: string; url: string | null }>;
};

export async function criarPost(
  chave: string,
  entrada: {
    conteudo: string;
    destinos: DestinoPost[];
    midias?: Array<{ tipo: "image" | "video"; url: string }>;
    /** Horário local "yyyy-MM-ddTHH:mm:ss" para agendar; vazio = publicar agora. */
    agendarPara?: string | null;
    fusoHorario?: string;
    idempotencia?: string;
  }
): Promise<ResultadoPost> {
  const corpo: Record<string, unknown> = {
    content: entrada.conteudo,
    platforms: entrada.destinos.map((d) => ({ platform: d.plataforma, accountId: d.contaId })),
  };
  if (entrada.midias?.length) corpo.mediaItems = entrada.midias.map((m) => ({ type: m.tipo, url: m.url }));
  if (entrada.agendarPara) {
    corpo.scheduledFor = entrada.agendarPara;
    corpo.timezone = entrada.fusoHorario ?? "America/Sao_Paulo";
  } else {
    corpo.publishNow = true;
  }

  const dados = await requisitar<{ post?: Record<string, unknown> }>(chave, "POST", "/posts", {
    corpo,
    headers: entrada.idempotencia ? { "Idempotency-Key": entrada.idempotencia } : undefined,
  });

  const post = (dados.post ?? {}) as {
    _id?: string;
    id?: string;
    status?: string;
    platforms?: Array<{ platform?: string; status?: string; platformPostUrl?: string | null }>;
  };

  return {
    postId: post._id ?? post.id ?? null,
    status: post.status ?? null,
    porPlataforma: Array.isArray(post.platforms)
      ? post.platforms.map((p) => ({
          plataforma: String(p.platform ?? ""),
          status: String(p.status ?? ""),
          url: p.platformPostUrl ?? null,
        }))
      : [],
  };
}

/** Cancela um post AINDA não publicado (agendado). Um post já publicado não some. */
export async function excluirPostZernio(chave: string, postId: string): Promise<void> {
  await requisitar(chave, "DELETE", `/posts/${encodeURIComponent(postId)}`);
}

// ── Avaliações do Perfil do Google ────────────────────────────────────────────

export type AvaliacaoZernio = {
  id: string;
  contaId: string;
  localNome: string | null;
  autor: string;
  fotoAutor: string | null;
  nota: number;
  texto: string;
  criadoEm: string;
  respondida: boolean;
  respostaTexto: string | null;
  url: string | null;
};

export type ResumoAvaliacoes = { total: number; media: number };

export type PaginaAvaliacoes = {
  avaliacoes: AvaliacaoZernio[];
  resumo: ResumoAvaliacoes | null;
  proximoCursor: string | null;
};

export async function listarAvaliacoes(
  chave: string,
  filtros: { contaId: string; apenasSemResposta?: boolean; notaMax?: number; limite?: number; cursor?: string | null }
): Promise<PaginaAvaliacoes> {
  const dados = await requisitar<{
    data?: Array<Record<string, unknown>>;
    summary?: { totalReviews?: number; averageRating?: number };
    pagination?: { nextCursor?: string | null };
  }>(chave, "GET", "/inbox/reviews", {
    query: {
      platform: "googlebusiness",
      accountId: filtros.contaId,
      hasReply: filtros.apenasSemResposta ? false : undefined,
      maxRating: filtros.notaMax,
      limit: filtros.limite ?? 25,
      cursor: filtros.cursor ?? undefined,
    },
  });

  const avaliacoes = (dados.data ?? []).map((r) => {
    const reviewer = (r.reviewer ?? {}) as { name?: string; profileImage?: string | null };
    const reply = (r.reply ?? {}) as { text?: string; comment?: string };
    return {
      id: String(r.id ?? ""),
      contaId: String(r.accountId ?? filtros.contaId),
      localNome: (r.locationName as string | undefined) ?? null,
      autor: reviewer.name?.trim() || "Cliente",
      fotoAutor: reviewer.profileImage ?? null,
      nota: Math.max(0, Math.min(5, Number(r.rating ?? 0) || 0)),
      texto: limparTextoAvaliacao(String(r.text ?? "")),
      criadoEm: String(r.created ?? ""),
      respondida: Boolean(r.hasReply),
      respostaTexto: reply.text ?? reply.comment ?? null,
      url: (r.reviewUrl as string | undefined) ?? null,
    };
  });

  return {
    avaliacoes,
    resumo: dados.summary
      ? { total: Number(dados.summary.totalReviews ?? 0) || 0, media: Number(dados.summary.averageRating ?? 0) || 0 }
      : null,
    proximoCursor: dados.pagination?.nextCursor ?? null,
  };
}

/**
 * Responde uma avaliação. O Google guarda UMA resposta por avaliação: uma nova
 * sobrescreve a anterior (inclusive uma digitada à mão no Google). A tela avisa.
 */
export async function responderAvaliacao(
  chave: string,
  entrada: { reviewId: string; contaId: string; mensagem: string }
): Promise<void> {
  await requisitar(chave, "POST", `/inbox/reviews/${encodeURIComponent(entrada.reviewId)}/reply`, {
    corpo: { accountId: entrada.contaId, message: entrada.mensagem },
  });
}

// ── Métricas de desempenho do Perfil do Google ────────────────────────────────

export async function metricasGooglePerfil(
  chave: string,
  entrada: { contaId: string; de: string; ate: string }
): Promise<RespostaPerformanceGoogle> {
  return requisitar<RespostaPerformanceGoogle>(chave, "GET", "/analytics/googlebusiness/performance", {
    query: { accountId: entrada.contaId, startDate: entrada.de, endDate: entrada.ate },
  });
}

// ── Insights de conta (Instagram / TikTok) ────────────────────────────────────

export type RespostaInsights = {
  metrics?: Record<string, { total?: number; values?: Array<{ date?: string; value?: number }> } | undefined>;
  dateRange?: { since?: string; until?: string };
};

/** Insights de conta de uma rede (account-insights). plataforma: instagram|tiktok|... */
export async function insightsDaRede(
  chave: string,
  entrada: {
    plataforma: string;
    contaId: string;
    de: string;
    ate: string;
    metricas?: string;
    tipo?: "time_series" | "total_value";
  }
): Promise<RespostaInsights> {
  return requisitar<RespostaInsights>(chave, "GET", `/analytics/${entrada.plataforma}/account-insights`, {
    query: {
      accountId: entrada.contaId,
      since: entrada.de,
      until: entrada.ate,
      metrics: entrada.metricas,
      metricType: entrada.tipo ?? "total_value",
    },
  });
}

/** Histórico diário de seguidores do Instagram (série que preenche com o tempo). */
export async function historicoSeguidoresInstagram(
  chave: string,
  entrada: { contaId: string; de: string; ate: string }
): Promise<RespostaInsights> {
  return requisitar<RespostaInsights>(chave, "GET", "/analytics/instagram/follower-history", {
    query: { accountId: entrada.contaId, since: entrada.de, until: entrada.ate, metricType: "time_series" },
  });
}

// ── Ficha do Perfil do Google (para análise de SEO local) ─────────────────────

export type FichaGoogle = {
  titulo: string | null;
  verificado: boolean;
  site: string | null;
  telefone: string | null;
  categoriaPrincipal: string | null;
  qtdCategoriasSecundarias: number;
  temDescricao: boolean;
  descricao: string | null;
  descricaoLen: number;
  temHorario: boolean;
  endereco: string | null;
};

/** Limite da descrição do Perfil da Empresa no Google. */
export const LIMITE_DESCRICAO_GOOGLE = 750;

export async function fichaGoogle(chave: string, contaId: string): Promise<FichaGoogle> {
  const d = await requisitar<Record<string, unknown>>(chave, "GET", `/accounts/${encodeURIComponent(contaId)}/gmb-location-details`, {
    query: { readMask: "title,websiteUri,phoneNumbers,categories,storefrontAddress,regularHours,profile" },
  });

  const location = (d.location ?? {}) as { isVerified?: boolean; name?: string };
  const categories = (d.categories ?? {}) as {
    primaryCategory?: { displayName?: string };
    additionalCategories?: unknown[];
  };
  const phone = (d.phoneNumbers ?? {}) as { primaryPhone?: string };
  const profile = (d.profile ?? {}) as { description?: string };
  const hours = (d.regularHours ?? {}) as { periods?: unknown[] };
  const endereco = (d.storefrontAddress ?? {}) as { addressLines?: string[]; locality?: string; administrativeArea?: string };

  const descricao = String(profile.description ?? "").trim();
  const linhasEndereco = [endereco.addressLines?.join(", "), endereco.locality, endereco.administrativeArea].filter(Boolean).join(" - ");

  return {
    titulo: (d.title as string | undefined) ?? location.name ?? null,
    verificado: Boolean(location.isVerified),
    site: (d.websiteUri as string | undefined) ?? null,
    telefone: phone.primaryPhone ?? null,
    categoriaPrincipal: categories.primaryCategory?.displayName ?? null,
    qtdCategoriasSecundarias: Array.isArray(categories.additionalCategories) ? categories.additionalCategories.length : 0,
    temDescricao: descricao.length > 0,
    descricao: descricao || null,
    descricaoLen: descricao.length,
    temHorario: Array.isArray(hours.periods) && hours.periods.length > 0,
    endereco: linhasEndereco || null,
  };
}

/** Atualiza a descrição da ficha do Google (profile.description). */
export async function atualizarDescricaoGoogle(chave: string, contaId: string, descricao: string): Promise<void> {
  await requisitar(chave, "PUT", `/accounts/${encodeURIComponent(contaId)}/gmb-location-details`, {
    corpo: { updateMask: "profile.description", profile: { description: descricao } },
  });
}

// ── Caixa de entrada (mensagens diretas) ──────────────────────────────────────

export type ConversaZernio = {
  id: string;
  contaId: string;
  plataforma: string;
  participante: string;
  usuario: string;
  foto: string | null;
  ultimaMensagem: string;
  atualizadoEm: string;
  naoLidas: number;
};

export type AnexoMensagem = { tipo: "image" | "video" | "audio" | "file"; url: string };
export type MensagemDireta = { id: string; texto: string; de: string; entrada: boolean; em: string; anexos: AnexoMensagem[] };

export async function listarConversas(
  chave: string,
  filtros: { cursor?: string | null; limite?: number } = {}
): Promise<{ conversas: ConversaZernio[]; proximoCursor: string | null }> {
  const d = await requisitar<{
    data?: Array<Record<string, unknown>>;
    pagination?: { nextCursor?: string | null };
  }>(chave, "GET", "/inbox/conversations", {
    query: { status: "active", limit: filtros.limite ?? 20, cursor: filtros.cursor ?? undefined },
  });

  const conversas = (d.data ?? []).map((c) => ({
    id: String(c.id ?? ""),
    contaId: String(c.accountId ?? ""),
    plataforma: String(c.platform ?? ""),
    participante: (c.participantName as string | undefined)?.trim() || (c.participantUsername as string | undefined) || "Cliente",
    usuario: (c.participantUsername as string | undefined) ?? "",
    foto: (c.participantPicture as string | undefined) ?? null,
    ultimaMensagem: String(c.lastMessage ?? ""),
    atualizadoEm: String(c.updatedTime ?? ""),
    naoLidas: Number(c.unreadCount ?? 0) || 0,
  }));
  return { conversas, proximoCursor: d.pagination?.nextCursor ?? null };
}

export async function listarMensagens(
  chave: string,
  filtros: { conversaId: string; contaId: string; limite?: number }
): Promise<MensagemDireta[]> {
  const d = await requisitar<{ messages?: Array<Record<string, unknown>> }>(
    chave,
    "GET",
    `/inbox/conversations/${encodeURIComponent(filtros.conversaId)}/messages`,
    { query: { accountId: filtros.contaId, limit: filtros.limite ?? 30 } }
  );
  const tiposValidos = new Set(["image", "video", "audio", "file"]);
  return (d.messages ?? []).map((m) => {
    const anexos: AnexoMensagem[] = (Array.isArray(m.attachments) ? (m.attachments as Array<Record<string, unknown>>) : [])
      .map((a) => {
        const payload = (a.payload ?? {}) as { url?: string };
        const tipoBruto = String(a.type ?? "file");
        return { tipo: (tiposValidos.has(tipoBruto) ? tipoBruto : "file") as AnexoMensagem["tipo"], url: String(payload.url ?? a.url ?? "") };
      })
      .filter((a) => a.url);
    const story = m.storyReply ? "[resposta ao story]" : "";
    const texto = String(m.message ?? "").trim() || story;
    return {
      id: String(m.id ?? ""),
      texto,
      de: String(m.senderName ?? ""),
      entrada: m.direction === "incoming",
      em: String(m.createdAt ?? m.sentAt ?? ""),
      anexos,
    };
  });
}

export async function enviarMensagem(chave: string, entrada: { conversaId: string; contaId: string; texto: string }): Promise<void> {
  await requisitar(chave, "POST", `/inbox/conversations/${encodeURIComponent(entrada.conversaId)}/messages`, {
    corpo: { accountId: entrada.contaId, message: entrada.texto },
  });
}

// ── Melhor horário para postar ────────────────────────────────────────────────

export type HorarioSlot = { diaSemana: number; hora: number; engajamento: number; posts: number };

export async function melhorHorario(chave: string, contaId: string): Promise<HorarioSlot[]> {
  const d = await requisitar<{ slots?: Array<Record<string, number>> }>(chave, "GET", "/analytics/best-time", {
    query: { accountId: contaId },
  });
  return (d.slots ?? [])
    .map((s) => ({
      diaSemana: Number(s.day_of_week ?? 0) % 7,
      hora: Math.max(0, Math.min(23, Number(s.hour ?? 0))),
      engajamento: Math.max(0, Math.round(Number(s.avg_engagement ?? 0)) || 0),
      posts: Math.max(0, Number(s.post_count ?? 0) || 0),
    }))
    .slice(0, 6);
}

/** Categorias de foto aceitas pelo Google (as úteis para uma loja). */
export const CATEGORIAS_FOTO_GOOGLE = ["ADDITIONAL", "COVER", "EXTERIOR", "INTERIOR", "PRODUCT", "LOGO"] as const;
export type CategoriaFotoGoogle = (typeof CATEGORIAS_FOTO_GOOGLE)[number];

/** Adiciona uma foto à ficha do Google a partir de uma URL pública (ex.: mídia da Zernio). */
export async function adicionarFotoGoogle(
  chave: string,
  contaId: string,
  entrada: { sourceUrl: string; categoria?: CategoriaFotoGoogle; descricao?: string }
): Promise<void> {
  await requisitar(chave, "POST", `/accounts/${encodeURIComponent(contaId)}/gmb-media`, {
    corpo: {
      sourceUrl: entrada.sourceUrl,
      mediaFormat: "PHOTO",
      category: entrada.categoria ?? "ADDITIONAL",
      ...(entrada.descricao ? { description: entrada.descricao } : {}),
    },
  });
}

export async function fotosGoogle(chave: string, contaId: string): Promise<{ quantidade: number; temMais: boolean }> {
  const d = await requisitar<{ mediaItems?: unknown[]; nextPageToken?: string }>(
    chave,
    "GET",
    `/accounts/${encodeURIComponent(contaId)}/gmb-media`,
    { query: { pageSize: 100 } }
  );
  return { quantidade: Array.isArray(d.mediaItems) ? d.mediaItems.length : 0, temMais: Boolean(d.nextPageToken) };
}
