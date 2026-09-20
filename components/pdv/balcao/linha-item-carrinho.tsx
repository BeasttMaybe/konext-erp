"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import type { ItemCarrinho } from "@/store/useCartStore";

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

interface PropsLinhaItemCarrinho {
  item: ItemCarrinho;
  onDiminuir: () => void;
  onAumentar: () => void;
  onRemover: () => void;
}

/**
 * Preço unitário deixou de ser editável aqui (Fase 3-2C): preço vem sempre do
 * servidor (F-04/F-33, já era assim por baixo — o campo editável só
 * "traduzia" a edição em pedido de desconto). Ajuste de valor agora só pelo
 * controle de desconto, que é onde a intenção do operador fica registrada.
 */
export function LinhaItemCarrinho({ item, onDiminuir, onAumentar, onRemover }: PropsLinhaItemCarrinho) {
  return (
    <div className="flex flex-col gap-2 rounded-kx-cartao bg-kx-cartao p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex-1 text-[13px] font-bold leading-tight text-kx-texto">{item.nome}</span>
        <button
          type="button"
          onClick={onRemover}
          aria-label="Remover item"
          className="shrink-0 text-kx-erro-icone hover:opacity-80"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDiminuir}
            aria-label="Diminuir quantidade"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-texto hover:bg-kx-superficie"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-[22px] text-center text-sm font-extrabold tabular-nums text-kx-texto">
            {item.quantidade}
          </span>
          <button
            type="button"
            onClick={onAumentar}
            aria-label="Aumentar quantidade"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-texto hover:bg-kx-superficie"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="text-xs tabular-nums text-kx-legenda">{formatarMoeda(item.preco)} cada</span>
        <span className="ml-auto text-[15px] font-extrabold tabular-nums text-kx-texto">
          {formatarMoeda(item.subtotal)}
        </span>
      </div>
    </div>
  );
}
