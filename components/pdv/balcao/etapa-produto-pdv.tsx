"use client";

import { lerEntradaMonetaria, paraMoeda } from "@/lib/dinheiro";
import { useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { Percent, Search, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ListaProdutosPdv } from "@/components/pdv/balcao/lista-produtos-pdv";
import { PainelProdutoSelecionadoPdv } from "@/components/pdv/balcao/painel-produto-selecionado-pdv";
import { ListaItensCarrinho } from "@/components/pdv/balcao/lista-itens-carrinho";
import { ControleDescontoPdv } from "@/components/pdv/balcao/controle-desconto-pdv";
import type { ItemCarrinho, ProdutoPDV } from "@/store/useCartStore";
import type { ConfiguracaoPagamentosPDV, PedidoOSPDV } from "@/app/actions/pdv";
import type { ResultadoLimiteDesconto } from "@/lib/dominio/pdv/desconto-input";

const MAXIMO_RESULTADOS_BUSCA = 8;

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

/**
 * O comentário que estava aqui dizia "mesmo padrão de parse já usado em
 * controle-desconto-pdv.tsx/painel-produto-selecionado-pdv.tsx" — ou seja, a
 * própria duplicação estava documentada. Agora é a mesma FUNÇÃO, e não o
 * mesmo padrão copiado.
 */
const parseValorInput = (valor: string): number => {
  const centavos = lerEntradaMonetaria(valor);
  return centavos === null || centavos < 0 ? 0 : paraMoeda(centavos);
};

interface PropsEtapaProdutoPdv {
  busca: string;
  onBuscaChange: (valor: string) => void;
  buscaProdutoRef: RefObject<HTMLInputElement | null>;
  produtosFiltrados: ProdutoPDV[];
  carregandoProdutos: boolean;
  itens: ItemCarrinho[];
  /** Insere/atualiza um item do pedido. `modoEdicao` true sobrescreve a quantidade da linha (veio de "Editar"); false soma à quantidade já existente (nova adição ou leitor de código de barras). */
  onInserirItem: (produto: ProdutoPDV, quantidade: number, descontoItemReais: number, modoEdicao: boolean) => void;
  onRemover: (item: ItemCarrinho) => void;
  onVincularOS: () => void;
  pedidoOS: PedidoOSPDV | null;
  carregandoPedidoOS: boolean;
  // Rodapé (equivalente ao ResumoVendaPdv — nesta etapa ele fica embutido no
  // painel de itens, não numa coluna à parte; ver app/(dashboard)/pdv/page.tsx).
  clienteResumo: string;
  total: number;
  rotuloBotaoPrimario: string;
  atalhoBotaoPrimario: string;
  botaoPrimarioDesabilitado: boolean;
  onClickBotaoPrimario: () => void;
  configuracaoPagamentosPdv: ConfiguracaoPagamentosPDV | null;
  desconto: number;
  tipoDesconto: "FIXO" | "PERCENTUAL";
  subtotalGlobal: number;
  limiteDesconto: ResultadoLimiteDesconto;
  descontoBloqueiaVenda: boolean;
  descontoTextoEmEdicao: string | null;
  onTextoEmEdicaoChange: (texto: string | null) => void;
  onDescontoChange: (valor: number) => void;
  onTipoDescontoChange: (tipo: "FIXO" | "PERCENTUAL") => void;
  descontoPainelAberto: boolean;
  onDescontoPainelAbertoChange: (aberto: boolean) => void;
}

/**
 * Etapa 1 — Produto, modelo Bling (referência:
 * docs/design/referencia-pdv-etapa-produto.html, aprovada pelo dono —
 * substitui a etapa Produto de referencia-pdv-tres-etapas.html). Duas
 * colunas de largura total: ESQUERDA (460px) monta o item — busca com
 * resultados navegáveis por teclado + painel do produto escolhido;
 * DIREITA (flex) é o pedido em tela cheia, com o rodapé (cliente, desconto,
 * total, ir pra cliente) sempre visível — por isso esta etapa NÃO usa a
 * coluna "Resumo da venda" (components/pdv/balcao/resumo-venda-pdv.tsx) que
 * as etapas Cliente/Pagamento continuam usando; ver a troca condicional em
 * page.tsx. Sem grade de cards em lugar nenhum (era o problema do layout
 * anterior: cards cortados, área vazia grande).
 */
export function EtapaProdutoPdv({
  busca,
  onBuscaChange,
  buscaProdutoRef,
  produtosFiltrados,
  carregandoProdutos,
  itens,
  onInserirItem,
  onRemover,
  onVincularOS,
  pedidoOS,
  carregandoPedidoOS,
  clienteResumo,
  total,
  rotuloBotaoPrimario,
  atalhoBotaoPrimario,
  botaoPrimarioDesabilitado,
  onClickBotaoPrimario,
  configuracaoPagamentosPdv,
  desconto,
  tipoDesconto,
  subtotalGlobal,
  limiteDesconto,
  descontoBloqueiaVenda,
  descontoTextoEmEdicao,
  onTextoEmEdicaoChange,
  onDescontoChange,
  onTipoDescontoChange,
  descontoPainelAberto,
  onDescontoPainelAbertoChange,
}: PropsEtapaProdutoPdv) {
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoPDV | null>(null);
  const [emEdicaoId, setEmEdicaoId] = useState<string | null>(null);
  const [quantidadeTexto, setQuantidadeTexto] = useState("1");
  const [descontoItemTexto, setDescontoItemTexto] = useState("");
  const [indiceDestacado, setIndiceDestacado] = useState<number | null>(null);

  const mostrarResultados = busca.trim().length > 0;
  const resultados = useMemo(
    () => (mostrarResultados ? produtosFiltrados.slice(0, MAXIMO_RESULTADOS_BUSCA) : []),
    [mostrarResultados, produtosFiltrados]
  );

  const quantidadeAtual = Math.max(1, Number.parseInt(quantidadeTexto, 10) || 1);
  const descontoItemReais = parseValorInput(descontoItemTexto);
  const subtotalPainel = produtoSelecionado ? Math.max(0, produtoSelecionado.preco * quantidadeAtual - descontoItemReais) : 0;

  const limparPainel = () => {
    setProdutoSelecionado(null);
    setEmEdicaoId(null);
    setQuantidadeTexto("1");
    setDescontoItemTexto("");
  };

  const selecionarResultado = (produto: ProdutoPDV) => {
    setProdutoSelecionado(produto);
    setEmEdicaoId(null);
    setQuantidadeTexto("1");
    setDescontoItemTexto("");
    onBuscaChange("");
    setIndiceDestacado(null);
  };

  const editarItem = (item: ItemCarrinho) => {
    setProdutoSelecionado(item);
    setEmEdicaoId(item.id);
    setQuantidadeTexto(String(item.quantidade));
    setDescontoItemTexto("");
    onBuscaChange("");
    setIndiceDestacado(null);
    buscaProdutoRef.current?.focus();
  };

  const inserirPainelAtual = () => {
    if (!produtoSelecionado) return;
    onInserirItem(produtoSelecionado, quantidadeAtual, descontoItemReais, emEdicaoId !== null);
    limparPainel();
  };

  const aoTeclarBusca = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "ArrowDown") {
      if (resultados.length === 0) return;
      evento.preventDefault();
      setIndiceDestacado((atual) => (atual === null ? 0 : Math.min(resultados.length - 1, atual + 1)));
      return;
    }

    if (evento.key === "ArrowUp") {
      if (resultados.length === 0) return;
      evento.preventDefault();
      setIndiceDestacado((atual) => (atual === null ? 0 : Math.max(0, atual - 1)));
      return;
    }

    if (evento.key === "Escape") {
      if (mostrarResultados) {
        onBuscaChange("");
        setIndiceDestacado(null);
      } else if (produtoSelecionado) {
        limparPainel();
      }
      return;
    }

    if (evento.key !== "Enter") return;
    evento.preventDefault();

    const termo = busca.trim();

    if (mostrarResultados) {
      // Leitor de código de barras: código idêntico ao de um produto do
      // catálogo insere direto no pedido (qtd. 1), sem passar pelo painel —
      // escanear o mesmo código de novo incrementa a linha já existente
      // (onInserirItem soma à quantidade quando o produto já está no pedido).
      const produtoPorCodigo = produtosFiltrados.find(
        (produto) => produto.codigoBarras && produto.codigoBarras.toLowerCase() === termo.toLowerCase()
      );
      if (produtoPorCodigo) {
        onInserirItem(produtoPorCodigo, 1, 0, false);
        onBuscaChange("");
        setIndiceDestacado(null);
        return;
      }

      if (resultados.length === 0) return;
      const produto = resultados[indiceDestacado ?? 0];
      if (produto) selecionarResultado(produto);
      return;
    }

    if (produtoSelecionado) {
      inserirPainelAtual();
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 overflow-hidden lg:grid-cols-[460px_minmax(0,1fr)]">
      {/* Coluna esquerda — montar o item */}
      <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
        <label className="flex h-[52px] shrink-0 items-center gap-2.5 rounded-kx-cartao border border-kx-destaque bg-kx-superficie px-3.5">
          <Search className="h-5 w-5 shrink-0 text-kx-link" aria-hidden="true" />
          <input
            ref={buscaProdutoRef}
            placeholder="Leitor, nome, SKU ou código"
            value={busca}
            onChange={(evento) => {
              onBuscaChange(evento.target.value);
              setIndiceDestacado(null);
            }}
            onKeyDown={aoTeclarBusca}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-kx-texto outline-none placeholder:text-kx-placeholder"
          />
          <span className="shrink-0 rounded-md border border-kx-campo-borda px-2 py-0.5 text-xs text-kx-legenda">F2</span>
        </label>

        {mostrarResultados && (
          <>
            {carregandoProdutos ? (
              <p className="px-1 py-2 text-xs text-kx-legenda">Carregando produtos...</p>
            ) : (
              <ListaProdutosPdv produtos={resultados} indiceDestacado={indiceDestacado} onSelecionar={selecionarResultado} />
            )}
          </>
        )}

        {produtoSelecionado ? (
          <PainelProdutoSelecionadoPdv
            produto={produtoSelecionado}
            quantidadeTexto={quantidadeTexto}
            onQuantidadeTextoChange={(texto) => setQuantidadeTexto(texto)}
            onDiminuir={() => setQuantidadeTexto(String(Math.max(1, quantidadeAtual - 1)))}
            onAumentar={() => setQuantidadeTexto(String(quantidadeAtual + 1))}
            descontoItemTexto={descontoItemTexto}
            onDescontoItemTextoChange={setDescontoItemTexto}
            subtotal={subtotalPainel}
            emEdicao={emEdicaoId !== null}
            onInserir={inserirPainelAtual}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-kx-cartao bg-kx-superficie p-6 text-center">
            <p className="text-sm font-semibold text-kx-texto">Nenhum produto selecionado</p>
            <p className="text-xs text-kx-legenda">Passe o leitor ou busque por nome, SKU ou código de barras.</p>
          </div>
        )}
      </div>

      {/* Coluna direita — o pedido */}
      <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[15px] font-bold text-kx-texto">Itens do pedido</span>
          <span className="rounded-kx-pilula bg-kx-cartao px-2.5 py-0.5 text-xs font-bold tabular-nums text-kx-texto-2">
            {itens.length}
          </span>
          {carregandoPedidoOS && <span className="ml-2 text-xs text-kx-legenda">Carregando dados da OS...</span>}
          {!carregandoPedidoOS && pedidoOS && (
            <span className="ml-2 truncate text-xs text-kx-destaque">
              OS #{pedidoOS.numeroOs} vinculada — {pedidoOS.nomeCliente}
            </span>
          )}
          <div className="ml-auto flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled
              title="Chega numa fase futura — ainda não é possível lançar um serviço avulso pelo balcão."
              className="h-[34px] rounded-kx-botao px-3 text-xs"
            >
              Serviço avulso
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onVincularOS}
              className="h-[34px] rounded-kx-botao border-kx-primaria px-3 text-xs text-kx-link"
            >
              <Wrench className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Vincular OS · F4
            </Button>
          </div>
        </div>

        <div
          className="grid shrink-0 gap-2.5 px-3 text-xs font-semibold text-kx-legenda"
          style={{ gridTemplateColumns: "minmax(0, 1fr) 70px 110px 120px 60px" }}
        >
          <span>Produto</span>
          <span className="text-center">Qtd.</span>
          <span className="text-right">Unitário</span>
          <span className="text-right">Subtotal</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ListaItensCarrinho itens={itens} onEditar={editarItem} onRemover={onRemover} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-4 border-t border-kx-painel-borda pt-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-kx-legenda">Cliente</span>
            <span className="truncate text-[13px] font-bold text-kx-texto" title={clienteResumo}>
              {clienteResumo}
            </span>
          </div>

          {configuracaoPagamentosPdv?.permitirDescontoPDV && (
            <Popover open={descontoPainelAberto} onOpenChange={onDescontoPainelAbertoChange}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-9 rounded-kx-botao px-3 text-xs font-semibold">
                  <Percent className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Desconto <span className="ml-1.5 text-xs opacity-70">F6</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[300px] border-kx-painel-borda bg-kx-painel p-3 text-kx-texto">
                <ControleDescontoPdv
                  desconto={desconto}
                  tipoDesconto={tipoDesconto}
                  subtotal={subtotalGlobal}
                  configuracaoPagamentosPdv={configuracaoPagamentosPdv}
                  limiteDesconto={limiteDesconto}
                  descontoBloqueiaVenda={descontoBloqueiaVenda}
                  descontoTextoEmEdicao={descontoTextoEmEdicao}
                  onTextoEmEdicaoChange={onTextoEmEdicaoChange}
                  onDescontoChange={onDescontoChange}
                  onTipoDescontoChange={onTipoDescontoChange}
                />
              </PopoverContent>
            </Popover>
          )}

          <div className="ml-auto flex items-baseline gap-3">
            <span className="text-[13px] text-kx-legenda">Total</span>
            <span className="text-[22px] font-extrabold tabular-nums text-kx-texto">{formatarMoeda(total)}</span>
          </div>

          <Button
            type="button"
            onClick={onClickBotaoPrimario}
            disabled={botaoPrimarioDesabilitado}
            className="h-[50px] rounded-kx-botao px-5 text-[15px] font-extrabold"
          >
            {rotuloBotaoPrimario}
            {atalhoBotaoPrimario && <span className="ml-2.5 text-xs opacity-80">{atalhoBotaoPrimario}</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
