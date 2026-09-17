import { describe, expect, it } from "vitest";

import { PAPEIS_EMPRESA, permissoesDoPapel, type PapelEmpresa } from "@/lib/auth/permissoes";
import { selecionarSecoesDashboardHome } from "./selecao-secoes-home";

function selecionarParaPapel(papel: PapelEmpresa) {
  const permissoes = permissoesDoPapel(papel);
  return selecionarSecoesDashboardHome({
    temDashboardFinanceiro: permissoes.has("dashboard.financeiro"),
    temMetasVer: permissoes.has("metas.ver"),
  });
}

describe("selecionarSecoesDashboardHome", () => {
  it("a secao operacional e sempre true, para as tres combinacoes de entrada possiveis", () => {
    expect(selecionarSecoesDashboardHome({ temDashboardFinanceiro: true, temMetasVer: true }).operacional).toBe(
      true
    );
    expect(selecionarSecoesDashboardHome({ temDashboardFinanceiro: false, temMetasVer: false }).operacional).toBe(
      true
    );
    expect(selecionarSecoesDashboardHome({ temDashboardFinanceiro: true, temMetasVer: false }).operacional).toBe(
      true
    );
  });

  it("financeiro e metas seguem exatamente a permissao correspondente, independentes uma da outra", () => {
    expect(selecionarSecoesDashboardHome({ temDashboardFinanceiro: true, temMetasVer: true })).toEqual({
      financeiro: true,
      operacional: true,
      metas: true,
    });
    expect(selecionarSecoesDashboardHome({ temDashboardFinanceiro: true, temMetasVer: false })).toEqual({
      financeiro: true,
      operacional: true,
      metas: false,
    });
    expect(selecionarSecoesDashboardHome({ temDashboardFinanceiro: false, temMetasVer: true })).toEqual({
      financeiro: false,
      operacional: true,
      metas: true,
    });
    expect(selecionarSecoesDashboardHome({ temDashboardFinanceiro: false, temMetasVer: false })).toEqual({
      financeiro: false,
      operacional: true,
      metas: false,
    });
  });

  describe("integrado com a matriz de papeis real (home nunca bloqueia por completo)", () => {
    it("ADMIN ve financeiro, operacional e metas", () => {
      expect(selecionarParaPapel("ADMIN")).toEqual({ financeiro: true, operacional: true, metas: true });
    });

    it("GESTOR ve financeiro, operacional e metas", () => {
      expect(selecionarParaPapel("GESTOR")).toEqual({ financeiro: true, operacional: true, metas: true });
    });

    it("USUARIO nao ve financeiro, mas ve operacional e metas", () => {
      expect(selecionarParaPapel("USUARIO")).toEqual({ financeiro: false, operacional: true, metas: true });
    });

    it("nenhum papel do catalogo fica sem a secao operacional", () => {
      for (const papel of PAPEIS_EMPRESA) {
        expect(selecionarParaPapel(papel).operacional).toBe(true);
      }
    });
  });
});
