import { describe, expect, it } from "vitest";

import { lerLinkDaUrl } from "@/lib/dominio/os/link-de-foto";

import { hashDoSegredo, sortearSegredoDoLink } from "./token-de-envio";

describe("fotos/token-de-envio", () => {
  it("o segredo sorteado passa no filtro da rota pública", () => {
    // As duas pontas têm que casar: de nada adianta sortear um segredo que o
    // validador da URL recusa. É o tipo de desencontro que só aparece quando
    // alguém tenta usar o link de verdade.
    const { segredo } = sortearSegredoDoLink();

    expect(lerLinkDaUrl("konext", segredo)).toEqual({ slug: "konext", segredo });
  });

  it("o segredo é base64url — nada que a URL reescreva", () => {
    for (let i = 0; i < 200; i += 1) {
      const { segredo } = sortearSegredoDoLink();
      expect(segredo, segredo).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(segredo).toHaveLength(43);
    }
  });

  it("nunca repete", () => {
    // 256 bits sorteados: a repetição aqui significaria gerador quebrado, e
    // dois links idênticos em OS diferentes seria o pior defeito possível.
    const vistos = new Set<string>();

    for (let i = 0; i < 1_000; i += 1) vistos.add(sortearSegredoDoLink().segredo);

    expect(vistos.size).toBe(1_000);
  });

  it("o hash é SHA-256 em hexadecimal e não deixa o segredo aparecer", () => {
    const { segredo, tokenHash } = sortearSegredoDoLink();

    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toContain(segredo);
    // É o que vai pro banco: nada ali pode reconstruir o link.
    expect(tokenHash).not.toBe(segredo);
  });

  it("o mesmo segredo dá sempre o mesmo hash", () => {
    // É assim que a rota pública encontra a linha: calcula e busca no índice.
    const { segredo, tokenHash } = sortearSegredoDoLink();

    expect(hashDoSegredo(segredo)).toBe(tokenHash);
    expect(hashDoSegredo(segredo)).toBe(hashDoSegredo(segredo));
  });

  it("um caractere diferente dá um hash completamente diferente", () => {
    const a = hashDoSegredo("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const b = hashDoSegredo("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab");

    expect(a).not.toBe(b);
    // Nenhum prefixo em comum: não dá pra chegar perto adivinhando.
    expect(a.slice(0, 8)).not.toBe(b.slice(0, 8));
  });
});
