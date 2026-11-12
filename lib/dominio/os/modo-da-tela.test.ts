import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ITENS_NAVEGACAO, indiceFilhoAtivo } from "@/lib/navegacao/itens-navegacao";

import { modoDaTelaPeloParametro, parametroDoModo, type ModoDaTelaOS } from "./modo-da-tela";

describe("modoDaTelaPeloParametro", () => {
  it.each([
    [undefined, "KANBAN"],
    ["", "KANBAN"],
    ["kanban", "KANBAN"],
    ["lista", "LISTA_FINALIZADAS"],
    ["excluidas", "LISTA_FINALIZADAS"],
    ["garantia", "GARANTIA"],
    ["GARANTIA", "GARANTIA"],
    ["qualquer-coisa", "KANBAN"],
  ] as const)("%s -> %s", (parametro, esperado) => {
    expect(modoDaTelaPeloParametro(parametro)).toBe(esperado);
  });

  it("ida e volta: o parametro gravado por uma aba abre a mesma aba", () => {
    for (const modo of ["KANBAN", "LISTA_FINALIZADAS", "GARANTIA"] as ModoDaTelaOS[]) {
      expect(modoDaTelaPeloParametro(parametroDoModo(modo))).toBe(modo);
    }
  });
});

describe("submenu de Ordens de Servico", () => {
  const os = ITENS_NAVEGACAO.find((item) => item.path === "/os");
  const filhos = os?.filhos ?? [];
  const rotulos = filhos.map((filho) => filho.label);

  it("nao tem mais o 'Hub Central', que levava ao mesmo lugar do Kanban", () => {
    expect(rotulos).not.toContain("Hub Central");
    expect(new Set(filhos.map((filho) => filho.path)).size).toBe(filhos.length);
  });

  it.each([
    ["/os", "", "Em andamento"],
    ["/os", "modo=kanban", "Em andamento"],
    ["/os", "modo=lista", "Finalizadas"],
    ["/os", "modo=garantia", "Garantias"],
    ["/os/relatorio-pecas", "", "Relatório de peças"],
  ])("em %s?%s o destaque fica em %s", (pathname, busca, esperado) => {
    const indice = indiceFilhoAtivo(filhos, pathname, new URLSearchParams(busca));
    expect(rotulos[indice]).toBe(esperado);
  });

  it("cada item que muda de aba leva a uma aba diferente da tela", () => {
    const modos = filhos
      .filter((filho) => filho.path.startsWith("/os") && !filho.path.startsWith("/os/"))
      .map((filho) => modoDaTelaPeloParametro(new URLSearchParams(filho.path.split("?")[1] ?? "").get("modo")));

    expect(modos.sort()).toEqual(["GARANTIA", "KANBAN", "LISTA_FINALIZADAS"]);
  });
});

/**
 * GUARDA: a tela nao volta a ler o `?modo=` so na montagem.
 */
describe("DashboardOS segue o endereco", () => {
  const fonte = readFileSync(join(process.cwd(), "components/os/dashboard-os.tsx"), "utf8");

  it("realinha a aba quando o endereco muda", () => {
    expect(fonte).toContain("if (enderecoVisto !== modoDoEndereco) {");
    expect(fonte).toContain("modoDaTelaPeloParametro(searchParams.get(\"modo\"))");
  });

  it("nao guarda a aba num estado iniciado so pela prop", () => {
    expect(fonte).not.toMatch(/useState<[^>]*>\(modoInicial\)/);
  });
});
