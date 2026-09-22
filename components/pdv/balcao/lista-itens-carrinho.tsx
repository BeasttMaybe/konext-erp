"use client";

import { ShoppingCart } from "lucide-react";
import type { ItemCarrinho } from "@/store/useCartStore";
import { LinhaItemCarrinho } from "@/components/pdv/balcao/linha-item-carrinho";

interface PropsListaItensCarrinho {
  itens: ItemCarrinho[];
  onDiminuir: (item: ItemCarrinho) => void;
  onAumentar: (item: ItemCarrinho) => void;
  onRemover: (item: ItemCarrinho) => void;
}

/**
 * Extraído de app/(dashboard)/pdv/page.tsx (bug de renderização, Fase 2A):
 * o painel do carrinho tinha essa lista embutida diretamente no JSX da
 * página, sem nenhum teste cobrindo "adicionar item -> linha aparece" —
 * uma regressão de layout (ver commit desta correção) deixou a lista
 * inteira colapsar pra altura zero sem nenhum teste pegar. Extrair pra um
 * componente próprio permite testar esse caminho isoladamente daqui pra
 * frente (ver lista-itens-carrinho.test.tsx).
 */
export function ListaItensCarrinho({ itens, onDiminuir, onAumentar, onRemover }: PropsListaItensCarrinho) {
  return (
    <div className="space-y-2">
      {itens.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-kx-cartao border border-dashed border-kx-campo-borda px-4 py-8 text-center">
          <ShoppingCart className="h-5 w-5 text-kx-legenda" aria-hidden="true" />
          <p className="text-sm font-semibold text-kx-texto">Carrinho vazio</p>
          <p className="text-xs text-kx-legenda">Passe o leitor ou clique em um produto.</p>
        </div>
      )}

      {itens.map((item) => (
        <LinhaItemCarrinho
          key={item.id}
          item={item}
          onDiminuir={() => onDiminuir(item)}
          onAumentar={() => onAumentar(item)}
          onRemover={() => onRemover(item)}
        />
      ))}
    </div>
  );
}
