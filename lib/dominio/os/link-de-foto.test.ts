import { describe, expect, it } from "vitest";

import {
  lerLinkDaUrl,
  montarCaminhoDoLink,
  montarUrlDoLink,
} from "./link-de-foto";

/**
 * `lerLinkDaUrl` é o primeiro filtro de uma rota PÚBLICA.
 *
 * Qualquer pessoa da internet pode chamar `/foto/<qualquer coisa>/<qualquer
 * coisa>`. O que passar daqui vira consulta no banco central e depois no
 * banco de uma loja — então o que não tem forma de slug e de segredo não
 * pode chegar lá. Não é validação de formulário: é o que separa uma URL
 * inventada de um gerador de consultas contra a base de todas as lojas.
 */

const SEGREDO_VALIDO = "aGq7_zXp2Nn-4kR8sT1vW0yB3cD5eF6gH7iJ8kL9mN0";

describe("os/link-de-foto — montar o endereço", () => {
  it("monta o caminho e a URL absoluta", () => {
    expect(montarCaminhoDoLink("konext", SEGREDO_VALIDO)).toBe(`/foto/konext/${SEGREDO_VALIDO}`);
    expect(montarUrlDoLink("https://konext.app", "konext", SEGREDO_VALIDO)).toBe(
      `https://konext.app/foto/konext/${SEGREDO_VALIDO}`
    );
  });

  it("não duplica a barra quando a base já termina com uma", () => {
    // A base vem do cabeçalho da requisição e pode chegar das duas formas.
    // "https://x.app//foto/..." funcionaria no navegador, mas apareceria
    // torto no QR code e no endereço que a pessoa copia.
    expect(montarUrlDoLink("https://konext.app/", "loja", SEGREDO_VALIDO)).toBe(
      `https://konext.app/foto/loja/${SEGREDO_VALIDO}`
    );
  });
});

describe("os/link-de-foto — o que nunca vira consulta", () => {
  it("aceita um slug e um segredo bem formados", () => {
    expect(lerLinkDaUrl("konext-tech", SEGREDO_VALIDO)).toEqual({
      slug: "konext-tech",
      segredo: SEGREDO_VALIDO,
    });
  });

  it("recusa slug com caractere fora do formato do cadastro", () => {
    // O slug entra numa busca no banco central. Aceitar barra, ponto ou
    // espaço aqui é aceitar que a forma do identificador seja decidida por
    // quem monta a URL.
    for (const slug of ["Konext", "kon ext", "kon/ext", "kon.ext", "-konext", "", "kon_ext"]) {
      expect(lerLinkDaUrl(slug, SEGREDO_VALIDO), slug).toBeNull();
    }
  });

  it("recusa segredo fora do alfabeto base64url", () => {
    // `+`, `/` e `=` seriam reescritos no caminho da URL e o segredo chegaria
    // diferente do que saiu — falharia sempre, e de um jeito difícil de ver.
    for (const segredo of ["abc+def/ghi=", "tem espaço aqui", "../../etc/passwd", "%2e%2e"]) {
      expect(lerLinkDaUrl("konext", segredo), segredo).toBeNull();
    }
  });

  it("recusa segredo curto demais pra ter sido sorteado", () => {
    expect(lerLinkDaUrl("konext", "abc")).toBeNull();
    expect(lerLinkDaUrl("konext", "")).toBeNull();
  });

  it("recusa segredo absurdamente longo", () => {
    // Sem teto, uma URL de megabytes viraria um hash calculado por
    // requisição — trabalho de graça oferecido a quem chamar.
    expect(lerLinkDaUrl("konext", "a".repeat(5000))).toBeNull();
  });

  it("recusa o que nem texto é", () => {
    // Em rota dinâmica do Next, o parâmetro pode chegar como array quando a
    // URL repete o segmento.
    expect(lerLinkDaUrl(["konext"], SEGREDO_VALIDO)).toBeNull();
    expect(lerLinkDaUrl("konext", null)).toBeNull();
    expect(lerLinkDaUrl(undefined, undefined)).toBeNull();
    expect(lerLinkDaUrl(42, SEGREDO_VALIDO)).toBeNull();
  });
});
