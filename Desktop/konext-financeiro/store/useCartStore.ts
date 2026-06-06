import { create } from 'zustand';

export interface ProdutoPDV {
  id: string;
  nome: string;
  preco: number;
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
          ? { ...i, quantidade: i.quantidade + 1, subtotal: (i.quantidade + 1) * i.preco } 
          : i
        )
      };
    }
    return { itens: [...state.itens, { ...produto, quantidade: 1, subtotal: produto.preco }] };
  }),
  removerItem: (id) => set((state) => ({
    itens: state.itens.filter(i => i.id !== id)
  })),
  alterarQuantidade: (id, qtd) => set((state) => ({
    itens: state.itens.map(i => i.id === id ? { ...i, quantidade: Math.max(1, qtd), subtotal: Math.max(1, qtd) * i.preco } : i)
  })),
  setDesconto: (valor) => set({ desconto: valor }),
  setTipoDesconto: (tipo) => set({ tipoDesconto: tipo }),
  limparCarrinho: () => set({ itens: [], desconto: 0, tipoDesconto: 'FIXO' }),
  getResumo: () => {
    const state = get();
    const subtotal = state.itens.reduce((acc, item) => acc + item.subtotal, 0);
    
    // Calcular desconto baseado no tipo
    let descontoAplicado = 0;
    if (state.tipoDesconto === 'FIXO') {
      descontoAplicado = state.desconto;
    } else if (state.tipoDesconto === 'PERCENTUAL') {
      descontoAplicado = subtotal * (state.desconto / 100);
    }
    
    const total = Math.max(0, subtotal - descontoAplicado);
    
    return { subtotal, descontoAplicado, total };
  }
}));
