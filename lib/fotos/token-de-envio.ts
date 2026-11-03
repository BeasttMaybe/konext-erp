import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Sorteio e verificação do segredo do link de envio de foto.
 *
 * Separado do domínio porque usa `node:crypto` e porque o segredo em texto
 * puro só pode existir no servidor, por alguns milissegundos, no caminho
 * entre o sorteio e a montagem do link.
 */

/**
 * 32 bytes, ou 256 bits.
 *
 * Não é exagero por simetria com outras chaves: é o tamanho em que adivinhar
 * deixa de ser uma estratégia. Com 256 bits não existe tentativa suficiente,
 * e por isso o link não precisa de limite de tentativa, de captcha, nem de
 * bloqueio por IP — coisas que uma rota pública sem sessão não tem onde
 * guardar direito.
 */
const BYTES_DO_SEGREDO = 32;

/** Gera o segredo (que vai pro link) e o hash (que vai pro banco). */
export function sortearSegredoDoLink(): { segredo: string; tokenHash: string } {
  const segredo = randomBytes(BYTES_DO_SEGREDO).toString("base64url");

  return { segredo, tokenHash: hashDoSegredo(segredo) };
}

/**
 * SHA-256 em hexadecimal.
 *
 * SHA-256 simples, e não bcrypt/argon2 como numa senha, porque a ameaça é
 * outra. Senha é curta, escolhida por gente e repetida em outros sites —
 * precisa ser cara de testar. Este segredo tem 256 bits sorteados: não há
 * dicionário, não há reuso, e tabela arco-íris sobre 2^256 valores não
 * existe. O que o hash resolve aqui é só isto: quem lê o banco não sai de lá
 * com link nenhum funcionando.
 *
 * A comparação acontece por BUSCA NO ÍNDICE, nunca por `===` entre strings
 * no JavaScript — é o banco que procura o hash, e isso também tira do
 * caminho qualquer leitura de tempo de resposta caractere a caractere.
 */
export function hashDoSegredo(segredo: string): string {
  return createHash("sha256").update(segredo, "utf8").digest("hex");
}
