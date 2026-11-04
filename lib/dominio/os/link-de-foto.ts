/**
 * O endereço do link de envio de foto pelo celular, e como lê-lo de volta.
 *
 * O formato é `/foto/<slug-da-loja>/<segredo>`, e a razão de o slug estar ali
 * é a arquitetura do sistema: cada loja tem o seu PRÓPRIO banco, e uma rota
 * pública não tem sessão pra dizer qual é. Sem o slug na URL só restariam
 * duas saídas ruins — procurar o segredo em todos os bancos, um a um (lento,
 * e transforma um palpite de token numa sonda contra a base inteira), ou
 * manter um índice central de segredos, que espalharia a credencial por dois
 * bancos e obrigaria a revogação a acertar os dois.
 *
 * O slug não é segredo: é o identificador da loja, aparece em endereço e em
 * documento. Quem protege o link é o segredo, e ele tem 256 bits.
 */

/** Só letras minúsculas, números e hífen — o formato de slug do cadastro. */
const PADRAO_DE_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * base64url, que é o alfabeto seguro pra URL: nada de `+`, `/` ou `=`, que
 * seriam reescritos no caminho e quebrariam o segredo em silêncio.
 */
const PADRAO_DE_SEGREDO = /^[A-Za-z0-9_-]{20,128}$/;

export function montarCaminhoDoLink(slug: string, segredo: string): string {
  return `/foto/${slug}/${segredo}`;
}

/**
 * A URL completa, pro QR code e pro botão de copiar.
 *
 * `base` precisa ser absoluta: um QR code com caminho relativo não leva a
 * lugar nenhum, porque o celular que vai lê-lo não tem a menor ideia de qual
 * é o site. Ela é montada a partir do endereço da própria requisição (ver
 * `lib/url-da-requisicao.ts`) em vez de uma variável de ambiente — assim o
 * link sai certo em produção, em preview e no ambiente local sem ninguém
 * precisar configurar nada, e sem o risco silencioso de um valor
 * desatualizado gerar QR code pro endereço errado.
 */
export function montarUrlDoLink(base: string, slug: string, segredo: string): string {
  return `${base.replace(/\/+$/, "")}${montarCaminhoDoLink(slug, segredo)}`;
}

export type LinkLido = { slug: string; segredo: string };

/**
 * Valida o que chegou na URL ANTES de ir ao banco.
 *
 * É o primeiro filtro de uma rota pública: qualquer um pode chamar
 * `/foto/<qualquer coisa>/<qualquer coisa>`, e tratar lixo como consulta
 * legítima é dar à internet inteira um gerador de consultas no banco.
 * O que não tem forma de slug e de segredo não chega a virar query.
 */
export function lerLinkDaUrl(slug: unknown, segredo: unknown): LinkLido | null {
  if (typeof slug !== "string" || typeof segredo !== "string") return null;
  if (!PADRAO_DE_SLUG.test(slug)) return null;
  if (!PADRAO_DE_SEGREDO.test(segredo)) return null;

  return { slug, segredo };
}

/**
 * A frase que a rota pública devolve para QUALQUER recusa.
 *
 * Uma só, de propósito. "Não existe", "expirou" e "foi revogado" são coisas
 * diferentes do lado de dentro, mas dizer qual delas é contaria a quem está
 * sondando se o segredo tinha o formato certo e se a loja existe. Quem
 * precisa da distinção é o painel da OS, que tem sessão e mostra a situação
 * de cada link; quem está do lado de fora só precisa saber o que fazer, e o
 * que fazer é pedir outro link.
 */
export const FRASE_DE_RECUSA =
  "Este link não vale mais. Peça um novo na tela da ordem de serviço.";

/**
 * O caminho público de rastreio de uma OS: `/r/<loja>/<os>`.
 *
 * Mesma ideia do link de foto, e por isso mora ao lado dele: o slug diz qual
 * banco abrir numa rota que não tem sessão. A diferença é o que autoriza —
 * aqui é o próprio id da OS, 122 bits sorteados, que já está impresso em
 * comprovante e mandado por mensagem. Trocá-lo por um segredo novo
 * invalidaria todo link que um cliente guardou, pra resolver um problema
 * que ninguém tem.
 *
 * Curto de propósito: este endereço vai por WhatsApp.
 *
 * Sem o slug (fora do provedor da loja) cai na rota antiga, que atende só o
 * banco principal. Um link que leva a algum lugar é melhor que `/r/null/…`.
 */
export function caminhoDeRastreio(slug: string | null, osId: string): string {
  return slug ? `/r/${slug}/${osId}` : `/rastreio/${osId}`;
}
