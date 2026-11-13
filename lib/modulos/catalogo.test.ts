import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CATALOGO_PERMISSOES } from "@/lib/auth/permissoes";
import { ITENS_NAVEGACAO, itensDaNavegacao } from "@/lib/navegacao/itens-navegacao";
import {
  filtrarPermissoesPorModulo,
  IDS_DE_MODULO,
  moduloDaPermissao,
  moduloDaRota,
  MODULOS,
  resolverModulosAtivos,
} from "./catalogo";

const raiz = path.resolve(__dirname, "../..");

describe("catalogo de modulos", () => {
  it("sem nada gravado, tudo ligado", () => {
    expect([...resolverModulosAtivos([])].sort()).toEqual([...IDS_DE_MODULO].sort());
  });

  it("desliga o gravado e, em cascata, quem depende dele", () => {
    const ativos = resolverModulosAtivos([{ modulo: "estoque", ativo: false }]);
    expect(ativos.has("estoque")).toBe(false);
    expect(ativos.has("pdv")).toBe(false);
    expect(ativos.has("vendas")).toBe(false);
    expect(ativos.has("os")).toBe(true);
    expect(resolverModulosAtivos([{ modulo: "financeiro", ativo: false }]).has("fiscal")).toBe(false);
  });

  it("ignora modulo desconhecido e linha ligada", () => {
    expect(resolverModulosAtivos([{ modulo: "xyz", ativo: false }, { modulo: "os", ativo: true }]).size).toBe(IDS_DE_MODULO.length);
  });

  it("rota: prefixo mais longo vence; nucleo e null", () => {
    expect(moduloDaRota("/os/abc")).toBe("os");
    expect(moduloDaRota("/financeiro/notas-fiscais")).toBe("fiscal");
    expect(moduloDaRota("/financeiro/pagar")).toBe("financeiro");
    expect(moduloDaRota("/crm/propostas/nova")).toBe("propostas");
    expect(moduloDaRota("/crm")).toBeNull();
    expect(moduloDaRota("/osx")).toBeNull();
    expect(moduloDaRota("/")).toBeNull();
  });

  it("toda permissao do sistema e do nucleo ou de um modulo conhecido", () => {
    const nucleo = CATALOGO_PERMISSOES.filter((p) => moduloDaPermissao(p) === null);
    expect(nucleo.every((p) => /^(crm|configuracoes|auditoria)\./.test(p))).toBe(true);
    expect(moduloDaPermissao("dashboard.financeiro")).toBe("financeiro");
    expect(moduloDaPermissao("caixa.abrir")).toBe("pdv");
  });

  it("filtra permissoes de modulo desligado", () => {
    const ativos = resolverModulosAtivos([{ modulo: "os", ativo: false }]);
    const filtradas = filtrarPermissoesPorModulo(["os.ver", "crm.ver", "pdv.vender"], ativos);
    expect([...filtradas].sort()).toEqual(["crm.ver", "pdv.vender"]);
  });

  it("toda rota de modulo existe no app", () => {
    for (const modulo of MODULOS) {
      for (const rota of modulo.rotas) {
        const existe = ["(dashboard)", "(printer)"].some((g) => existsSync(path.join(raiz, "app", g, rota.slice(1))));
        expect(existe, `${modulo.id} ${rota}`).toBe(true);
      }
    }
  });

  it("todo item do menu fora do nucleo pertence a um modulo", () => {
    const nucleo = new Set(["/", "/crm", "/ajuda"]);
    for (const item of ITENS_NAVEGACAO) {
      if (nucleo.has(item.path)) continue;
      expect(moduloDaRota(item.path), item.path).not.toBeNull();
    }
  });

  it("menu sem os modulos desligados, inclusive submenus", () => {
    const menu = itensDaNavegacao(resolverModulosAtivos([{ modulo: "estoque", ativo: false }, { modulo: "propostas", ativo: false }]));
    const caminhos = menu.map((i) => i.path);
    expect(caminhos).not.toContain("/estoque");
    expect(caminhos).not.toContain("/pdv");
    expect(caminhos).toContain("/crm");
    expect(menu.find((i) => i.path === "/crm")?.filhos?.map((f) => f.path)).toEqual(["/crm"]);
    expect(itensDaNavegacao(resolverModulosAtivos([])).length).toBe(ITENS_NAVEGACAO.length);
  });
});
