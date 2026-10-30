"use client";

import { Minus, Plus } from "lucide-react";
import type { ProdutoPDV } from "@/store/useCartStore";

function siglaProduto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "??";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[1]![0]}`.toUpperCase();
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

/** Mesmo padrão de sanitização/parse já usado em controle-desconto-pdv.tsx para o modo "R$" — duplicado de propósito (arquivo pequeno, cada componente de campo cuida do próprio parse, convenção já adotada nesta pasta). */
const sanitizarValorInput = (valor: string): string => {
  const apenasNumerosEVirgula = valor.replace(/[^\d,]/g, "");
  const [inteira, ...decimaisExtras] = apenasNumerosEVirgula.split(",");
  if (decimaisExtras.length === 0) return inteira;
  return `${inteira},${decimaisExtras.join("")}`;
};


interface PropsPainelProdutoSelecionadoPdv {
  produto: ProdutoPDV;
  quantidadeTexto: string;
  onQuantidadeTextoChange: (texto: string) => void;
  onDiminuir: () => void;
  onAumentar: () => void;
  descontoItemTexto: string;
  onDescontoItemTextoChange: (texto: string) => void;
  subtotal: number;
  emEdicao: boolean;
  onInserir: () => void;
}

/**
 * Painel do produto escolhido (referência: docs/design/referencia-pdv-etapa-produto.html
 * — modelo Bling). Aparece depois que um resultado da busca é escolhido (ou
 * uma linha do pedido é mandada para "Editar" — ver etapa-produto-pdv.tsx).
 *
 * Valor unitário é somente leitura (carry-over deliberado, não é bug): o
 * preço da venda SEMPRE vem do servidor (F-04/F-33, ver
 * lib/dominio/pdv/calcular-venda.ts e o mesmo comentário em
 * linha-item-carrinho.tsx) — o mockup mostra um campo com a mesma cara de
 * input dos outros só por consistência visual, não porque deva aceitar
 * edição.
 */
export function PainelProdutoSelecionadoPdv({
  produto,
  quantidadeTexto,
  onQuantidadeTextoChange,
  onDiminuir,
  onAumentar,
  descontoItemTexto,
  onDescontoItemTextoChange,
  subtotal,
  emEdicao,
  onInserir,
}: PropsPainelProdutoSelecionadoPdv) {
  const estoque = produto.quantidadeEstoque ?? null;
  const estoqueMinimo = produto.estoqueMinimo ?? 3;
  const semEstoque = estoque !== null && estoque <= 0;
  const estoqueBaixo = estoque !== null && estoque > 0 && estoque <= estoqueMinimo;
  const corEstoque = semEstoque ? "text-kx-erro" : estoqueBaixo ? "text-kx-alerta" : "text-kx-legenda";
  const detalhe = [produto.codigoBarras, estoque === null ? null : `${estoque} em estoque`].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-kx-cartao bg-kx-superficie p-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-kx-botao bg-kx-cartao text-xs font-extrabold text-kx-texto-2">
          {siglaProduto(produto.nome)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-extrabold leading-tight text-kx-texto">{produto.nome}</span>
          {detalhe && <span className={`truncate text-xs tabular-nums ${corEstoque}`}>{detalhe}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-kx-texto-2">Quantidade</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Diminuir quantidade"
              onClick={onDiminuir}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-texto hover:bg-kx-cartao"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              inputMode="numeric"
              value={quantidadeTexto}
              onChange={(evento) => onQuantidadeTextoChange(evento.target.value.replace(/[^\d]/g, ""))}
              className="h-11 w-full min-w-0 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-2 text-center text-base font-extrabold tabular-nums text-kx-texto outline-none"
            />
            <button
              type="button"
              aria-label="Aumentar quantidade"
              onClick={onAumentar}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-texto hover:bg-kx-cartao"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-kx-texto-2">Valor unitário</span>
          <input
            disabled
            title="O preço sempre vem do servidor — não é editável aqui."
            value={formatarMoeda(produto.preco)}
            className="h-11 w-full rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 text-[14px] tabular-nums text-kx-texto-2 outline-none disabled:cursor-not-allowed"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-kx-texto-2">Desconto no item</span>
          <input
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={descontoItemTexto}
            onChange={(evento) => onDescontoItemTextoChange(sanitizarValorInput(evento.target.value))}
            className="h-11 w-full rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 text-[14px] tabular-nums text-kx-texto outline-none"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-kx-texto-2">Subtotal</span>
          <div className="flex h-11 items-center justify-end rounded-kx-botao border border-kx-painel-borda bg-kx-cartao px-3">
            <span className="text-[15px] font-extrabold tabular-nums text-kx-link">{formatarMoeda(subtotal)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onInserir}
        className="mt-auto flex h-12 items-center justify-center gap-2 rounded-kx-botao bg-kx-primaria text-[15px] font-extrabold text-primary-foreground hover:opacity-90"
      >
        {emEdicao ? "Salvar item" : "Inserir no pedido"} <span className="text-xs opacity-80">Enter</span>
      </button>
    </div>
  );
}
