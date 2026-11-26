// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * A navegação do topo tem que RENDERIZAR os filhos que ela calcula — a mesma
 * garantia que a antiga barra lateral tinha (ver histórico de
 * `barra-lateral.test.tsx`): durante meses a barra jogava `filhosVisiveis`
 * fora e todo o segundo nível do sistema (Propostas, Contas a Receber, etc.)
 * ficava sem link. Aqui os filhos vivem num dropdown, então o teste ABRE o
 * menu (clica no gatilho) e confere que os links existem e apontam certo.
 */

const parametrosVazios = new URLSearchParams();
let caminhoAtual = "/crm";

vi.mock("next/navigation", () => ({
  usePathname: () => caminhoAtual,
  useSearchParams: () => parametrosVazios,
}));

vi.mock("@/contextos/contexto-permissoes", () => ({
  usePermissoes: () => ({
    permissoes: new Set(["financeiro.ver", "dashboard.financeiro", "estoque.editar"]),
    modulos: new Set(["os", "estoque", "pdv", "vendas", "propostas", "financeiro", "fiscal", "metas"]),
  }),
}));

const { NavegacaoTopo } = await import("./navegacao-topo");

afterEach(() => {
  cleanup();
});

function abrirEm(caminho: string) {
  caminhoAtual = caminho;
  render(<NavegacaoTopo />);
}

/** Um módulo do topo é um link (sem filhos) ou um botão (com dropdown). */
function itemDoTopo(nome: string): HTMLElement {
  return screen.queryByRole("button", { name: nome }) ?? screen.getByRole("link", { name: nome });
}

/** Abre o dropdown de um módulo e devolve o gatilho. */
function abrirMenu(nome: string): HTMLElement {
  const gatilho = screen.getByRole("button", { name: nome });
  fireEvent.click(gatilho);
  return gatilho;
}

describe("NavegacaoTopo — os filhos do dropdown aparecem", () => {
  it("em /crm, abrir o menu mostra Propostas com link", () => {
    abrirEm("/crm");
    abrirMenu("Clientes (CRM)");

    const propostas = screen.getByRole("link", { name: "Propostas" });
    expect(propostas).toHaveAttribute("href", "/crm/propostas");
  });

  it("Vendas é link direto, sem dropdown", () => {
    abrirEm("/vendas");

    expect(screen.getByRole("link", { name: "Vendas" })).toHaveAttribute("href", "/vendas");
    expect(screen.queryByRole("button", { name: "Vendas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Histórico" })).not.toBeInTheDocument();
  });

  it("em /financeiro, as quatro telas de dentro têm link", () => {
    abrirEm("/financeiro");
    abrirMenu("Financeiro");

    for (const [rotulo, caminho] of [
      ["Contas a Receber", "/financeiro/receber"],
      ["Contas a Pagar", "/financeiro/pagar"],
      ["Fluxo e Relatórios", "/financeiro/fluxo"],
      ["Notas Fiscais", "/financeiro/notas-fiscais"],
    ]) {
      expect(screen.getByRole("link", { name: rotulo }), rotulo).toHaveAttribute("href", caminho);
    }
  });

  it("em /estoque, a entrada de nota tem link", () => {
    abrirEm("/estoque");
    abrirMenu("Estoque");

    expect(screen.getByRole("link", { name: "Entrada de nota" })).toHaveAttribute("href", "/estoque/notas/nova");
  });

  it("uma página de dentro marca o filho como atual", () => {
    abrirEm("/crm/propostas");
    abrirMenu("Clientes (CRM)");

    expect(screen.getByRole("link", { name: "Propostas" })).toHaveAttribute("aria-current", "page");
  });
});

describe("NavegacaoTopo — o que ela NÃO faz", () => {
  it("dropdown fechado não deixa os filhos no DOM", () => {
    abrirEm("/crm");

    // Nada aberto: nenhum filho renderizado.
    expect(screen.queryByRole("link", { name: "Propostas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contas a Receber" })).not.toBeInTheDocument();
  });

  it("toda seção do menu continua alcançável (link ou botão)", () => {
    abrirEm("/");

    for (const rotulo of [
      "Dashboard",
      "Ordens de Serviço",
      "Clientes (CRM)",
      "PDV",
      "Vendas",
      "Estoque",
      "Financeiro",
      "Metas",
    ]) {
      expect(itemDoTopo(rotulo), rotulo).toBeInTheDocument();
    }
  });
});
