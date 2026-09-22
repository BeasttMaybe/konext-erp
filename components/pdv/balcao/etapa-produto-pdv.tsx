"use client";

import type { RefObject } from "react";
import { Search, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipsCategoriaPdv } from "@/components/pdv/balcao/chips-categoria-pdv";
import { ListaProdutosPdv } from "@/components/pdv/balcao/lista-produtos-pdv";
import { ListaItensCarrinho } from "@/components/pdv/balcao/lista-itens-carrinho";
import type { ItemCarrinho, ProdutoPDV } from "@/store/useCartStore";
import type { PedidoOSPDV } from "@/app/actions/pdv";

interface PropsEtapaProdutoPdv {
  busca: string;
  onBuscaChange: (valor: string) => void;
  buscaProdutoRef: RefObject<HTMLInputElement | null>;
  categorias: string[];
  categoriaAtiva: string | null;
  onCategoriaChange: (categoria: string | null) => void;
  produtosFiltrados: ProdutoPDV[];
  carregandoProdutos: boolean;
  onAdicionarProduto: (produto: ProdutoPDV) => void;
  itens: ItemCarrinho[];
  onDiminuir: (item: ItemCarrinho) => void;
  onAumentar: (item: ItemCarrinho) => void;
  onRemover: (item: ItemCarrinho) => void;
  onVincularOS: () => void;
  pedidoOS: PedidoOSPDV | null;
  carregandoPedidoOS: boolean;
}

/**
 * Etapa 1 — Produto (referência: docs/design/referencia-pdv-tres-etapas.html).
 * Busca larga + catálogo em grade + itens da venda como tabela de largura
 * total. Reaproveita ListaProdutosPdv/ListaItensCarrinho já existentes —
 * nenhuma lógica de busca/adição/estoque mudou, só o layout ao redor.
 */
export function EtapaProdutoPdv({
  busca,
  onBuscaChange,
  buscaProdutoRef,
  categorias,
  categoriaAtiva,
  onCategoriaChange,
  produtosFiltrados,
  carregandoProdutos,
  onAdicionarProduto,
  itens,
  onDiminuir,
  onAumentar,
  onRemover,
  onVincularOS,
  pedidoOS,
  carregandoPedidoOS,
}: PropsEtapaProdutoPdv) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden">
      <div className="flex gap-2.5">
        <label className="flex h-[52px] flex-1 items-center gap-3 rounded-kx-cartao border border-kx-destaque bg-kx-superficie px-4">
          <Search className="h-5 w-5 shrink-0 text-kx-link" aria-hidden="true" />
          <input
            ref={buscaProdutoRef}
            placeholder="Passe o leitor ou digite o nome, SKU ou código de barras"
            value={busca}
            onChange={(evento) => onBuscaChange(evento.target.value)}
            className="flex-1 bg-transparent text-[15px] text-kx-texto outline-none placeholder:text-kx-placeholder"
          />
          <span className="shrink-0 rounded-md border border-kx-campo-borda px-2 py-0.5 text-xs text-kx-legenda">F2</span>
        </label>
        <Button
          type="button"
          variant="outline"
          disabled
          title="Chega numa fase futura — ainda não é possível lançar um serviço avulso pelo balcão."
          className="h-[52px] shrink-0 rounded-kx-botao px-4"
        >
          Serviço avulso
        </Button>
        <Button type="button" variant="outline" onClick={onVincularOS} className="h-[52px] shrink-0 rounded-kx-botao px-4">
          <Wrench className="mr-2 h-4 w-4" aria-hidden="true" />
          Vincular OS <span className="ml-1.5 text-xs opacity-70">F4</span>
        </Button>
      </div>

      <ChipsCategoriaPdv categorias={categorias} categoriaAtiva={categoriaAtiva} onEscolher={onCategoriaChange} />

      <div className="max-h-[38%] min-h-0 overflow-y-auto pr-1">
        <ListaProdutosPdv produtos={produtosFiltrados} carregando={carregandoProdutos} onAdicionar={onAdicionarProduto} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[15px] font-bold text-kx-texto">Itens da venda</span>
          <span className="rounded-kx-pilula bg-kx-cartao px-2.5 py-0.5 text-xs font-bold tabular-nums text-kx-texto-2">
            {itens.length}
          </span>
          {carregandoPedidoOS && <span className="ml-auto text-xs text-kx-legenda">Carregando dados da OS...</span>}
          {!carregandoPedidoOS && pedidoOS && (
            <span className="ml-auto truncate text-xs text-kx-destaque">
              OS #{pedidoOS.numeroOs} vinculada — {pedidoOS.nomeCliente}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ListaItensCarrinho itens={itens} onDiminuir={onDiminuir} onAumentar={onAumentar} onRemover={onRemover} />
        </div>
      </div>
    </div>
  );
}
