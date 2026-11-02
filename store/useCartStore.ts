import { create } from 'zustand';

import {
  aplicarPercentual,
  deDecimal,
  multiplicarPorQuantidade,
  paraMoeda,
  somar,
  subtrair,
} from '@/lib/dinheiro';

export interface ProdutoPDV {
  id: string;
  nome: string;
  preco: number;
  imagemUrl?: string | null;
  categoria?: string;
  quantidadeEstoque?: number;
  estoqueMinimo?: number;
  codigoBarras?: string | null;
}

export interface ItemCarrinho extends ProdutoPDV {
  quantidade: number;
  subtotal: number;
}

type TipoDesconto = 'FIXO' | 'PERCENTUAL';

interface CartState {
  itens: ItemCarrinho[];
  desconto: number;
  tipoDesconto: TipoDesconto;
  adicionarItem: (produto: ProdutoPDV) => void;
  removerItem: (id: string) => void;
  alterarQuantidade: (id: string, quantidade: number) => void;
  setDesconto: (valor: number) => void;
  setTipoDesconto: (tipo: TipoDesconto) => void;
  limparCarrinho: () => void;
  getResumo: () => { subtotal: number; descontoAplicado: number; total: number };
}

/**
 * Subtotal da linha, em reais e exato. A linha do carrinho mostra este
 * campo (components/pdv/balcao/linha-item-carrinho.tsx), e o resumo soma a
 * mesma conta: se a linha fosse float e o resumo centavo, a soma das linhas
 * na tela poderia nao fechar com o total logo abaixo delas.
 */
function subtotalDaLinha(preco: number, quantidade: number): number {
  return paraMoeda(multiplicarPorQuantidade(deDecimal(preco), Math.max(1, quantidade)));
}

// Essa estrutura garante que o PDV seja rápido e não trave a tela
export const useCartStore = create<CartState>((set, get) => ({
  itens: [],
  desconto: 0,
  tipoDesconto: 'FIXO',
  adicionarItem: (produto) => set((state) => {
    const itemExistente = state.itens.find(i => i.id === produto.id);
    if (itemExistente) {
      return {
        itens: state.itens.map(i => i.id === produto.id 
          ? { ...i, quantidade: i.quantidade + 1, subtotal: subtotalDaLinha(i.preco, i.quantidade + 1) } 
          : i
        )
      };
    }
    return { itens: [...state.itens, { ...produto, quantidade: 1, subtotal: subtotalDaLinha(produto.preco, 1) }] };
  }),
  removerItem: (id) => set((state) => ({
    itens: state.itens.filter(i => i.id !== id)
  })),
  alterarQuantidade: (id, qtd) => set((state) => ({
    itens: state.itens.map(i => i.id === id ? { ...i, quantidade: Math.max(1, qtd), subtotal: subtotalDaLinha(i.preco, qtd) } : i)
  })),
  setDesconto: (valor) => set({ desconto: valor }),
  setTipoDesconto: (tipo) => set({ tipoDesconto: tipo }),
  limparCarrinho: () => set({ itens: [], desconto: 0, tipoDesconto: 'FIXO' }),
  getResumo: () => {
    const state = get();

    // Fase 2A-3: a conta inteira em centavo inteiro. Antes era float puro
    // (`acc + item.subtotal`, e `subtotal * (desconto / 100)` pro percentual),
    // e essa e a conta que a pessoa le na tela antes de cobrar — um centavo
    // de diferenca aqui e um centavo de discussao no balcao. O resumo continua
    // saindo em reais, que e o que o PDV espera; so o caminho do meio mudou.
    const subtotalCentavos = state.itens.reduce(
      (acc, item) => somar(acc, multiplicarPorQuantidade(deDecimal(item.preco), item.quantidade)),
      0
    );

    let descontoCentavos = 0;
    if (state.tipoDesconto === 'FIXO') {
      descontoCentavos = deDecimal(state.desconto);
    } else if (state.tipoDesconto === 'PERCENTUAL') {
      descontoCentavos = aplicarPercentual(subtotalCentavos, state.desconto);
    }

    // Desconto maior que o subtotal zera o total, nao gera valor negativo.
    const totalCentavos = Math.max(0, subtrair(subtotalCentavos, descontoCentavos));

    return {
      subtotal: paraMoeda(subtotalCentavos),
      descontoAplicado: paraMoeda(descontoCentavos),
      total: paraMoeda(totalCentavos),
    };
  }
}));
