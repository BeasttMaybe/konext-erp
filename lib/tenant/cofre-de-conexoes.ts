import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cofre das conexoes das lojas criadas pelo master.
 *
 * As lojas antigas tem o endereco do banco numa variavel da Vercel
 * (connectionRef = TENANT_X_DATABASE_URL). As criadas pelo master tem
 * connectionRef = "COFRE": o endereco fica CIFRADO na tabela ConexaoTenant do
 * banco central, com a chave CHAVE_DAS_CONEXOES — variavel de ambiente que
 * existe no ERP, no master e no GitHub (banco.yml), nunca no banco. Quem
 * obtiver uma copia do banco central nao leva junto o acesso as lojas.
 *
 * SEM IMPORTS alem do node:crypto: o master (pasta master/) e os scripts .mjs
 * leem este mesmo arquivo.
 *
 * Chave: SHA-256 do texto da variavel (uma frase longa, 32+ caracteres) —
 * assim o dono escolhe a frase, sem precisar gerar bytes.
 */

export const REF_DO_COFRE = "COFRE";
const PREFIXO = "v1:";
export const TAMANHO_MINIMO_DA_FRASE = 32;

export function chaveDoCofre(frase: string | undefined): Buffer {
  const texto = (frase ?? "").trim();
  if (texto.length < TAMANHO_MINIMO_DA_FRASE) {
    throw new Error(`CHAVE_DAS_CONEXOES ausente ou curta (minimo ${TAMANHO_MINIMO_DA_FRASE} caracteres).`);
  }
  return createHash("sha256").update(texto, "utf8").digest();
}

/** O contexto amarra o valor ao tenant: a conexao de uma loja copiada para outra nao abre. */
function contexto(tenantId: string): Buffer {
  return Buffer.from(`tenant.conexao:${tenantId}`, "utf8");
}

export function guardarConexao(conexao: string, tenantId: string, chave: Buffer): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", chave, iv);
  cifrador.setAAD(contexto(tenantId));
  const corpo = Buffer.concat([cifrador.update(conexao, "utf8"), cifrador.final()]);
  return PREFIXO + Buffer.concat([iv, cifrador.getAuthTag(), corpo]).toString("base64url");
}

export function abrirConexao(guardada: string, tenantId: string, chave: Buffer): string {
  if (!guardada.startsWith(PREFIXO)) throw new Error("Conexao guardada em formato desconhecido.");
  const bruto = Buffer.from(guardada.slice(PREFIXO.length), "base64url");
  const decifrador = createDecipheriv("aes-256-gcm", chave, bruto.subarray(0, 12));
  decifrador.setAAD(contexto(tenantId));
  decifrador.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([decifrador.update(bruto.subarray(28)), decifrador.final()]).toString("utf8");
}
