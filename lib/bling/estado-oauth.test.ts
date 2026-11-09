import { beforeAll, describe, expect, it } from "vitest";

import { criarEstado, estadoExpirou, lerEstado, MINUTOS_DE_VALIDADE_DO_ESTADO } from "./estado-oauth";

beforeAll(() => {
  process.env.BLING_CLIENT_SECRET = "segredo-de-teste";
});

describe("estado do fluxo OAuth do Bling", () => {
  it("vai e volta carregando a loja certa", () => {
    const { estado } = criarEstado("konext-principal");

    expect(lerEstado(estado)?.slug).toBe("konext-principal");
  });

  it("cada tentativa tem um nonce diferente", () => {
    // Senão o uso único não teria o que conferir.
    expect(criarEstado("loja").nonce).not.toBe(criarEstado("loja").nonce);
  });

  it("o nonce que volta é o mesmo que saiu", () => {
    const { estado, nonce } = criarEstado("loja");

    expect(lerEstado(estado)?.nonce).toBe(nonce);
  });

  it("RECUSA um estado em que a loja foi trocada", () => {
    // É o ataque que a assinatura existe para impedir: mandar o navegador do
    // dono de uma loja para o callback com o slug de outra faria a
    // autorização dele parar no banco errado.
    const { estado } = criarEstado("loja-a");
    const [, nonce, assinatura] = estado.split(".");
    const forjado = `${Buffer.from("loja-b").toString("base64url")}.${nonce}.${assinatura}`;

    expect(lerEstado(forjado)).toBeNull();
  });

  it("recusa assinatura adulterada, nonce trocado e lixo", () => {
    const { estado } = criarEstado("loja");
    const [slug, nonce] = estado.split(".");

    for (const ruim of [
      `${slug}.${nonce}.assinaturaInventada`,
      `${slug}.outroNonce.${estado.split(".")[2]}`,
      "",
      "a.b",
      "a.b.c.d",
      estado.slice(0, -2),
    ]) {
      expect(lerEstado(ruim), JSON.stringify(ruim.slice(0, 30))).toBeNull();
    }
  });

  it("recusa estado assinado com outro segredo", () => {
    const { estado } = criarEstado("loja");

    process.env.BLING_CLIENT_SECRET = "outro-segredo";
    expect(lerEstado(estado)).toBeNull();
    process.env.BLING_CLIENT_SECRET = "segredo-de-teste";
  });

  it("recusa slug que não tem forma de slug, mesmo assinado", () => {
    // A assinatura garante a origem; a forma garante que o valor não vira
    // consulta esquisita no banco central.
    for (const invalido of ["../outro", "LOJA", "loja com espaço", "", "-comeca-com-traco"]) {
      const { estado } = criarEstado(invalido);
      expect(lerEstado(estado), invalido).toBeNull();
    }
  });

  it("slug com hífen e número continua válido", () => {
    for (const bom of ["loja-2", "a", "konext-principal-01"]) {
      expect(lerEstado(criarEstado(bom).estado)?.slug, bom).toBe(bom);
    }
  });
});

describe("validade do estado", () => {
  it("recém-criado não expirou", () => {
    expect(estadoExpirou(new Date())).toBe(false);
  });

  it("expira depois da janela", () => {
    const agora = new Date("2026-11-09T12:00:00Z");
    const velho = new Date(agora.getTime() - (MINUTOS_DE_VALIDADE_DO_ESTADO + 1) * 60_000);

    expect(estadoExpirou(velho, agora)).toBe(true);
  });

  it("dentro da janela ainda vale", () => {
    const agora = new Date("2026-11-09T12:00:00Z");
    const recente = new Date(agora.getTime() - (MINUTOS_DE_VALIDADE_DO_ESTADO - 1) * 60_000);

    expect(estadoExpirou(recente, agora)).toBe(false);
  });
});
