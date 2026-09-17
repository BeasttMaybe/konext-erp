import bcrypt from "bcryptjs";

/**
 * Custo unico de hashing de senha para toda a aplicacao — server actions e
 * scripts de provisionamento. Antes, cada script escolhia seu proprio custo
 * (10 em alguns, 12 em outros); nao ha razao para essa divergencia, e ela
 * so cresce se cada lugar novo escolher um numero por conta propria.
 */
export const CUSTO_HASH_SENHA = 12;

export async function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_HASH_SENHA);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export type ResultadoValidacaoSenha = { valida: true } | { valida: false; motivo: string };

/**
 * Regra minima para uma senha NOVA (troca de senha, criacao de usuario):
 * pelo menos 8 caracteres, com letras e numeros. Nao se aplica a senha de
 * login existente — so a validamos contra o hash guardado.
 */
export function validarNovaSenha(senha: string): ResultadoValidacaoSenha {
  if (senha.length < 8) {
    return { valida: false, motivo: "A nova senha deve ter no mínimo 8 caracteres." };
  }

  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return { valida: false, motivo: "A nova senha deve conter letras e números." };
  }

  return { valida: true };
}
