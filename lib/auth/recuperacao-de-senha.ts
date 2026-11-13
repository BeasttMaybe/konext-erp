import { createHash, randomBytes } from "node:crypto";

/**
 * Recuperacao de senha — as duas portas:
 *
 * 1. O ADMINISTRADOR da loja gera uma senha nova para um usuario (tela
 *    Usuarios e Cargos). Regras em `decidirNovaSenhaPeloAdmin`.
 * 2. A PROPRIA pessoa pede um link por e-mail ("Esqueci minha senha"). So
 *    funciona com o envio de e-mail configurado (RESEND_API_KEY +
 *    EMAIL_REMETENTE); sem isso, a tela manda falar com o administrador.
 *
 * O link leva um token aleatorio de 32 bytes; o banco guarda so o SHA-256
 * dele (TokenRecuperacaoSenha), entao quem le o banco nao usa o link. Vale 30
 * minutos e uma vez so; usar um invalida os outros da mesma pessoa.
 */

export const VALIDADE_DO_LINK_MS = 30 * 60 * 1000;
export const MAXIMO_DE_LINKS_POR_HORA = 3;

export function gerarTokenDeRecuperacao(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Formato de um token nosso: 43 caracteres base64url. Barra lixo antes de ir ao banco. */
export function tokenTemFormatoValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type SituacaoDoToken = "valido" | "inexistente" | "usado" | "expirado";

export function situacaoDoToken(
  token: { expiraEm: Date; usadoEm: Date | null } | null,
  agora: Date
): SituacaoDoToken {
  if (!token) return "inexistente";
  if (token.usadoEm) return "usado";
  if (token.expiraEm.getTime() <= agora.getTime()) return "expirado";
  return "valido";
}

export const MENSAGEM_LINK_INVALIDO: Record<Exclude<SituacaoDoToken, "valido">, string> = {
  inexistente: "Este link não é válido. Peça um novo na tela de login.",
  usado: "Este link já foi usado. Se precisar, peça um novo na tela de login.",
  expirado: "Este link expirou (vale 30 minutos). Peça um novo na tela de login.",
};

/** Endereco base dos links. URL_DO_SISTEMA manda; na Vercel, o dominio de producao. Nunca o Host da requisicao em producao. */
export function enderecoDoSistema(
  ambiente: { URL_DO_SISTEMA?: string; VERCEL_PROJECT_PRODUCTION_URL?: string },
  hostDaRequisicao: string | null
): string | null {
  const configurado = ambiente.URL_DO_SISTEMA?.trim().replace(/\/+$/, "");
  if (configurado) return configurado;
  const vercel = ambiente.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  // Desenvolvimento local, sem nenhum dos dois.
  if (hostDaRequisicao && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(hostDaRequisicao)) return `http://${hostDaRequisicao}`;
  return null;
}

export type DecisaoNovaSenha = { permitido: true } | { permitido: false; motivo: string };

export function decidirNovaSenhaPeloAdmin(alvo: {
  ehVoceMesmo: boolean;
  ehResponsavelPelaLoja: boolean;
  ativo: boolean;
  usadoEmOutraLoja: boolean;
}): DecisaoNovaSenha {
  if (alvo.ehVoceMesmo) {
    return { permitido: false, motivo: "Para trocar a sua própria senha, use \"Meu perfil\"." };
  }
  if (alvo.ehResponsavelPelaLoja) {
    return { permitido: false, motivo: "A senha do responsável pela loja só ele mesmo pode trocar." };
  }
  if (!alvo.ativo) {
    return { permitido: false, motivo: "Reative o usuário antes de gerar uma senha nova." };
  }
  if (alvo.usadoEmOutraLoja) {
    return {
      permitido: false,
      motivo: "Esta conta também é usada em outra loja. A pessoa precisa usar \"Esqueci minha senha\" na tela de login.",
    };
  }
  return { permitido: true };
}
