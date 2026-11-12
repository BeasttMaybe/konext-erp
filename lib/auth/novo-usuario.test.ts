import { describe, expect, it } from "vitest";

import { decidirNovoUsuario, esquemaNovoUsuario } from "./novo-usuario";

const valido = { nome: "Ana Lima", email: "  Ana@Loja.COM ", cargoId: "c1", senhaInicial: "konext2026" };

describe("esquemaNovoUsuario", () => {
  it("normaliza o e-mail", () => {
    expect(esquemaNovoUsuario.parse(valido).email).toBe("ana@loja.com");
  });

  it("exige senha com 8+ caracteres, letras e numeros", () => {
    expect(esquemaNovoUsuario.safeParse({ ...valido, senhaInicial: "abc123" }).success).toBe(false);
    expect(esquemaNovoUsuario.safeParse({ ...valido, senhaInicial: "somenteletras" }).success).toBe(false);
    const erro = esquemaNovoUsuario.safeParse({ ...valido, senhaInicial: "12345678" });
    expect(erro.success).toBe(false);
    if (!erro.success) expect(erro.error.issues[0]?.message).toMatch(/senha inicial/);
  });

  it("recusa nome curto, e-mail invalido e cargo vazio", () => {
    expect(esquemaNovoUsuario.safeParse({ ...valido, nome: "Al" }).success).toBe(false);
    expect(esquemaNovoUsuario.safeParse({ ...valido, email: "ana" }).success).toBe(false);
    expect(esquemaNovoUsuario.safeParse({ ...valido, cargoId: "" }).success).toBe(false);
  });
});

describe("decidirNovoUsuario", () => {
  it("cria conta quando o e-mail e novo", () => {
    expect(decidirNovoUsuario({ contaExiste: false, vinculoNestaLoja: null })).toEqual({ tipo: "criar-conta" });
  });

  it("so vincula quando a conta ja existe em outra loja", () => {
    expect(decidirNovoUsuario({ contaExiste: true, vinculoNestaLoja: null })).toEqual({
      tipo: "vincular-conta-existente",
    });
  });

  it("recusa quem ja e da loja, e manda reativar quem esta desativado", () => {
    const ativo = decidirNovoUsuario({ contaExiste: true, vinculoNestaLoja: { ativo: true } });
    expect(ativo.tipo).toBe("recusar");
    const inativo = decidirNovoUsuario({ contaExiste: true, vinculoNestaLoja: { ativo: false } });
    expect(inativo.tipo === "recusar" && inativo.motivo).toMatch(/Reative/);
  });
});
