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
    render(<ListaItensCarrinho itens={[]} onEditar={vi.fn()} onRemover={vi.fn()} />);

    expect(screen.getByText("Carrinho vazio")).toBeInTheDocument();
  });

  it("adicionar um item renderiza uma linha visivel no carrinho (regressao: painel colapsava a lista pra 0px)", () => {
    render(<ListaItensCarrinho itens={[criarItem()]} onEditar={vi.fn()} onRemover={vi.fn()} />);

    expect(screen.queryByText("Carrinho vazio")).not.toBeInTheDocument();
    expect(screen.getByText("CABO USB KAIDI 2M IOS")).toBeVisible();
    // Fase "modelo Bling": a linha mostra unitário e subtotal em colunas
    // distintas — com 1 unidade os dois valores formatados coincidem, então
    // aparecem DUAS vezes na linha (colunas diferentes), nao uma só.
    const valoresFormatados = screen.getAllByText("R$ 34,90");
    expect(valoresFormatados).toHaveLength(2);
    for (const valor of valoresFormatados) {
      expect(valor).toBeVisible();
    }
  });

  it("mostra o codigo/SKU do produto embaixo do nome quando existe", () => {
    render(
      <ListaItensCarrinho itens={[criarItem({ codigoBarras: "789000111222" })]} onEditar={vi.fn()} onRemover={vi.fn()} />
    );

    expect(screen.getByText("789000111222")).toBeVisible();
  });

  it("varios itens (cenario que expos o bug real: 4 produtos) renderizam uma linha por item", () => {
    const itens = [
      criarItem({ id: "p1", nome: "ADAPTADOR TIPO C PARA P2" }),
      criarItem({ id: "p2", nome: "CABO USB KAIDI 2M IOS" }),
      criarItem({ id: "p3", nome: "CABO USB KAIDI 2M V8" }),
      criarItem({ id: "p4", nome: "CABO USB KAIDI IOS" }),
    ];

    render(<ListaItensCarrinho itens={itens} onEditar={vi.fn()} onRemover={vi.fn()} />);

    for (const item of itens) {
      expect(screen.getByText(item.nome)).toBeVisible();
    }
  });

  it("aciona onEditar/onRemover com o item certo", () => {
    const aoEditar = vi.fn();
    const aoRemover = vi.fn();
    const item = criarItem();

    render(<ListaItensCarrinho itens={[item]} onEditar={aoEditar} onRemover={aoRemover} />);

    fireEvent.click(screen.getByLabelText("Editar item"));
    fireEvent.click(screen.getByLabelText("Remover item"));

    expect(aoEditar).toHaveBeenCalledWith(item);
    expect(aoRemover).toHaveBeenCalledWith(item);
  });
});
