import "server-only";

/**
 * Conversa com a API v3 do Bling.
 *
 * Este módulo só sabe falar HTTP com o Bling: montar URL, trocar código por
 * token, renovar token, buscar página. Ele não sabe o que é um tenant, não
 * abre banco e não decide quando renovar — isso é `lib/bling/conexao.ts`.
 *
 * O QUE A API COBRA E QUE DÁ PRA ERRAR SEM PERCEBER
 *
 * - **3 requisições por segundo por conta.** Estourar devolve 429.
 * - **Estourar `/oauth/token` bloqueia o IP por 60 minutos.** Numa plataforma
 *   serverless o IP é compartilhado, então um laço de retry aqui não derruba
 *   só esta loja: derruba a renovação de todas. Por isso NÃO existe retry
 *   automático na troca de token neste módulo.
 * - **O refresh token rotaciona a cada uso.** Tratado em `conexao.ts`, que é
 *   quem guarda o token novo.
 * - **`enable-jwt: 1`** porque o token opaco foi descontinuado.
 */

const BASE_DA_API = "https://api.bling.com.br/Api/v3";
const URL_DE_AUTORIZACAO = "https://www.bling.com.br/Api/v3/oauth/authorize";

export const CAMINHO_DO_CALLBACK = "/api/integracoes/bling/callback";

export type TokensDoBling = {
  accessToken: string;
  refreshToken: string;
  /** Quando o access token expira, já convertido em instante. */
  expiraEm: Date;
};

export class ErroDoBling extends Error {
  constructor(
    mensagem: string,
    readonly status: number | null,
    /** `true` quando reconectar é o único caminho: o refresh token morreu. */
    readonly exigeReconexao: boolean = false
  ) {
    super(mensagem);
    this.name = "ErroDoBling";
  }
}

export function blingEstaConfigurado(): boolean {
  return (
    (process.env.BLING_CLIENT_ID ?? "").trim() !== "" &&
    (process.env.BLING_CLIENT_SECRET ?? "").trim() !== ""
  );
}

function credenciais(): { clientId: string; clientSecret: string } {
  const clientId = (process.env.BLING_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.BLING_CLIENT_SECRET ?? "").trim();

  if (clientId === "" || clientSecret === "") {
    throw new ErroDoBling(
      "BLING_CLIENT_ID e BLING_CLIENT_SECRET precisam estar configurados no ambiente.",
      null
    );
  }

  return { clientId, clientSecret };
}

export function montarUrlDeRedirecionamento(urlBase: string): string {
  return `${urlBase.replace(/\/+$/, "")}${CAMINHO_DO_CALLBACK}`;
}

/**
 * A URL para onde o dono é mandado para autorizar.
 *
 * `redirect_uri` vai junto porque o Bling confere contra o que foi cadastrado
 * no aplicativo — e é a divergência mais comum na primeira configuração: uma
 * barra a mais de um lado e a autorização é recusada sem explicação útil.
 */
export function montarUrlDeAutorizacao({
  urlBase,
  estado,
}: {
  urlBase: string;
  estado: string;
}): string {
  const { clientId } = credenciais();

  const parametros = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    state: estado,
    redirect_uri: montarUrlDeRedirecionamento(urlBase),
  });

  return `${URL_DE_AUTORIZACAO}?${parametros.toString()}`;
}

/**
 * Converte `expires_in` (segundos) no instante em que o token morre.
 *
 * Com uma margem de cinco minutos: um token que expira "em 3 segundos" é um
 * token vencido no momento em que a próxima requisição sai, e renovar tarde
 * demais produz um 401 que parece bug e é só relógio.
 */
const MARGEM_DE_SEGURANCA_EM_SEGUNDOS = 300;

function instanteDeExpiracao(expiresEm: unknown): Date {
  const segundos = typeof expiresEm === "number" && Number.isFinite(expiresEm) ? expiresEm : 21_600;
  const comMargem = Math.max(60, segundos - MARGEM_DE_SEGURANCA_EM_SEGUNDOS);

  return new Date(Date.now() + comMargem * 1000);
}

