"use client";

import { ShoppingCart } from "lucide-react";
import type { ItemCarrinho } from "@/store/useCartStore";
import { LinhaItemCarrinho } from "@/components/pdv/balcao/linha-item-carrinho";

interface PropsListaItensCarrinho {
  itens: ItemCarrinho[];
  onEditar: (item: ItemCarrinho) => void;
  onRemover: (item: ItemCarrinho) => void;
}

/**
 * Extraído de app/(dashboard)/pdv/page.tsx (bug de renderização, Fase 2A) —
 * ver lista-itens-carrinho.test.tsx para o cenário de regressão original
 * ("painel colapsava a lista pra 0px"). Colunas/ações da linha mudaram no
 * modelo Bling (editar/remover, sem +/- inline — ver linha-item-carrinho.tsx),
 * mas o motivo de este componente existir separado continua o mesmo.
 */
export function ListaItensCarrinho({ itens, onEditar, onRemover }: PropsListaItensCarrinho) {
  return (
    <div className="space-y-1.5">
      {itens.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-kx-cartao border border-dashed border-kx-campo-borda px-4 py-8 text-center">
          <ShoppingCart className="h-5 w-5 text-kx-legenda" aria-hidden="true" />
          <p className="text-sm font-semibold text-kx-texto">Carrinho vazio</p>
          <p className="text-xs text-kx-legenda">Passe o leitor ou busque um produto à esquerda.</p>
        </div>
      )}

      {itens.map((item) => (
        <LinhaItemCarrinho key={item.id} item={item} onEditar={() => onEditar(item)} onRemover={() => onRemover(item)} />
      ))}
    </div>
  );
}
