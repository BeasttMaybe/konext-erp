import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Regras puras do acesso ao master (testadas em regras.test.ts).
 */

export const COOKIE_SESSAO = "konext_master_sessao";
export const DURACAO_DA_SESSAO_MS = 12 * 60 * 60 * 1000;
export const JANELA_DE_TENTATIVAS_MS = 15 * 60 * 1000;
export const MAXIMO_DE_ERROS = 5;

export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hash(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/** Chave do limite de tentativas: prefixo proprio, para nao misturar com o login do ERP na mesma tabela. */
export function chaveDoLimite(email: string): string {
  return hash(`master:${email.trim().toLowerCase()}`);
}

/** Compara o codigo de criacao em tempo constante. */
export function codigoConfere(informado: string, esperado: string | undefined): boolean {
  if (!esperado || esperado.length < 12) return false;
  const a = Buffer.from(hash(informado));
  const b = Buffer.from(hash(esperado));
  return timingSafeEqual(a, b);
}

export function validarSenhaNova(senha: string): string | null {
  if (senha.length < 12) return "A senha do master precisa de pelo menos 12 caracteres.";
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  return null;
}

export function estaBloqueado(falhas: ReadonlyArray<Date>, agora: Date): boolean {
  return falhas.filter((d) => agora.getTime() - d.getTime() < JANELA_DE_TENTATIVAS_MS).length >= MAXIMO_DE_ERROS;
}
