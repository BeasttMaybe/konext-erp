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
 *
 * Desde o reagrupamento (11/2026) o topo tem 7 grupos; os testes refletem a
 * nova árvore (Vendas = PDV + Pedidos; Financeiro inclui Prefeitura; etc.).
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
  it("em /crm, abrir Clientes mostra Propostas com link", () => {
    abrirEm("/crm");
    abrirMenu("Clientes");

    expect(screen.getByRole("link", { name: "Propostas" })).toHaveAttribute("href", "/crm/propostas");
  });

  it("Vendas agrupa PDV e Pedidos de venda", () => {
    abrirEm("/vendas");
    abrirMenu("Vendas");

    expect(screen.getByRole("link", { name: "PDV (balcão)" })).toHaveAttribute("href", "/pdv");
    expect(screen.getByRole("link", { name: "Pedidos de venda" })).toHaveAttribute("href", "/vendas");
  });

  it("Financeiro inclui as telas de dentro e a Prefeitura", () => {
    abrirEm("/financeiro");
    abrirMenu("Financeiro");

    for (const [rotulo, caminho] of [
      ["Contas a Receber", "/financeiro/receber"],
      ["Contas a Pagar", "/financeiro/pagar"],
      ["Fluxo e Relatórios", "/financeiro/fluxo"],
      ["Notas Fiscais", "/financeiro/notas-fiscais"],
      ["Prefeitura — Resultado", "/prefeitura"],
      ["Prefeitura — Caixa", "/prefeitura/caixa"],
    ]) {
      expect(screen.getByRole("link", { name: rotulo }), rotulo).toHaveAttribute("href", caminho);
    }
  });

  it("em /estoque, a entrada de nota tem link", () => {
    abrirEm("/estoque");
    abrirMenu("Estoque");

    expect(screen.getByRole("link", { name: "Entrada de nota" })).toHaveAttribute("href", "/estoque/notas/nova");
  });

  it("'Mais' reúne Agenda, Metas e Ajuda", () => {
    abrirEm("/");
    abrirMenu("Mais");

    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/agenda");
    expect(screen.getByRole("link", { name: "Metas" })).toHaveAttribute("href", "/metas");
    expect(screen.getByRole("link", { name: "Ajuda" })).toHaveAttribute("href", "/ajuda");
  });

  it("uma página de dentro marca o filho como atual", () => {
    abrirEm("/crm/propostas");
    abrirMenu("Clientes");

    expect(screen.getByRole("link", { name: "Propostas" })).toHaveAttribute("aria-current", "page");
  });
});

describe("NavegacaoTopo — o que ela NÃO faz", () => {
  it("não tem botão 'Dashboard' — a inicial é alcançada pela marca", () => {
    abrirEm("/");

    expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("dropdown fechado não deixa os filhos no DOM", () => {
    abrirEm("/crm");

    expect(screen.queryByRole("link", { name: "Propostas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contas a Receber" })).not.toBeInTheDocument();
  });

  it("os 7 grupos continuam alcançáveis (Marketing some sem o módulo)", () => {
    abrirEm("/");

    // "Ordens de Serviço" aparece curto ("Ordens") no topo; os demais iguais.
    for (const rotulo of ["Ordens", "Vendas", "Clientes", "Estoque", "Financeiro", "Mais"]) {
      expect(itemDoTopo(rotulo), rotulo).toBeInTheDocument();
    }
    // Marketing não está nos módulos do mock, então não aparece.
    expect(screen.queryByRole("button", { name: "Marketing" })).not.toBeInTheDocument();
  });
});
