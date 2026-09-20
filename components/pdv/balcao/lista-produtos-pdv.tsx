"use client";

import { ShoppingCart } from "lucide-react";
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

interface PropsListaProdutosPdv {
  produtos: ProdutoPDV[];
  carregando: boolean;
  onAdicionar: (produto: ProdutoPDV) => void;
}

/**
 * Lista compacta (referência: docs/design/referencia-pdv-balcao.html) — três
 * colunas, sem cartão grande de imagem. A action já filtra
 * quantidadeEstoque > 0 (comportamento pré-existente, não alterado aqui), então
 * o estado "0 em estoque" / --kx-erro abaixo fica correto no código mas não é
 * alcançável com o filtro atual — ver relatório final desta fase.
 */
export function ListaProdutosPdv({ produtos, carregando, onAdicionar }: PropsListaProdutosPdv) {
  if (carregando) {
    return <p className="py-8 text-center text-sm text-kx-legenda">Carregando produtos...</p>;
  }

  if (produtos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <ShoppingCart className="h-6 w-6 text-kx-legenda" aria-hidden="true" />
        <p className="text-sm text-kx-legenda">Nenhum produto encontrado.</p>
      </div>
    );
  }

  return (
    // grid-cols com breakpoint de VIEWPORT (sm:/xl:) fica errado aqui: esta
    // coluna divide a largura com o carrinho de 420px, nunca ocupa a tela
    // inteira — em telas menores (1280px) "3 colunas a partir de xl" ainda
    // dispara e esmaga cada cartao a ponto do nome do produto sumir. Largura
    // mínima por coluna deixa o número de colunas seguir o espaço real
    // disponível aqui, não o viewport inteiro.
    <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
      {produtos.map((produto) => {
        const estoque = produto.quantidadeEstoque ?? null;
        const estoqueMinimo = produto.estoqueMinimo ?? 3;
        const semEstoque = estoque !== null && estoque <= 0;
        const estoqueBaixo = estoque !== null && estoque > 0 && estoque <= estoqueMinimo;
        const corEstoque = semEstoque ? "text-kx-erro" : estoqueBaixo ? "text-kx-alerta" : "text-kx-legenda";
        const textoEstoque = estoque === null ? null : semEstoque ? "0 em estoque" : `${estoque} em estoque`;

        return (
          <button
            key={produto.id}
            type="button"
            onClick={() => onAdicionar(produto)}
            disabled={semEstoque}
            title={produto.nome}
            className="flex min-h-[68px] items-center gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao px-3 py-2.5 text-left transition-colors hover:border-kx-destaque disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-kx-botao bg-kx-superficie text-[11px] font-extrabold text-kx-texto-2">
              {siglaProduto(produto.nome)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-bold leading-tight text-kx-texto">{produto.nome}</span>
              {textoEstoque && <span className={`text-[11px] tabular-nums ${corEstoque}`}>{textoEstoque}</span>}
            </span>
            <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-kx-destaque">
              {formatarMoeda(produto.preco)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
