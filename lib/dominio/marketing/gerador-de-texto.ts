/**
 * Gerador de texto de publicação "com IA" — parte pura: montar o pedido
 * (mensagens para o modelo) a partir do contexto da loja e das referências
 * que o usuário deu, e ler a resposta. A chamada à IA em si fica em
 * lib/ia/cliente.ts (só servidor).
 *
 * A ideia do usuário: ele dá o tema e referências de "como quer", e o sistema
 * escreve o post no estilo pedido, já no contexto da loja.
 */

import { ROTULO_CANAL, type CanalMarketing } from "./plataformas";

export type TomDaPublicacao = "ANIMADO" | "PROFISSIONAL" | "PROMOCIONAL" | "INFORMATIVO" | "PROXIMO";

export const TONS: ReadonlyArray<{ id: TomDaPublicacao; rotulo: string }> = [
  { id: "ANIMADO", rotulo: "Animado" },
  { id: "PROMOCIONAL", rotulo: "Promocional" },
  { id: "PROFISSIONAL", rotulo: "Profissional" },
  { id: "INFORMATIVO", rotulo: "Informativo" },
  { id: "PROXIMO", rotulo: "Próximo / descontraído" },
];

const DESCRICAO_TOM: Record<TomDaPublicacao, string> = {
  ANIMADO: "animado e empolgado, com energia",
  PROFISSIONAL: "profissional e confiável, sem gírias",
  PROMOCIONAL: "promocional e persuasivo, puxando para a ação",
  INFORMATIVO: "informativo e claro, explicando o benefício",
  PROXIMO: "próximo e descontraído, como quem fala com um amigo",
};

export type ContextoDaLoja = {
  nome: string;
  cidade: string | null;
  telefone: string | null;
  /** Uma frase do que a loja faz, para situar o modelo. */
  segmento: string;
};

export type PedidoDeTexto = {
  tema: string;
  tom: TomDaPublicacao;
  canais: CanalMarketing[];
  /** Texto livre do usuário: estilo desejado, exemplos, o que destacar. */
  referencias: string;
  /** Quantas variações gerar. */
  variacoes: number;
};

export type MensagemIA = { papel: "system" | "user"; conteudo: string };

export const MAX_REFERENCIAS = 1500;
export const MAX_TEMA = 300;

export type ResultadoPedido = { ok: true; pedido: PedidoDeTexto } | { ok: false; erro: string };

const CANAIS_VALIDOS = new Set<CanalMarketing>(["INSTAGRAM", "FACEBOOK", "TIKTOK", "GOOGLE_PERFIL"]);

export function lerPedido(entrada: Record<string, unknown>): ResultadoPedido {
  const tema = String(entrada.tema ?? "").trim();
  if (!tema) return { ok: false, erro: "Diga sobre o que é a publicação." };
  if (tema.length > MAX_TEMA) return { ok: false, erro: `O tema pode ter até ${MAX_TEMA} caracteres.` };

  const tom = (TONS.find((t) => t.id === entrada.tom)?.id ?? "ANIMADO") as TomDaPublicacao;

  const canaisBrutos = Array.isArray(entrada.canais) ? entrada.canais : [];
  const canais = [...new Set(canaisBrutos.map(String))].filter((c): c is CanalMarketing => CANAIS_VALIDOS.has(c as CanalMarketing));

  const referencias = String(entrada.referencias ?? "").trim().slice(0, MAX_REFERENCIAS);

  const n = Number(entrada.variacoes);
  const variacoes = Number.isFinite(n) ? Math.min(3, Math.max(1, Math.trunc(n))) : 2;

  return { ok: true, pedido: { tema, tom, canais, referencias, variacoes } };
}

/** Limite de tamanho por canal, para o modelo não estourar a legenda. */
function limiteDoCanal(canais: CanalMarketing[]): number {
  if (canais.includes("GOOGLE_PERFIL")) return 1400;
  if (canais.length === 0) return 2000;
  return 2200;
}

/** Monta as mensagens (system + user) para o modelo. */
export function montarMensagens(contexto: ContextoDaLoja, pedido: PedidoDeTexto): MensagemIA[] {
  const canaisTexto = pedido.canais.length ? pedido.canais.map((c) => ROTULO_CANAL[c]).join(", ") : "redes sociais";
  const limite = limiteDoCanal(pedido.canais);

  const sistema = [
    "Você é redator de social media de uma assistência técnica de celulares no Brasil.",
    "Escreve legendas de post curtas, em português do Brasil, prontas para publicar.",
    "Regras:",
    `- Tom: ${DESCRICAO_TOM[pedido.tom]}.`,
    `- No máximo ${limite} caracteres por legenda.`,
    "- Pode usar emojis com moderação e até 5 hashtags relevantes no fim.",
    "- Nunca invente preços, prazos, garantias ou dados que não foram informados.",
    "- Não use colchetes nem campos para preencher; entregue o texto final.",
    "- Fale como a própria loja (primeira pessoa do plural), não descreva o post.",
  ].join("\n");

  const dadosLoja = [
    `Loja: ${contexto.nome}`,
    contexto.segmento ? `O que faz: ${contexto.segmento}` : "",
    contexto.cidade ? `Cidade: ${contexto.cidade}` : "",
    contexto.telefone ? `Contato: ${contexto.telefone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const usuario = [
    `Escreva ${pedido.variacoes} ${pedido.variacoes === 1 ? "legenda" : "legendas diferentes"} para ${canaisTexto}.`,
    "",
    `Tema da publicação: ${pedido.tema}`,
    pedido.referencias ? `\nComo o dono quer (estilo, exemplos, o que destacar):\n${pedido.referencias}` : "",
    "",
    "Contexto da loja:",
    dadosLoja,
    "",
    pedido.variacoes > 1
      ? "Separe cada legenda com uma linha contendo apenas ---. Não numere nem adicione títulos."
      : "Entregue apenas a legenda, sem título.",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { papel: "system", conteudo: sistema },
    { papel: "user", conteudo: usuario },
  ];
}

/** Quebra a resposta do modelo em variações limpas. */
export function separarVariacoes(resposta: string): string[] {
  return resposta
    .split(/\n\s*-{3,}\s*\n/)
    .map((bloco) =>
      bloco
        .trim()
        // tira numeração/título que o modelo às vezes insiste em pôr
        .replace(/^\s*(op[cç][aã]o|vers[aã]o|legenda)\s*\d*\s*[:.)-]\s*/i, "")
        .replace(/^\s*\d+[.)]\s*/, "")
        .trim()
    )
    .filter((t) => t.length > 0)
    .slice(0, 3);
}
