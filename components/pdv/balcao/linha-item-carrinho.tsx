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
 * Linha de TABELA de largura total (referência:
 * docs/design/referencia-pdv-tres-etapas.html — Etapa Produto): produto,
 * quantidade, unitário, total, remover — mesmas 5 colunas de
 * `lista-itens-carrinho.tsx` (grid-template-columns:
 * minmax(0,1fr) 150px 130px 130px 50px). Antes (Fase 2A) era um cartão
 * empilhado; virou linha de grid nesta fase (PDV em 3 etapas) porque a
 * etapa Produto agora tem largura total disponível pra tabela, em vez do
 * espaço estreito ao lado do catálogo.
 *
 * Preço unitário continua não-editável aqui (Fase 3-2C): preço vem sempre do
 * servidor (F-04/F-33) — ajuste de valor só pelo controle de desconto.
 */
export function LinhaItemCarrinho({ item, onDiminuir, onAumentar, onRemover }: PropsLinhaItemCarrinho) {
  return (
    <div
      className="grid min-h-[52px] items-center gap-2.5 rounded-kx-cartao bg-kx-cartao px-3"
      style={{ gridTemplateColumns: "minmax(0, 1fr) 150px 130px 130px 50px" }}
    >
      <span className="truncate text-sm font-semibold text-kx-texto" title={item.nome}>
        {item.nome}
      </span>

      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={onDiminuir}
          aria-label="Diminuir quantidade"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-texto hover:bg-kx-superficie"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-[22px] text-center text-sm font-extrabold tabular-nums text-kx-texto">{item.quantidade}</span>
        <button
          type="button"
          onClick={onAumentar}
          aria-label="Aumentar quantidade"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-texto hover:bg-kx-superficie"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <span className="text-right text-xs tabular-nums text-kx-texto-2">{formatarMoeda(item.preco)}</span>

      <span className="text-right text-[15px] font-extrabold tabular-nums text-kx-texto">{formatarMoeda(item.subtotal)}</span>

      <button
        type="button"
        onClick={onRemover}
        aria-label="Remover item"
        className="flex h-[30px] w-[30px] items-center justify-self-end text-kx-erro-icone hover:opacity-80"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
