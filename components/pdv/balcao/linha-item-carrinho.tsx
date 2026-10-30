"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { ItemCarrinho } from "@/store/useCartStore";

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

interface PropsLinhaItemCarrinho {
  item: ItemCarrinho;
  onEditar: () => void;
  onRemover: () => void;
}

/**
 * Linha de TABELA (referência: docs/design/referencia-pdv-etapa-produto.html
 * — modelo Bling): produto com código/SKU embaixo do nome, quantidade,
 * unitário, subtotal, editar/remover — 5 colunas
 * (grid-template-columns: minmax(0,1fr) 70px 110px 120px 60px).
 *
 * Antes (Fase "PDV em 3 etapas") esta linha tinha botões +/- de quantidade
 * embutidos. O novo modelo (Bling) tira o ajuste inline daqui: "Editar"
 * carrega a linha de volta no painel de montagem do item, à esquerda (ver
 * etapa-produto-pdv.tsx), onde quantidade/desconto são ajustados com o
 * mesmo painel usado para inserir — evita ter duas UIs diferentes de
 * quantidade na mesma etapa. Preço unitário continua não-editável (F-04/F-33).
 */
export function LinhaItemCarrinho({ item, onEditar, onRemover }: PropsLinhaItemCarrinho) {
  return (
    <div
      className="grid min-h-[52px] items-center gap-2.5 rounded-kx-cartao bg-kx-cartao px-3"
      style={{ gridTemplateColumns: "minmax(0, 1fr) 70px 110px 120px 60px" }}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-kx-texto" title={item.nome}>
          {item.nome}
        </span>
        {item.codigoBarras && <span className="truncate text-[11px] tabular-nums text-kx-legenda">{item.codigoBarras}</span>}
      </div>

      <span className="text-center text-sm font-extrabold tabular-nums text-kx-texto">{item.quantidade}</span>

      <span className="text-right text-xs tabular-nums text-kx-texto-2">{formatarMoeda(item.preco)}</span>

      <span className="text-right text-[15px] font-extrabold tabular-nums text-kx-texto">{formatarMoeda(item.subtotal)}</span>

      <span className="flex items-center justify-self-end gap-2.5">
        <button type="button" onClick={onEditar} aria-label="Editar item" className="text-kx-link hover:opacity-80">
          <Pencil className="h-[15px] w-[15px]" aria-hidden="true" />
        </button>
        <button type="button" onClick={onRemover} aria-label="Remover item" className="text-kx-erro-icone hover:opacity-80">
          <Trash2 className="h-[15px] w-[15px]" aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
