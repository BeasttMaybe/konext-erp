/**
 * Aviso automatico de erros do servidor — regras puras.
 *
 * Todo erro que o Next captura (instrumentation.ts -> onRequestError) vira uma
 * linha em ErroDoSistema (banco central), com a loja de quem estava usando
 * quando da para saber. Erros parecidos avisam pelo Telegram no maximo uma vez
 * a cada 30 minutos, e no maximo 10 avisos por hora no total — um erro em
 * loop nao pode virar uma enxurrada no celular de ninguem.
 *
 * O aviso vai para o chat de TELEGRAM_CHAT_ERROS (quem cuida do sistema, nao
 * a loja). Sem essa variavel, os erros ficam so registrados e aparecem em
 * Configuracoes -> Estado do sistema.
 */

export const INTERVALO_ENTRE_AVISOS_IGUAIS_MS = 30 * 60 * 1000;
export const MAXIMO_DE_AVISOS_POR_HORA = 10;
export const TAMANHO_MAXIMO_DA_MENSAGEM = 500;
export const DIAS_GUARDADOS = 30;

/** Controle de fluxo do Next que chega como "erro" mas nao e defeito. */
const DIGESTS_DE_CONTROLE = ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK", "DYNAMIC_SERVER_USAGE", "BAILOUT_TO_CLIENT_SIDE_RENDERING"];

export function ehControleDeFluxo(erro: unknown): boolean {
  const digest = digestDo(erro) ?? "";
  const mensagem = erro instanceof Error ? erro.message : String(erro ?? "");
  return DIGESTS_DE_CONTROLE.some((d) => digest.startsWith(d) || mensagem.startsWith(d));
}

export function digestDo(erro: unknown): string | null {
  if (typeof erro === "object" && erro !== null && "digest" in erro) {
    const digest = (erro as { digest?: unknown }).digest;
    return digest === undefined || digest === null ? null : String(digest);
  }
  return null;
}

/**
 * Mensagem curta e sem dado pessoal obvio: e-mails, sequencias longas de
 * digitos (CPF, telefone, cartao) e connection strings saem mascarados.
 */
export function resumirMensagem(erro: unknown): string {
  const bruta = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro ?? "erro desconhecido");
  const limpa = bruta
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "***@***")
    .replace(/\d{6,}/g, "***")
    .replace(/\s+/g, " ")
    .trim();
  return limpa.length > TAMANHO_MAXIMO_DA_MENSAGEM ? `${limpa.slice(0, TAMANHO_MAXIMO_DA_MENSAGEM - 1)}…` : limpa;
}

const ROTULO_DO_TIPO: Record<string, string> = {
  render: "tela",
  route: "rota",
  action: "ação",
  proxy: "proxy",
};

/** Onde: tipo + caminho do ARQUIVO da rota (ex.: "tela /os/[id]") — nunca o endereco com ids. */
export function origemDoErro(contexto: { routeType?: string; routePath?: string }, metodo?: string): string {
  const tipo = ROTULO_DO_TIPO[contexto.routeType ?? ""] ?? contexto.routeType ?? "?";
  const caminho = contexto.routePath || "?";
  return `${tipo} ${caminho}${metodo && contexto.routeType === "route" ? ` (${metodo})` : ""}`;
}

export function deveAvisar(params: {
  ultimoAvisoDoMesmoErro: Date | null;
  avisosNaUltimaHora: number;
  agora: Date;
}): boolean {
  if (params.avisosNaUltimaHora >= MAXIMO_DE_AVISOS_POR_HORA) return false;
  if (!params.ultimoAvisoDoMesmoErro) return true;
  return params.agora.getTime() - params.ultimoAvisoDoMesmoErro.getTime() >= INTERVALO_ENTRE_AVISOS_IGUAIS_MS;
}

export function textoDoAviso(params: { origem: string; mensagem: string; loja: string | null; ambiente: string | null }): string {
  return [
    `⚠️ Erro no TechOS${params.ambiente && params.ambiente !== "production" ? ` (${params.ambiente})` : ""}`,
    `Onde: ${params.origem}`,
    params.loja ? `Loja: ${params.loja}` : null,
    `Erro: ${params.mensagem}`,
    "Erros iguais ficam 30 min sem novo aviso. Lista completa em Configurações → Estado do sistema.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Valor do cookie de sessao no cabecalho Cookie (string ou lista). */
export function valorDoCookie(cabecalho: string | string[] | undefined, nome: string): string | null {
  const texto = Array.isArray(cabecalho) ? cabecalho.join("; ") : (cabecalho ?? "");
  for (const parte of texto.split(";")) {
    const [chave, ...resto] = parte.trim().split("=");
    if (chave === nome) return decodeURIComponent(resto.join("="));
  }
  return null;
}
