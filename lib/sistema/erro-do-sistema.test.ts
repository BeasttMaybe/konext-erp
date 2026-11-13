import { describe, expect, it } from "vitest";

import {
  deveAvisar,
  ehControleDeFluxo,
  origemDoErro,
  resumirMensagem,
  textoDoAviso,
  valorDoCookie,
} from "./erro-do-sistema";

describe("erros do sistema", () => {
  it("ignora redirect/notFound do Next", () => {
    expect(ehControleDeFluxo(Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;replace;/login;307;" }))).toBe(true);
    expect(ehControleDeFluxo(new Error("NEXT_NOT_FOUND"))).toBe(true);
    expect(ehControleDeFluxo(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("resume e mascara dado pessoal", () => {
    const m = resumirMensagem(new TypeError("falhou para joao@loja.com cpf 12345678901 em postgresql://u:senha@host/db"));
    expect(m).toContain("TypeError");
    expect(m).not.toContain("joao@loja.com");
    expect(m).not.toContain("12345678901");
    expect(m).not.toContain("senha@host");
    expect(resumirMensagem(new Error("x".repeat(900))).length).toBeLessThanOrEqual(500);
  });

  it("origem pelo arquivo da rota, sem ids", () => {
    expect(origemDoErro({ routeType: "render", routePath: "/os/[id]" })).toBe("tela /os/[id]");
    expect(origemDoErro({ routeType: "route", routePath: "/api/x" }, "POST")).toBe("rota /api/x (POST)");
  });

  it("aviso: primeira vez sim; igual em menos de 30 min nao; teto por hora", () => {
    const agora = new Date("2026-11-13T12:00:00Z");
    expect(deveAvisar({ ultimoAvisoDoMesmoErro: null, avisosNaUltimaHora: 0, agora })).toBe(true);
    expect(deveAvisar({ ultimoAvisoDoMesmoErro: new Date("2026-11-13T11:45:00Z"), avisosNaUltimaHora: 1, agora })).toBe(false);
    expect(deveAvisar({ ultimoAvisoDoMesmoErro: new Date("2026-11-13T11:29:00Z"), avisosNaUltimaHora: 1, agora })).toBe(true);
    expect(deveAvisar({ ultimoAvisoDoMesmoErro: null, avisosNaUltimaHora: 10, agora })).toBe(false);
  });

  it("texto do aviso", () => {
    const t = textoDoAviso({ origem: "tela /os", mensagem: "Error: x", loja: "loja-a", ambiente: "preview" });
    expect(t).toContain("(preview)");
    expect(t).toContain("Loja: loja-a");
  });

  it("le o cookie", () => {
    expect(valorDoCookie("a=1; konext_central_session=abc%3D; b=2", "konext_central_session")).toBe("abc=");
    expect(valorDoCookie(undefined, "x")).toBeNull();
  });
});
