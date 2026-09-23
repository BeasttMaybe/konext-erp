// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { EtapaPagamentoPdv } from "./etapa-pagamento-pdv";
import { usePagamentoPdv } from "@/lib/pdv/hooks/usar-pagamento-pdv";
import { obterDefaultsConfiguracaoPdv } from "@/lib/configuracoes-pdv";

/**
 * Regressão achada rodando o fluxo ao vivo (Playwright real) do fix de
 * troca de forma de pagamento: o handler de Esc só fechava o editor
 * inline quando o foco do teclado estava DENTRO do painel do editor. Um
 * clique redundante em "Editar" (linha já aberta) deixa o foco no próprio
 * botão — que fica FORA do painel — e a partir daí Esc não fazia mais
 * nada. Corrigido subindo o listener pro card inteiro da linha.
 */

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

afterEach(() => {
  cleanup();
});

function Wrapper() {
  const pagamento = usePagamentoPdv({
    total: 100,
    configuracaoPagamento: obterDefaultsConfiguracaoPdv(),
    temClienteSelecionado: true,
    tentativaVendaId: 1,
    aoConfirmar: vi.fn().mockResolvedValue({ sucesso: true }),
    aoPrecisarDeCliente: vi.fn(),
  });

  return <EtapaPagamentoPdv pagamento={pagamento} />;
}

describe("EtapaPagamentoPdv — Esc fecha o editor de qualquer ponto do card", () => {
  it("Esc fecha o editor mesmo com o evento disparado a partir do botao Editar (fora do painel)", () => {
    render(<Wrapper />);

    // Abre o editor da linha unica (Dinheiro, cobrindo o total).
    const botaoEditar = screen.getByRole("button", { name: "Editar" });
    fireEvent.click(botaoEditar);

    expect(screen.getByText(/Ajustar Dinheiro/i)).toBeInTheDocument();

    // Clique redundante no MESMO "Editar" (linha já aberta) — no navegador
    // real isso deixa o foco no botão, fora do painel do editor. Aqui
    // simulamos o efeito que importa: o evento de teclado nasce no botão
    // "Editar" (elemento fora da div do painel), não em algo dentro dele.
    fireEvent.click(botaoEditar);
    fireEvent.keyDown(botaoEditar, { key: "Escape" });

    expect(screen.queryByText(/Ajustar Dinheiro/i)).not.toBeInTheDocument();
  });
});
