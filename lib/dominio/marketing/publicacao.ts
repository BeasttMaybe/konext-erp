/**
 * Marketing — regras puras da publicação: validar o que o usuário preencheu e
 * decidir transições de status. Sem banco, sem rede.
 */

import type { CanalMarketing } from "./plataformas";

export type TipoPublicacao = "POST_ORGANICO" | "ANUNCIO_PAGO";
export type StatusPublicacao = "RASCUNHO" | "AGENDADA" | "PUBLICANDO" | "PUBLICADA" | "FALHOU" | "CANCELADA";

export const LIMITE_TEXTO = 2200; // teto do Instagram, o mais curto dos úteis
export const MINIMO_ANTECEDENCIA_MIN = 5;

export type DadosPublicacao = {
  tipo: TipoPublicacao;
  texto: string;
  canais: CanalMarketing[];
  /** ISO, ou null para salvar como rascunho sem agendar. */
  agendadoPara: string | null;
  /** Só anúncio pago. */
  orcamentoCentavos: number | null;
  linkDestino: string | null;
};

export type ResultadoValidacao = { ok: true; dados: DadosPublicacao } | { ok: false; erro: string };

const CANAIS_VALIDOS = new Set<CanalMarketing>(["INSTAGRAM", "FACEBOOK", "TIKTOK", "GOOGLE_PERFIL"]);

export function validarPublicacao(
  entrada: Record<string, unknown>,
  agora: Date = new Date()
): ResultadoValidacao {
  const tipo: TipoPublicacao = entrada.tipo === "ANUNCIO_PAGO" ? "ANUNCIO_PAGO" : "POST_ORGANICO";

  const texto = String(entrada.texto ?? "").trim();
  if (!texto) return { ok: false, erro: "Escreva o texto da publicação." };
  if (texto.length > LIMITE_TEXTO) return { ok: false, erro: `O texto pode ter até ${LIMITE_TEXTO} caracteres.` };

  const canaisBrutos = Array.isArray(entrada.canais) ? entrada.canais : [];
  const canais = [...new Set(canaisBrutos.map((c) => String(c)))].filter((c): c is CanalMarketing =>
    CANAIS_VALIDOS.has(c as CanalMarketing)
  );
  if (canais.length === 0) return { ok: false, erro: "Escolha ao menos um canal (Instagram, Facebook...)." };

  let agendadoPara: string | null = null;
  const quando = String(entrada.agendadoPara ?? "").trim();
  if (quando) {
    const data = new Date(quando);
    if (Number.isNaN(data.getTime())) return { ok: false, erro: "Data de agendamento inválida." };
    if (data.getTime() < agora.getTime() + MINIMO_ANTECEDENCIA_MIN * 60_000) {
      return { ok: false, erro: `Agende com pelo menos ${MINIMO_ANTECEDENCIA_MIN} minutos de antecedência.` };
    }
    agendadoPara = data.toISOString();
  }

  let orcamentoCentavos: number | null = null;
  let linkDestino: string | null = null;
  if (tipo === "ANUNCIO_PAGO") {
    const bruto = String(entrada.orcamento ?? "").trim().replace(/\./g, "").replace(",", ".");
    const valor = Number(bruto);
    if (!bruto || !Number.isFinite(valor) || valor <= 0) return { ok: false, erro: "Informe a verba do anúncio." };
    orcamentoCentavos = Math.round(valor * 100);
    if (orcamentoCentavos < 100) return { ok: false, erro: "A verba mínima é R$ 1,00." };
    const link = String(entrada.linkDestino ?? "").trim();
    if (link) {
      if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(link)) return { ok: false, erro: "O link de destino precisa ser um endereço válido (https://...)." };
      linkDestino = link;
    }
  }

  return { ok: true, dados: { tipo, texto, canais, agendadoPara, orcamentoCentavos, linkDestino } };
}

/**
 * Para onde vai o status ao SALVAR. Anúncio pago nunca vai direto para
 * AGENDADA/publicar sozinho: fica em RASCUNHO esperando aprovação explícita,
 * mesmo com data marcada (gasta dinheiro). Post orgânico com data vira
 * AGENDADA; sem data, RASCUNHO.
 */
export function statusAoSalvar(dados: Pick<DadosPublicacao, "tipo" | "agendadoPara">): StatusPublicacao {
  if (dados.tipo === "ANUNCIO_PAGO") return "RASCUNHO";
  return dados.agendadoPara ? "AGENDADA" : "RASCUNHO";
}

/** Uma publicação pode ser editada enquanto não saiu. */
export function podeEditar(status: StatusPublicacao): boolean {
  return status === "RASCUNHO" || status === "AGENDADA" || status === "FALHOU";
}

export function podeCancelar(status: StatusPublicacao): boolean {
  return status === "RASCUNHO" || status === "AGENDADA" || status === "FALHOU";
}

/** Quais estão "na fila" para o cron publicar no horário. */
export function estaNaFila(status: StatusPublicacao): boolean {
  return status === "AGENDADA";
}

export function rotuloStatus(status: StatusPublicacao): string {
  const mapa: Record<StatusPublicacao, string> = {
    RASCUNHO: "Rascunho",
    AGENDADA: "Agendada",
    PUBLICANDO: "Publicando",
    PUBLICADA: "Publicada",
    FALHOU: "Falhou",
    CANCELADA: "Cancelada",
  };
  return mapa[status];
}
