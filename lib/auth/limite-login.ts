import { createHash } from "node:crypto";

/**
 * Limite de tentativas de login — contra quem tenta adivinhar a senha.
 *
 * Duas contas, as duas numa janela de 15 minutos, contando so as falhas de
 * e-mail/senha:
 *
 * - POR E-MAIL: 5 erros seguidos travam aquele e-mail ate a janela passar.
 *   Protege a conta mesmo que o ataque venha de muitos enderecos.
 * - POR IP: 20 erros travam aquele endereco. Pega quem testa muitos e-mails
 *   diferentes de um lugar so — sem travar a loja inteira (que costuma sair
 *   por um IP so) com poucos erros normais.
 *
 * Login certo zera as falhas daquele e-mail.
 *
 * E-mail e IP sao guardados como hash SHA-256, nunca em claro: a tabela so
 * precisa comparar, nao saber quem foi.
 */

export const JANELA_DE_TENTATIVAS_MS = 15 * 60 * 1000;
export const MAXIMO_DE_ERROS_POR_EMAIL = 5;
export const MAXIMO_DE_ERROS_POR_IP = 20;

export function resumoDe(valor: string): string {
  return createHash("sha256").update(valor.trim().toLowerCase(), "utf8").digest("hex");
}

export type Bloqueio = { bloqueado: false } | { bloqueado: true; liberaEm: Date };

/**
 * Decide se trava, a partir das datas das falhas recentes (qualquer ordem).
 * Libera quando a falha que completou o limite sair da janela.
 */
export function decidirBloqueio(
  falhasDoEmail: ReadonlyArray<Date>,
  falhasDoIp: ReadonlyArray<Date>,
  agora: Date
): Bloqueio {
  const liberacoes: number[] = [];
  const conferir = (falhas: ReadonlyArray<Date>, maximo: number) => {
    const naJanela = falhas
      .map((d) => d.getTime())
      .filter((t) => agora.getTime() - t < JANELA_DE_TENTATIVAS_MS)
      .sort((a, b) => b - a);
    if (naJanela.length >= maximo) liberacoes.push(naJanela[maximo - 1] + JANELA_DE_TENTATIVAS_MS);
  };
  conferir(falhasDoEmail, MAXIMO_DE_ERROS_POR_EMAIL);
  conferir(falhasDoIp, MAXIMO_DE_ERROS_POR_IP);
  if (liberacoes.length === 0) return { bloqueado: false };
  return { bloqueado: true, liberaEm: new Date(Math.max(...liberacoes)) };
}

export function mensagemDeBloqueio(liberaEm: Date, agora: Date): string {
  const minutos = Math.max(1, Math.ceil((liberaEm.getTime() - agora.getTime()) / 60000));
  return `Muitas tentativas erradas. Por segurança, o acesso fica pausado por ${minutos} ${
    minutos === 1 ? "minuto" : "minutos"
  }. Se esqueceu a senha, peça uma nova ao administrador da loja.`;
}

/** Primeiro IP de x-forwarded-for (o do cliente, na Vercel), ou x-real-ip. */
export function ipDaRequisicao(cabecalhos: { get(nome: string): string | null }): string {
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || cabecalhos.get("x-real-ip")?.trim() || "desconhecido";
}
