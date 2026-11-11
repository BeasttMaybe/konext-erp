import { describe, expect, it } from "vitest";

import { lerEstadoDoSistema } from "./estado";

describe("lerEstadoDoSistema", () => {
  it("na Vercel, mostra os sete primeiros caracteres do commit — o mesmo formato do `git log --oneline`", () => {
    const estado = lerEstadoDoSistema({
      VERCEL_GIT_COMMIT_SHA: "7542ffd0123456789abcdef0123456789abcdef0",
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "main",
      CRON_SECRET: "x",
    });

    expect(estado).toEqual({
      versao: "7542ffd",
      ambiente: "production",
      ramo: "main",
      rotinasProtegidas: true,
    });
  });

  it("fora da Vercel nao inventa versao: diz que nao sabe", () => {
    const estado = lerEstadoDoSistema({ NODE_ENV: "development" });

    expect(estado.versao).toBeNull();
    expect(estado.ramo).toBeNull();
    expect(estado.ambiente).toBe("development");
  });

  it("variavel vazia conta como ausente", () => {
    const estado = lerEstadoDoSistema({ VERCEL_GIT_COMMIT_SHA: "  ", CRON_SECRET: "" });

    expect(estado.versao).toBeNull();
    expect(estado.rotinasProtegidas).toBe(false);
  });

  it("nunca devolve o segredo, so se ele existe", () => {
    const estado = lerEstadoDoSistema({ CRON_SECRET: "valor-que-nao-pode-vazar" });

    expect(JSON.stringify(estado)).not.toContain("valor-que-nao-pode-vazar");
    expect(estado.rotinasProtegidas).toBe(true);
  });
});
