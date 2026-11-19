/**
 * Marketing via Zernio — parte PURA: traduções e agregações que não falam com a
 * rede (a chamada HTTP fica em lib/zernio/cliente.ts, só servidor). Fica
 * separada para poder ser testada sem subir nada.
 */

import type { CanalMarketing } from "@/lib/dominio/marketing/plataformas";

/** Nome da plataforma na Zernio (o que vai no campo `platform` da API). */
export type PlataformaZernio = "instagram" | "facebook" | "tiktok" | "googlebusiness";

const CANAL_PARA_ZERNIO: Record<CanalMarketing, PlataformaZernio> = {
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  GOOGLE_PERFIL: "googlebusiness",
};

const ZERNIO_PARA_CANAL: Record<string, CanalMarketing> = {
  instagram: "INSTAGRAM",
  facebook: "FACEBOOK",
  tiktok: "TIKTOK",
  googlebusiness: "GOOGLE_PERFIL",
};

export function canalParaZernio(canal: CanalMarketing): PlataformaZernio {
  return CANAL_PARA_ZERNIO[canal];
}

export function zernioParaCanal(plataforma: string): CanalMarketing | null {
  return ZERNIO_PARA_CANAL[plataforma] ?? null;
}

// ── Avaliações ────────────────────────────────────────────────────────────────

/**
 * O Google anexa a tradução automática depois do texto original, assim:
 *   "Ótimo atendimento.\n\n(Translated by Google)\nExcellent service."
 * Guardamos só o que o cliente escreveu — a tradução polui a tela e a resposta.
 */
export function limparTextoAvaliacao(texto: string): string {
  const marcador = texto.search(/\(Translated by Google\)/i);
  const semTraducao = marcador >= 0 ? texto.slice(0, marcador) : texto;
  return semTraducao.replace(/\n{3,}/g, "\n\n").trim();
}

// ── Métricas do Perfil do Google ──────────────────────────────────────────────

/** As quatro métricas de impressão que, somadas, dão as "visualizações". */
export const METRICAS_IMPRESSAO = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
] as const;

export type RespostaPerformanceGoogle = {
  metrics?: Record<string, { total?: number; values?: Array<{ date?: string; value?: number }> } | undefined>;
  dateRange?: { startDate?: string; endDate?: string };
};

export type DiaDeMetrica = {
  data: string;
  impressoes: number;
  ligacoes: number;
  rotas: number;
  cliquesSite: number;
};

export type MetricasGoogle = {
  de: string | null;
  ate: string | null;
  totais: {
    impressoes: number;
    ligacoes: number;
    rotas: number;
    cliquesSite: number;
    conversas: number;
  };
  porDia: DiaDeMetrica[];
};

function totalDaMetrica(resposta: RespostaPerformanceGoogle, nome: string): number {
  return Math.max(0, Math.round(Number(resposta.metrics?.[nome]?.total ?? 0)) || 0);
}

/** Soma uma série diária num mapa data→valor, criando a chave se faltar. */
function acumularSerie(
  destino: Map<string, DiaDeMetrica>,
  resposta: RespostaPerformanceGoogle,
  nome: string,
  campo: keyof Omit<DiaDeMetrica, "data">
): void {
  for (const ponto of resposta.metrics?.[nome]?.values ?? []) {
    const data = String(ponto?.date ?? "");
    if (!data) continue;
    const valor = Math.max(0, Number(ponto?.value ?? 0) || 0);
    const atual = destino.get(data) ?? { data, impressoes: 0, ligacoes: 0, rotas: 0, cliquesSite: 0 };
    atual[campo] += valor;
    destino.set(data, atual);
  }
}

/** Resume a resposta crua da Zernio nos números que a tela usa. */
export function resumirMetricasGoogle(resposta: RespostaPerformanceGoogle): MetricasGoogle {
  const impressoes = METRICAS_IMPRESSAO.reduce((soma, nome) => soma + totalDaMetrica(resposta, nome), 0);

  const porDiaMapa = new Map<string, DiaDeMetrica>();
  for (const nome of METRICAS_IMPRESSAO) acumularSerie(porDiaMapa, resposta, nome, "impressoes");
  acumularSerie(porDiaMapa, resposta, "CALL_CLICKS", "ligacoes");
  acumularSerie(porDiaMapa, resposta, "BUSINESS_DIRECTION_REQUESTS", "rotas");
  acumularSerie(porDiaMapa, resposta, "WEBSITE_CLICKS", "cliquesSite");

  const porDia = [...porDiaMapa.values()].sort((a, b) => a.data.localeCompare(b.data));

  return {
    de: resposta.dateRange?.startDate ?? porDia[0]?.data ?? null,
    ate: resposta.dateRange?.endDate ?? porDia[porDia.length - 1]?.data ?? null,
    totais: {
      impressoes,
      ligacoes: totalDaMetrica(resposta, "CALL_CLICKS"),
      rotas: totalDaMetrica(resposta, "BUSINESS_DIRECTION_REQUESTS"),
      cliquesSite: totalDaMetrica(resposta, "WEBSITE_CLICKS"),
      conversas: totalDaMetrica(resposta, "BUSINESS_CONVERSATIONS"),
    },
    porDia,
  };
}
