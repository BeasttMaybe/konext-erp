"use client";

import type { ProdutoPDV } from "@/store/useCartStore";

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

interface PropsListaProdutosPdv {
  produtos: ProdutoPDV[];
  indiceDestacado: number | null;
  onSelecionar: (produto: ProdutoPDV) => void;
}

/**
 * Lista de RESULTADOS da busca (referência: docs/design/referencia-pdv-etapa-produto.html
 * — modelo Bling). Substitui a grade de cards da fase anterior (Fase "PDV em
 * 3 etapas"): aqui é uma lista de linhas compactas logo abaixo do campo de
 * busca, navegável por teclado (setas mudam `indiceDestacado`, Enter escolhe
 * — a navegação em si vive em etapa-produto-pdv.tsx, que é quem sabe sobre
 * teclas). Selecionar uma linha NÃO adiciona ao pedido: só carrega o produto
 * no painel de montagem do item (ver painel-produto-selecionado-pdv.tsx).
 *
 * A action listarProdutosPDV já filtra quantidadeEstoque > 0 (comportamento
 * pré-existente, não alterado aqui), então o estado "0 em estoque" fica
 * correto no código mas não é alcançável com o filtro atual — mesma nota já
 * deixada na versão anterior deste arquivo.
 */
export function ListaProdutosPdv({ produtos, indiceDestacado, onSelecionar }: PropsListaProdutosPdv) {
  if (produtos.length === 0) {
    return <p className="px-1 py-2 text-xs text-kx-legenda">Nenhum produto encontrado.</p>;
  }

  return (
    <div className="flex max-h-[210px] flex-col gap-1.5 overflow-y-auto pr-1" role="listbox" aria-label="Resultados da busca de produto">
      {produtos.map((produto, indice) => {
        const estoque = produto.quantidadeEstoque ?? null;
        const estoqueMinimo = produto.estoqueMinimo ?? 3;
        const semEstoque = estoque !== null && estoque <= 0;
        const estoqueBaixo = estoque !== null && estoque > 0 && estoque <= estoqueMinimo;
        const corEstoque = semEstoque ? "text-kx-erro" : estoqueBaixo ? "text-kx-alerta" : "text-kx-legenda";
        const detalhes = [produto.codigoBarras, estoque === null ? null : semEstoque ? "0 em estoque" : `${estoque} em estoque`].filter(
          Boolean
        );
        const destacado = indice === indiceDestacado;

        return (
          <button
            key={produto.id}
            type="button"
            role="option"
            aria-selected={destacado}
            onClick={() => onSelecionar(produto)}
            disabled={semEstoque}
            className={`flex min-h-12 items-center gap-3 rounded-kx-cartao border px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              destacado ? "border-kx-destaque bg-kx-superficie" : "border-kx-painel-borda bg-kx-cartao hover:border-kx-destaque"
            }`}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-bold text-kx-texto">{produto.nome}</span>
              {detalhes.length > 0 && (
                <span className={`truncate text-[11px] tabular-nums ${corEstoque}`}>{detalhes.join(" · ")}</span>
              )}
            </span>
            <span className="shrink-0 text-sm font-extrabold tabular-nums text-kx-link">{formatarMoeda(produto.preco)}</span>
          </button>
        );
      })}
    </div>
  );
}
