// Mesmo formato de lib/seguranca/cifra.ts, para os scripts (.mjs nao passam
// pelo bundler/paths do Next). O teste lib/seguranca/cifra-scripts.test.ts
// garante que um lado abre o que o outro cifrou — se mudar um, mude o outro.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIXO_V1 = "v1:";

export function gerarChave() {
  return randomBytes(32).toString("base64");
}

export function lerChave(base64) {
  const chave = Buffer.from(base64, "base64");
  if (chave.length !== 32) throw new Error("Chave de cifra com tamanho invalido.");
  return chave;
}

export function estaCifrado(valor) {
  return typeof valor === "string" && valor.startsWith(PREFIXO_V1);
}

export function cifrar(texto, chave, contexto) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", chave, iv);
  cifrador.setAAD(Buffer.from(contexto, "utf8"));
  const corpo = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  return PREFIXO_V1 + Buffer.concat([iv, cifrador.getAuthTag(), corpo]).toString("base64url");
}

export function decifrar(valor, chave, contexto) {
  const bruto = Buffer.from(valor.slice(PREFIXO_V1.length), "base64url");
  const decifrador = createDecipheriv("aes-256-gcm", chave, bruto.subarray(0, 12));
  decifrador.setAAD(Buffer.from(contexto, "utf8"));
  decifrador.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([decifrador.update(bruto.subarray(28)), decifrador.final()]).toString("utf8");
}

export const CONTEXTO_SENHA_DO_APARELHO = "os.senha";
export const CONTEXTO_DESENHO_DO_APARELHO = "os.senhaDesenho";
