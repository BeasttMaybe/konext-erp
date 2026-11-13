import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifra simetrica dos dados sensiveis que a loja guarda no banco dela (hoje:
 * senha e desenho de desbloqueio do aparelho na OS).
 *
 * AES-256-GCM: confidencialidade + integridade (um valor adulterado nao abre,
 * em vez de abrir errado). IV aleatorio de 12 bytes por valor, entao a mesma
 * senha gravada duas vezes nao fica igual no banco.
 *
 * FORMATO GUARDADO: "v1:" + base64url(iv | tag | texto cifrado). O prefixo de
 * versao deixa trocar o algoritmo um dia sem ambiguidade, e e o que separa um
 * valor cifrado de um valor antigo em texto puro.
 *
 * LEITURA DUPLA: `abrir` devolve um valor sem prefixo como esta — as OS
 * gravadas antes desta mudanca continuam legiveis ate o script de migracao
 * cifra-las, em qualquer ordem de deploy.
 *
 * O "contexto" (AAD) amarra o valor ao campo: uma senha cifrada copiada para
 * outro campo cifrado nao abre la.
 */

const PREFIXO_V1 = "v1:";
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;
export const TAMANHO_DA_CHAVE = 32;

export function gerarChave(): string {
  return randomBytes(TAMANHO_DA_CHAVE).toString("base64");
}

export function lerChave(base64: string): Buffer {
  const chave = Buffer.from(base64, "base64");
  if (chave.length !== TAMANHO_DA_CHAVE) throw new Error("Chave de cifra com tamanho invalido.");
  return chave;
}

export function estaCifrado(valor: string | null | undefined): boolean {
  return typeof valor === "string" && valor.startsWith(PREFIXO_V1);
}

export function cifrar(texto: string, chave: Buffer, contexto: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cifrador = createCipheriv("aes-256-gcm", chave, iv);
  cifrador.setAAD(Buffer.from(contexto, "utf8"));
  const corpo = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  const tag = cifrador.getAuthTag();
  return PREFIXO_V1 + Buffer.concat([iv, tag, corpo]).toString("base64url");
}

/** Abre um valor cifrado; lanca se a chave/contexto nao conferem ou se foi adulterado. */
export function decifrar(valor: string, chave: Buffer, contexto: string): string {
  if (!estaCifrado(valor)) throw new Error("Valor nao esta cifrado.");
  const bruto = Buffer.from(valor.slice(PREFIXO_V1.length), "base64url");
  if (bruto.length < TAMANHO_IV + TAMANHO_TAG) throw new Error("Valor cifrado truncado.");
  const iv = bruto.subarray(0, TAMANHO_IV);
  const tag = bruto.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG);
  const corpo = bruto.subarray(TAMANHO_IV + TAMANHO_TAG);
  const decifrador = createDecipheriv("aes-256-gcm", chave, iv);
  decifrador.setAAD(Buffer.from(contexto, "utf8"));
  decifrador.setAuthTag(tag);
  return Buffer.concat([decifrador.update(corpo), decifrador.final()]).toString("utf8");
}

/**
 * Leitura dupla: cifrado -> abre; texto puro antigo -> devolve como esta;
 * vazio -> null. Um valor cifrado que nao abre (chave errada, adulterado)
 * vira null — a tela mostra "nao informada" em vez de quebrar a OS inteira.
 */
export function abrir(valor: string | null | undefined, chave: Buffer, contexto: string): string | null {
  if (!valor) return null;
  if (!estaCifrado(valor)) return valor;
  try {
    return decifrar(valor, chave, contexto);
  } catch {
    return null;
  }
}

/** Campos cifrados conhecidos — o contexto de cada um. */
export const CONTEXTO_SENHA_DO_APARELHO = "os.senha";
export const CONTEXTO_DESENHO_DO_APARELHO = "os.senhaDesenho";
