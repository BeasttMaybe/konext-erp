// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * A barra lateral tem que RENDERIZAR os filhos que ela calcula.
 *
 * Este teste existe por causa de um sumiço: durante meses a barra chamava
 * `filhosVisiveis` e jogava o resultado fora. O menu mostrava oito itens e
 * nenhum submenu, e todo o segundo nível do sistema — Propostas, Histórico
 * de Vendas, Contas a Receber, Contas a Pagar, Fluxo, Notas Fiscais —
 * existia, funcionava, e não tinha link em lugar nenhum. Quem não soubesse
 * a URL de cor simplesmente não chegava.
 *
 * O jeito de uma tela sumir não é alguém apagar o arquivo. É a porta dela
 * deixar de ser desenhada, e nada quebrar.
 */

const parametrosVazios = new URLSearchParams();
let caminhoAtual = "/crm";

vi.mock("next/navigation", () => ({
  usePathname: () => caminhoAtual,
  useSearchParams: () => parametrosVazios,
}));

vi.mock("@/contextos/contexto-permissoes", () => ({
  usePermissoes: () => ({ permissoes: new Set(["financeiro.ver", "dashboard.financeiro", "estoque.editar"]) }),
}));

vi.mock("@/app/actions/auth", () => ({ logout: vi.fn() }));

vi.mock("@/app/actions/configuracoes", () => ({
  obterDadosPerfilConfiguracao: () => Promise.resolve({ configuracao: { logoUrl: null } }),
}));

vi.mock("./status-caixa", () => ({ StatusCaixa: () => null }));

const { BarraLateral } = await import("./barra-lateral");

afterEach(() => {
  cleanup();
});

function abrirEm(caminho: string) {
  caminhoAtual = caminho;
  render(<BarraLateral />);
}

describe("BarraLateral — os filhos da seção aberta aparecem", () => {
  it("em /crm, Propostas tem link", () => {
    // O caso que deu origem ao teste: o dono abriu o sistema e disse "o
    // propostas sumiram".
    abrirEm("/crm");

    const propostas = screen.getByRole("link", { name: "Propostas" });
    expect(propostas).toHaveAttribute("href", "/crm/propostas");
  });

  it("Vendas leva direto à lista, sem submenu", () => {
    // A lista de vendas era /vendas/historico e só se chegava nela
    // terminando o formulário de pedido novo. Hoje ela É /vendas, e a seção
    // não tem mais sub-itens: um submenu de um item só repete o pai.
    abrirEm("/vendas");

    expect(screen.getByRole("link", { name: "Vendas" })).toHaveAttribute("href", "/vendas");
    expect(screen.queryByRole("link", { name: "Hub Central" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Histórico" })).not.toBeInTheDocument();
  });

  it("em /financeiro, as quatro telas de dentro têm link", () => {
    abrirEm("/financeiro");

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

    expect(screen.getByRole("link", { name: "Entrada de nota" })).toHaveAttribute(
      "href",
      "/estoque/notas/nova"
    );
  });

  it("uma página de dentro mantém a seção aberta", () => {
    // Estar em /crm/propostas não pode fechar o submenu que levou até lá.
    abrirEm("/crm/propostas");

    expect(screen.getByRole("link", { name: "Propostas" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Clientes" })).toBeInTheDocument();
  });
});

describe("BarraLateral — o que ela NÃO faz", () => {
  it("só a seção aberta mostra os filhos", () => {
    // Todas abertas dariam vinte linhas numa barra de oito: o menu deixaria
    // de ser um mapa e viraria uma lista pra ler.
    abrirEm("/crm");

    expect(screen.getByRole("link", { name: "Propostas" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contas a Receber" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Histórico" })).not.toBeInTheDocument();
  });

  it("toda seção do menu continua alcançável", () => {
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
      expect(screen.getByRole("link", { name: rotulo }), rotulo).toBeInTheDocument();
    }
  });
});
