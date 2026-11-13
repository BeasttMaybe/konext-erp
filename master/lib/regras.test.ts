import { describe, expect, it } from "vitest";

import { chaveDoLimite, codigoConfere, estaBloqueado, gerarToken, validarSenhaNova } from "./regras";

describe("regras do master", () => {
  it("codigo de criacao: precisa existir, ter 12+ caracteres e conferir", () => {
    expect(codigoConfere("abc", undefined)).toBe(false);
    expect(codigoConfere("curto", "curto")).toBe(false);
    expect(codigoConfere("codigo-bem-longo-1", "codigo-bem-longo-1")).toBe(true);
    expect(codigoConfere("codigo-bem-longo-2", "codigo-bem-longo-1")).toBe(false);
  });

  it("senha do master: 12+ com letras e numeros", () => {
    expect(validarSenhaNova("curta1")).not.toBeNull();
    expect(validarSenhaNova("somenteletrasaqui")).not.toBeNull();
    expect(validarSenhaNova("senhaboa123456")).toBeNull();
  });

  it("limite: 5 erros em 15 min travam", () => {
    const agora = new Date("2026-11-13T12:00:00Z");
    const m = (n: number) => new Date(agora.getTime() - n * 60000);
    expect(estaBloqueado([1, 2, 3, 4].map(m), agora)).toBe(false);
    expect(estaBloqueado([1, 2, 3, 4, 5].map(m), agora)).toBe(true);
    expect(estaBloqueado([1, 2, 3, 4, 20].map(m), agora)).toBe(false);
  });

  it("chave do limite separada do ERP e token aleatorio", () => {
    expect(chaveDoLimite(" A@B.com ")).toBe(chaveDoLimite("a@b.com"));
    expect(gerarToken()).not.toBe(gerarToken());
  });
});
