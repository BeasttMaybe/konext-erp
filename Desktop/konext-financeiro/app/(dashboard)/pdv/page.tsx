"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModalPagamento,
  DadosPagamento,
} from "@/components/pdv/modal-pagamento";
import { useCartStore, ProdutoPDV } from "@/store/useCartStore";

/**
 * Catálogo de produtos mock para o PDV
 */
const produtosCatalogo: ProdutoPDV[] = [
  { id: "prod-001", nome: "Película de Vidro 3D", preco: 35 },
  { id: "prod-002", nome: "Capa Anti-Impacto", preco: 49.9 },
  { id: "prod-003", nome: "Carregador Turbo 33W", preco: 89.9 },
  { id: "prod-004", nome: "Cabo USB-C 1m", preco: 24.9 },
  { id: "prod-005", nome: "Fone Bluetooth TWS", preco: 159.9 },
  { id: "prod-006", nome: "Power Bank 10000mAh", preco: 129.9 },
  { id: "prod-007", nome: "Suporte Veicular", preco: 39.9 },
  { id: "prod-008", nome: "Bateria Externa Tipo C", preco: 199.9 },
  { id: "prod-009", nome: "Limpeza de Tela Kit", preco: 19.9 },
  { id: "prod-010", nome: "Adaptador HDMI", preco: 59.9 },
  { id: "prod-011", nome: "Caneta Touch Stylus", preco: 29.9 },
  { id: "prod-012", nome: "Cartão Micro SD 128GB", preco: 79.9 },
];

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

/**
 * Página do módulo PDV (Ponto de Venda)
 * Catálogo de produtos + carrinho com descontos
 */
export default function PDVPage() {
  const [busca, setBusca] = useState("");
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const {
    itens,
    desconto,
    tipoDesconto,
    adicionarItem,
    removerItem,
    alterarQuantidade,
    setDesconto,
    setTipoDesconto,
    limparCarrinho,
    getResumo,
  } = useCartStore();

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtosCatalogo;
    return produtosCatalogo.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [busca]);

  const resumo = getResumo();

  const finalizarVenda = () => {
    if (itens.length === 0) return;
    setModalPagamentoAberto(true);
  };

  const aoConfirmarPagamento = (dados: DadosPagamento) => {
    // Aqui seria registrada a venda no backend (forma de pagamento, taxas, etc.)
    console.log("Venda finalizada:", dados);
  };

  const aoNovaVenda = () => {
    limparCarrinho();
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Cabeçalho */}
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            PDV - Ponto de Venda
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
            Realize vendas rápidas com catálogo, carrinho e descontos
          </p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Catálogo de Produtos */}
            <div className="lg:col-span-2 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Buscar produto..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {produtosFiltrados.map((produto) => (
                  <button
                    key={produto.id}
                    onClick={() => adicionarItem(produto)}
                    className="text-left rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all"
                  >
                    <div className="h-20 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                      <ShoppingCart className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                      {produto.nome}
                    </p>
                    <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {formatarMoeda(produto.preco)}
                    </p>
                  </button>
                ))}

                {produtosFiltrados.length === 0 && (
                  <p className="col-span-full text-center text-zinc-500 dark:text-zinc-400 py-8">
                    Nenhum produto encontrado.
                  </p>
                )}
              </div>
            </div>

            {/* Carrinho */}
            <div className="lg:col-span-1">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 flex flex-col sticky top-0">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Carrinho ({itens.length})
                  </h2>
                  {itens.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={limparCarrinho}
                      className="text-red-600 hover:text-red-700"
                    >
                      Limpar
                    </Button>
                  )}
                </div>

                {/* Itens */}
                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                  {itens.length === 0 && (
                    <p className="text-center text-zinc-500 dark:text-zinc-400 py-10 text-sm">
                      O carrinho está vazio.
                      <br />
                      Clique em um produto para adicionar.
                    </p>
                  )}

                  {itens.map((item) => (
                    <div key={item.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.nome}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatarMoeda(item.preco)} un.
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            alterarQuantidade(item.id, item.quantidade - 1)
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">
                          {item.quantidade}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            alterarQuantidade(item.id, item.quantidade + 1)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="w-20 text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatarMoeda(item.subtotal)}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:text-red-700"
                        onClick={() => removerItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Desconto + Resumo */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-zinc-500" />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Desconto"
                      value={desconto || ""}
                      onChange={(e) => setDesconto(Number(e.target.value) || 0)}
                      className="flex-1"
                    />
                    <Select
                      value={tipoDesconto}
                      onValueChange={(v) =>
                        setTipoDesconto(v as "FIXO" | "PERCENTUAL")
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXO">R$</SelectItem>
                        <SelectItem value="PERCENTUAL">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Subtotal</span>
                      <span>{formatarMoeda(resumo.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Desconto</span>
                      <span>- {formatarMoeda(resumo.descontoAplicado)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-slate-100 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <span>Total</span>
                      <span>{formatarMoeda(resumo.total)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    disabled={itens.length === 0}
                    onClick={finalizarVenda}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Finalizar Venda
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de pagamento */}
      <ModalPagamento
        aberto={modalPagamentoAberto}
        total={resumo.total}
        aoFechar={() => setModalPagamentoAberto(false)}
        aoConfirmar={aoConfirmarPagamento}
        aoNovaVenda={aoNovaVenda}
      />
    </div>
  );
}