async function pedirToken(corpo: URLSearchParams): Promise<TokensDoBling> {
  const { clientId, clientSecret } = credenciais();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  // SEM RETRY, deliberadamente: estourar `/oauth/token` bloqueia o IP por 60
  // minutos, e numa plataforma serverless o IP é compartilhado — um laço aqui
  // derrubaria a renovação de todas as lojas, não só desta.
  const resposta = await fetch(`${BASE_DA_API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "enable-jwt": "1",
    },
    body: corpo.toString(),
  });

  const texto = await resposta.text();

  if (!resposta.ok) {
    // `invalid_grant` significa que o refresh token não vale mais — por ter
    // sido usado, revogado, ou porque uma renovação concorrente o rotacionou.
    // É o único caso em que reconectar à mão é o caminho; os outros são
    // transitórios e a próxima tentativa resolve.
    const morreu = resposta.status === 400 && texto.includes("invalid_grant");

    throw new ErroDoBling(
      `O Bling recusou a autenticação (${resposta.status}): ${texto.slice(0, 300)}`,
      resposta.status,
      morreu
    );
  }

  let dados: Record<string, unknown>;
  try {
    dados = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    throw new ErroDoBling("O Bling respondeu num formato que não é JSON.", resposta.status);
  }

  const accessToken = typeof dados.access_token === "string" ? dados.access_token : "";
  const refreshToken = typeof dados.refresh_token === "string" ? dados.refresh_token : "";

  if (accessToken === "" || refreshToken === "") {
    throw new ErroDoBling(
      "O Bling respondeu sem access_token ou refresh_token.",
      resposta.status
    );
  }

  return { accessToken, refreshToken, expiraEm: instanteDeExpiracao(dados.expires_in) };
}

export async function trocarCodigoPorTokens({
  codigo,
  urlBase,
}: {
  codigo: string;
  urlBase: string;
}): Promise<TokensDoBling> {
  return pedirToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: codigo,
      redirect_uri: montarUrlDeRedirecionamento(urlBase),
    })
  );
}

export async function renovarTokens(refreshToken: string): Promise<TokensDoBling> {
  return pedirToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

/**
 * Uma chamada à API já autenticada.
 *
 * Devolve o JSON cru. A tradução para o que a Konext entende fica em quem
 * chama, de propósito: enquanto a forma exata das respostas do Bling não
 * tiver sido vista com dados reais, a tradução é o lugar que vai mudar, e
 * mantê-la fora daqui deixa este módulo estável.
 */
export async function chamarBling({
  accessToken,
  caminho,
  parametros,
}: {
  accessToken: string;
  /** Ex.: "/nfe" ou "/contas/receber". */
  caminho: string;
  parametros?: Record<string, string | number | undefined>;
}): Promise<unknown> {
  const url = new URL(`${BASE_DA_API}${caminho}`);

  for (const [chave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== undefined && valor !== "") url.searchParams.set(chave, String(valor));
  }

  const resposta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (resposta.status === 401) {
    throw new ErroDoBling("O Bling recusou o token de acesso.", 401, false);
  }

  if (resposta.status === 429) {
    throw new ErroDoBling(
      "O Bling pediu para ir mais devagar (limite de 3 requisições por segundo).",
      429
    );
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new ErroDoBling(
      `O Bling respondeu ${resposta.status}: ${corpo.slice(0, 300)}`,
      resposta.status
    );
  }

  return resposta.json();
}

/**
 * Espera entre chamadas, para respeitar as 3 requisições por segundo.
 *
 * Simples de propósito: um controlador de vazão compartilhado não
 * sobreviveria ao serverless, onde cada invocação é um processo novo e não vê
 * as outras. Esperar entre as páginas da MESMA sincronização é o que dá para
 * garantir de dentro de um processo — e é o que basta, porque é a única coisa
 * neste sistema que faz várias chamadas seguidas.
 */
export function esperarPelaVazao(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, 400));
}
