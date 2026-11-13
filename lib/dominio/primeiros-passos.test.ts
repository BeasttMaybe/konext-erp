import { describe, expect, it } from "vitest";

import { IDS_DE_MODULO } from "@/lib/modulos/catalogo";
import { dadosDaEmpresaCompletos, montarPrimeirosPassos, type FatosDaLoja } from "./primeiros-passos";

const nada: FatosDaLoja = {
  dadosDaEmpresa: false,
  logo: false,
  usuariosAtivos: 1,
  minhaAssinatura: false,
  clientes: 0,
  produtos: 0,
  ordensDeServico: 0,
};
const todos = new Set(IDS_DE_MODULO);

describe("primeiros passos", () => {
  it("loja nova: tudo por fazer", () => {
    const passos = montarPrimeirosPassos(nada, todos);
    expect(passos.map((p) => p.id)).toEqual(["empresa", "logo", "equipe", "assinatura", "cliente", "produto", "os"]);
    expect(passos.every((p) => !p.feito)).toBe(true);
  });

  it("equipe so conta com mais alguem alem do dono", () => {
    expect(montarPrimeirosPassos({ ...nada, usuariosAtivos: 2 }, todos).find((p) => p.id === "equipe")?.feito).toBe(true);
  });

  it("sem os modulos, os passos deles somem", () => {
    const ids = montarPrimeirosPassos(nada, new Set(["financeiro"] as const)).map((p) => p.id);
    expect(ids).not.toContain("produto");
    expect(ids).not.toContain("os");
  });

  it("dados da empresa exigem os quatro campos", () => {
    expect(dadosDaEmpresaCompletos({ razaoSocial: "A", cnpj: "1", telefone: "2", endereco: "3" })).toBe(true);
    expect(dadosDaEmpresaCompletos({ razaoSocial: "A", cnpj: " ", telefone: "2", endereco: "3" })).toBe(false);
  });
});
