// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ListaItensCarrinho } from "./lista-itens-carrinho";
import type { ItemCarrinho } from "@/store/useCartStore";

afterEach(() => {
  cleanup();
});

function criarItem(sobrescreve: Partial<ItemCarrinho> = {}): ItemCarrinho {
  return {
    id: "produto-1",
    nome: "CABO USB KAIDI 2M IOS",
    preco: 34.9,
    quantidade: 1,
    subtotal: 34.9,
    ...sobrescreve,
  };
}

describe("ListaItensCarrinho", () => {
  it("carrinho vazio mostra o estado vazio, nao uma linha", () => {
    render(<ListaItensCarrinho itens={[]} onDiminuir={vi.fn()} onAumentar={vi.fn()} onRemover={vi.fn()} />);

    expect(screen.getByText("Carrinho vazio")).toBeInTheDocument();
    expect(screen.getByText("Passe o leitor ou clique em um produto.")).toBeInTheDocument();
  });

  it("adicionar um item renderiza uma linha visivel no carrinho (regressao: painel colapsava a lista pra 0px)", () => {
    render(
      <ListaItensCarrinho itens={[criarItem()]} onDiminuir={vi.fn()} onAumentar={vi.fn()} onRemover={vi.fn()} />
    );

    expect(screen.queryByText("Carrinho vazio")).not.toBeInTheDocument();
    expect(screen.getByText("CABO USB KAIDI 2M IOS")).toBeVisible();
    expect(screen.getByText("R$ 34,90")).toBeVisible();
  });

  it("varios itens (cenario que expos o bug real: 4 produtos) renderizam uma linha por item", () => {
    const itens = [
      criarItem({ id: "p1", nome: "ADAPTADOR TIPO C PARA P2" }),
      criarItem({ id: "p2", nome: "CABO USB KAIDI 2M IOS" }),
      criarItem({ id: "p3", nome: "CABO USB KAIDI 2M V8" }),
      criarItem({ id: "p4", nome: "CABO USB KAIDI IOS" }),
    ];

    render(<ListaItensCarrinho itens={itens} onDiminuir={vi.fn()} onAumentar={vi.fn()} onRemover={vi.fn()} />);

    for (const item of itens) {
      expect(screen.getByText(item.nome)).toBeVisible();
    }
  });

  it("aciona onAumentar/onDiminuir/onRemover com o item certo", () => {
    const aoAumentar = vi.fn();
    const aoDiminuir = vi.fn();
    const aoRemover = vi.fn();
    const item = criarItem();

    render(<ListaItensCarrinho itens={[item]} onDiminuir={aoDiminuir} onAumentar={aoAumentar} onRemover={aoRemover} />);

    fireEvent.click(screen.getByLabelText("Aumentar quantidade"));
    fireEvent.click(screen.getByLabelText("Diminuir quantidade"));
    fireEvent.click(screen.getByLabelText("Remover item"));

    expect(aoAumentar).toHaveBeenCalledWith(item);
    expect(aoDiminuir).toHaveBeenCalledWith(item);
    expect(aoRemover).toHaveBeenCalledWith(item);
  });
});
