import { describe, expect, it } from "vitest";

import {
  decidirNovaSenhaPeloAdmin,
  enderecoDoSistema,
  gerarTokenDeRecuperacao,
  hashDoToken,
  situacaoDoToken,
  tokenTemFormatoValido,
} from "./recuperacao-de-senha";

describe("token", () => {
  it("aleatorio, no formato esperado, e o hash nao contem o token", () => {
    const a = gerarTokenDeRecuperacao();
    const b = gerarTokenDeRecuperacao();
    expect(a).not.toBe(b);
    expect(tokenTemFormatoValido(a)).toBe(true);
    expect(hashDoToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoToken(a)).not.toContain(a);
    expect(tokenTemFormatoValido("curto")).toBe(false);
    expect(tokenTemFormatoValido("x".repeat(42) + "!")).toBe(false);
  });

  it("situacao", () => {
    const agora = new Date("2026-11-13T12:00:00Z");
    expect(situacaoDoToken(null, agora)).toBe("inexistente");
    expect(situacaoDoToken({ expiraEm: new Date("2026-11-13T12:10:00Z"), usadoEm: null }, agora)).toBe("valido");
    expect(situacaoDoToken({ expiraEm: new Date("2026-11-13T12:00:00Z"), usadoEm: null }, agora)).toBe("expirado");
    expect(situacaoDoToken({ expiraEm: new Date("2026-11-13T12:10:00Z"), usadoEm: agora }, agora)).toBe("usado");
  });
});

describe("enderecoDoSistema", () => {
  it("URL configurada manda, sem barra no fim", () => {
    expect(enderecoDoSistema({ URL_DO_SISTEMA: "https://erp.konext.com.br/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }, "evil.com")).toBe(
      "https://erp.konext.com.br"
    );
  });
  it("na Vercel, o dominio de producao — nunca o Host", () => {
    expect(enderecoDoSistema({ VERCEL_PROJECT_PRODUCTION_URL: "konext.vercel.app" }, "evil.com")).toBe("https://konext.vercel.app");
  });
  it("Host so vale para localhost", () => {
    expect(enderecoDoSistema({}, "localhost:3100")).toBe("http://localhost:3100");
    expect(enderecoDoSistema({}, "evil.com")).toBeNull();
  });
});

describe("decidirNovaSenhaPeloAdmin", () => {
  const base = { ehVoceMesmo: false, ehResponsavelPelaLoja: false, ativo: true, usadoEmOutraLoja: false };
  it("permite o caso comum", () => {
    expect(decidirNovaSenhaPeloAdmin(base)).toEqual({ permitido: true });
  });
  it("recusa a si mesmo, o responsavel, desativado e conta de outra loja", () => {
    expect(decidirNovaSenhaPeloAdmin({ ...base, ehVoceMesmo: true }).permitido).toBe(false);
    expect(decidirNovaSenhaPeloAdmin({ ...base, ehResponsavelPelaLoja: true }).permitido).toBe(false);
    expect(decidirNovaSenhaPeloAdmin({ ...base, ativo: false }).permitido).toBe(false);
    expect(decidirNovaSenhaPeloAdmin({ ...base, usadoEmOutraLoja: true }).permitido).toBe(false);
  });
});
