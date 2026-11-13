import { describe, expect, it } from "vitest";

import { nomeNoBanco, sugerirSlug, validarLojaNova } from "./regras-loja-nova";

const base = { nomeDaLoja: "Assistência do João", slug: "assistencia-do-joao", donoNome: "João Silva", donoEmail: "joao@loja.com" };

describe("loja nova", () => {
  it("sugere identificador sem acento e sem simbolos", () => {
    expect(sugerirSlug("Assistência do João  — Centro!")).toBe("assistencia-do-joao-centro");
  });
  it("valida os campos", () => {
    expect(validarLojaNova(base)).toBeNull();
    expect(validarLojaNova({ ...base, slug: "Com Espaco" })).not.toBeNull();
    expect(validarLojaNova({ ...base, slug: "ab" })).not.toBeNull();
    expect(validarLojaNova({ ...base, slug: "master" })).not.toBeNull();
    expect(validarLojaNova({ ...base, donoEmail: "x@" })).not.toBeNull();
    expect(validarLojaNova({ ...base, nomeDaLoja: "a" })).not.toBeNull();
  });
  it("nome no banco valido para o Postgres", () => {
    expect(nomeNoBanco("assistencia-do-joao")).toBe("loja_assistencia_do_joao");
    expect(nomeNoBanco("x".repeat(40)).length).toBeLessThanOrEqual(63);
  });
});
