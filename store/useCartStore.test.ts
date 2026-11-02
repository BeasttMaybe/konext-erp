import { beforeEach, describe, expect, it } from "vitest";

import { useCartStore, type ProdutoPDV } from "./useCartStore";

function produto(id: string, preco: number): ProdutoPDV {
  return { id, nome: `Produto ${id}`, preco };
}

describe("store/useCartStore — getResumo", () => {
  beforeEach(() => {
    useCartStore.getState().limparCarrinho();
  });

  it("soma os itens sem resto de ponto flutuante", () => {
    // 0.07 * 3 em float da 0.21000000000000002; o carrinho tem que dar 0.21.
    const { adicionarItem, alterarQuantidade } = useCartStore.getState();
    adicionarItem(produto("a", 0.07));
    alterarQuantidade("a", 3);

    expect(useCartStore.getState().getResumo().subtotal).toBe(0.21);
  });

  it("soma precos quebrados exatamente", () => {
    const { adicionarItem } = useCartStore.getState();
    adicionarItem(produto("a", 19.9));
    adicionarItem(produto("b", 12.3));
    adicionarItem(produto("c", 0.1));

    expect(useCartStore.getState().getResumo().subtotal).toBe(32.3);
  });

  it("multiplica pela quantidade sem acumular erro", () => {
    const { adicionarItem, alterarQuantidade } = useCartStore.getState();
    adicionarItem(produto("a", 1.15));
    alterarQuantidade("a", 7);

    expect(useCartStore.getState().getResumo().subtotal).toBe(8.05);
  });

  it("desconto fixo sai do subtotal", () => {
    const { adicionarItem, setTipoDesconto, setDesconto } = useCartStore.getState();
    adicionarItem(produto("a", 100));
    setTipoDesconto("FIXO");
    setDesconto(10.5);

    const resumo = useCartStore.getState().getResumo();
    expect(resumo.descontoAplicado).toBe(10.5);
    expect(resumo.total).toBe(89.5);
  });

  it("desconto percentual arredonda half-up pro centavo", () => {
    const { adicionarItem, setTipoDesconto, setDesconto } = useCartStore.getState();
    adicionarItem(produto("a", 19.99));
    setTipoDesconto("PERCENTUAL");
    setDesconto(10);

    const resumo = useCartStore.getState().getResumo();
    // 10% de 1999 centavos = 199,9 -> 200 (half-up), nao 199.
    expect(resumo.descontoAplicado).toBe(2);
    expect(resumo.total).toBe(17.99);
    // E o total continua fechando com o subtotal.
    expect(resumo.subtotal - resumo.descontoAplicado).toBeCloseTo(resumo.total, 10);
  });

  it("desconto maior que o subtotal zera o total em vez de ficar negativo", () => {
    const { adicionarItem, setTipoDesconto, setDesconto } = useCartStore.getState();
    adicionarItem(produto("a", 20));
    setTipoDesconto("FIXO");
    setDesconto(50);

    expect(useCartStore.getState().getResumo().total).toBe(0);
  });

  it("carrinho vazio nao devolve NaN", () => {
    const resumo = useCartStore.getState().getResumo();
    expect(resumo).toEqual({ subtotal: 0, descontoAplicado: 0, total: 0 });
  });
});

describe("store/useCartStore — subtotal da linha", () => {
  beforeEach(() => {
    useCartStore.getState().limparCarrinho();
  });

  it("o subtotal guardado na linha e exato, igual ao que o resumo soma", () => {
    const { adicionarItem, alterarQuantidade } = useCartStore.getState();
    adicionarItem(produto("a", 0.07));
    alterarQuantidade("a", 3);

    const [item] = useCartStore.getState().itens;
    expect(item.subtotal).toBe(0.21);
    expect(item.subtotal).toBe(useCartStore.getState().getResumo().subtotal);
  });

  it("somar o mesmo produto duas vezes mantem a linha exata", () => {
    const { adicionarItem } = useCartStore.getState();
    adicionarItem(produto("a", 1.15));
    adicionarItem(produto("a", 1.15));
    adicionarItem(produto("a", 1.15));

    const [item] = useCartStore.getState().itens;
    expect(item.quantidade).toBe(3);
    expect(item.subtotal).toBe(3.45);
  });
});
