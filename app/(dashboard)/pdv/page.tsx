"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Tag,
  BarChart3,
  RefreshCw,
  Wallet,
  Lock,
  TrendingUp,
  Target,
  Banknote,
  BadgeDollarSign,
  QrCode,
  Receipt,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCartStore, ProdutoPDV } from "@/store/useCartStore";
import {
  listarClientesPDV,
  listarProdutosPDV,
  obterConfiguracaoPagamentosPDV,
  obterPedidoOSParaPDV,
  processarVendaComOSNoPDV,
  type PedidoOSPDV,
  processarVenda,
  type ClientePDV,
  type ConfiguracaoPagamentosPDV,
} from "@/app/actions/pdv";
import { obterResumoCaixaDiario, type ResumoCaixaDiario } from "@/app/actions/caixa";
import { META_DIARIA_REAIS } from "@/types/fechamento-caixa";
import {
  abrirNovaCaixaSession,
  fecharCaixaSessionAtual,
  obterResumoCaixaAbertoAtual,
  verificarStatusCaixa,
} from "@/app/actions/caixa-pdv";
import { toast } from "sonner";

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const formatarPrecoInput = (valor: number): string => valor.toFixed(2).replace(".", ",");

const sanitizarPrecoInput = (valor: string): string => {
  const apenasNumerosEVirgula = valor.replace(/[^\d,]/g, "");
  const [inteira, ...decimaisExtras] = apenasNumerosEVirgula.split(",");

  if (decimaisExtras.length === 0) {
    return inteira;
  }

  return `${inteira},${decimaisExtras.join("")}`;
};

const parsePrecoInput = (valor: string): number => {
  const normalizado = valor.replace(/\./g, "").replace(",", ".").trim();
  const numero = Number(normalizado);

  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
};

const formatarHora = (data: Date | string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));

const formatarFormaPagamento = (formaPagamento: string): string => {
  const mapa: Record<string, string> = {
    PIX: "PIX",
    TED: "TED",
    DINHEIRO: "Dinheiro",
    CARTAO_DEBITO: "Cartao de Debito",
    CARTAO_CREDITO: "Cartao de Credito",
    CARTAO_CREDITO_AVISTA: "Cartao de Credito a Vista",
    CARTAO_CREDITO_PARCELADO: "Cartao de Credito Parcelado",
    BOLETO: "Boleto",
    CREDIARIO: "Crediario",
    EMPENHO_PUBLICO: "Empenho Publico",
  };

  return mapa[formaPagamento] ?? formaPagamento;
};

/**
 * Página do módulo PDV (Ponto de Venda)
 * Catálogo de produtos + carrinho com descontos
 */
export default function PDVPage() {
  return (
    <Suspense fallback={<div className="w-full h-full" />}>
      <PDVPageConteudo />
    </Suspense>
  );
}

function PDVPageConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const osIdNaUrl = searchParams.get("osId") ?? "";

  const [busca, setBusca] = useState("");
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoPDV[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<ClientePDV[]>([]);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>("");
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalAbrirCaixaAberto, setModalAbrirCaixaAberto] = useState(false);
  const [modalFecharCaixaAberto, setModalFecharCaixaAberto] = useState(false);
  const [pedidoOS, setPedidoOS] = useState<PedidoOSPDV | null>(null);
  const [carregandoPedidoOS, setCarregandoPedidoOS] = useState(false);
  const [sheetResumoAberto, setSheetResumoAberto] = useState(false);
  const [confirmarLimpezaAberto, setConfirmarLimpezaAberto] = useState(false);
  const [valorAberturaCaixa, setValorAberturaCaixa] = useState<string>("0");
  const [valorFechamentoCaixa, setValorFechamentoCaixa] = useState<string>("0");
  const [carregandoResumoFechamento, setCarregandoResumoFechamento] = useState(false);
  // Indica que o status do caixa ainda está sendo verificado ao carregar a página
  const [carregandoStatusCaixa, setCarregandoStatusCaixa] = useState(true);
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [abrindoCaixa, setAbrindoCaixa] = useState(false);
  const [fechandoCaixa, setFechandoCaixa] = useState(false);
  const [resumoCaixaDiario, setResumoCaixaDiario] = useState<ResumoCaixaDiario | null>(null);
  const [configuracaoPagamentosPdv, setConfiguracaoPagamentosPdv] =
    useState<ConfiguracaoPagamentosPDV | null>(null);
  const [carregandoResumoCaixa, setCarregandoResumoCaixa] = useState(false);
  const [precosEmEdicao, setPrecosEmEdicao] = useState<Record<string, string>>({});
  const {
    itens,
    desconto,
    tipoDesconto,
    adicionarItem,
    removerItem,
    alterarQuantidade,
    alterarPreco,
    setDesconto,
    setTipoDesconto,
    limparCarrinho,
    getResumo,
  } = useCartStore();

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtosCatalogo;
    return produtosCatalogo.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [busca, produtosCatalogo]);

  const normalizarBuscaCliente = (valor: string) =>
    valor
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const clientesFiltrados = useMemo(() => {
    const termo = normalizarBuscaCliente(buscaCliente.trim());

    if (!termo) {
      return [];
    }

    return clientes
      .filter((cliente) => {
        const nome = normalizarBuscaCliente(cliente.nomeRazaoSocial);
        const documento = normalizarBuscaCliente(cliente.documento);
        const telefone = normalizarBuscaCliente(cliente.telefone);

        return (
          nome.includes(termo) ||
          documento.includes(termo) ||
          telefone.includes(termo)
        );
      })
      .slice(0, 8);
  }, [buscaCliente, clientes]);

  const clienteSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteSelecionadoId) || null,
    [clienteSelecionadoId, clientes]
  );

  useEffect(() => {
    const carregarPedidoOS = async () => {
      if (!osIdNaUrl) {
        setPedidoOS(null);
        return;
      }

      try {
        setCarregandoPedidoOS(true);
        const pedido = await obterPedidoOSParaPDV(osIdNaUrl);
        limparCarrinho();
        setPedidoOS(pedido);
        setClienteSelecionadoId(pedido.clienteId);
        setBuscaCliente(pedido.nomeCliente);
      } catch (error) {
        setPedidoOS(null);
        const mensagem = error instanceof Error ? error.message : "Nao foi possivel carregar a OS no PDV.";
        toast.error(mensagem);
        router.replace("/pdv");
      } finally {
        setCarregandoPedidoOS(false);
      }
    };

    carregarPedidoOS();
  }, [osIdNaUrl, router]);

  useEffect(() => {
    let ativo = true;

    const carregarProdutos = async () => {
      try {
        setCarregandoProdutos(true);
        const lista = await listarProdutosPDV();
        if (!ativo) return;
        setProdutosCatalogo(lista);
      } catch {
        if (!ativo) return;
        toast.error("Nao foi possivel carregar os produtos do estoque.");
      } finally {
        if (!ativo) return;
        setCarregandoProdutos(false);
      }
    };

    const carregarClientes = async () => {
      try {
        setCarregandoClientes(true);
        const lista = await listarClientesPDV();
        if (!ativo) return;
        setClientes(lista);
      } catch {
        if (!ativo) return;
        toast.error("Nao foi possivel carregar os clientes do CRM.");
      } finally {
        if (!ativo) return;
        setCarregandoClientes(false);
      }
    };

    carregarProdutos();
    carregarClientes();

    const carregarStatusCaixa = async () => {
      try {
        setCarregandoStatusCaixa(true);
        const status = await verificarStatusCaixa();
        if (!ativo) return;
        setCaixaAberto(status);
      } catch (erro) {
        if (!ativo) return;
        // Falha silenciosa causaria o botão "Fechar Caixa" ficar desabilitado sem feedback
        console.error("[PDV] Falha ao verificar status do caixa:", erro);
        toast.error("Não foi possível verificar o status do caixa.", {
          description: "Recarregue a página ou contate o suporte.",
        });
        setCaixaAberto(false);
      } finally {
        if (!ativo) return;
        setCarregandoStatusCaixa(false);
      }
    };

    carregarStatusCaixa();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!sheetResumoAberto) return;

    let ativo = true;

    const carregarResumoCaixa = async () => {
      try {
        setCarregandoResumoCaixa(true);
        const resumo = await obterResumoCaixaDiario();
        if (!ativo) return;
        setResumoCaixaDiario(resumo);
      } catch {
        if (!ativo) return;
        toast.error("Nao foi possivel carregar o resumo do caixa de hoje.");
      } finally {
        if (!ativo) return;
        setCarregandoResumoCaixa(false);
      }
    };

    carregarResumoCaixa();

    return () => {
      ativo = false;
    };
  }, [sheetResumoAberto]);

  useEffect(() => {
    let ativo = true;

    const carregarConfiguracoesPdv = async () => {
      try {
        const config = await obterConfiguracaoPagamentosPDV();
        if (!ativo) return;
        setConfiguracaoPagamentosPdv(config);
      } catch {
        if (!ativo) return;
        toast.error("Nao foi possivel carregar as configuracoes de pagamento do PDV.");
      }
    };

    carregarConfiguracoesPdv();

    return () => {
      ativo = false;
    };
  }, []);

  const resumo = getResumo();
  const totalGeral = (pedidoOS?.valor ?? 0) + resumo.total;

  const finalizarVenda = () => {
    if (itens.length === 0 && !pedidoOS) return;

    if (!caixaAberto) {
      toast.error("Abra o caixa para finalizar a venda.");
      return;
    }

    if (!clienteSelecionadoId) {
      toast.error("Selecione um cliente antes de finalizar a venda.");
      return;
    }

    setModalPagamentoAberto(true);
  };

  const aoConfirmarPagamento = async (dados: DadosPagamento) => {
    try {
      const orderServiceSale = Boolean(pedidoOS);
      const orderServiceNumber = pedidoOS?.numeroOs;
      const venda = pedidoOS
        ? await processarVendaComOSNoPDV(pedidoOS.osId, itens, dados.pagamentos)
        : await processarVenda(
            itens,
            resumo.total,
            dados.pagamentos,
            clienteSelecionadoId || undefined
          );

      // Venda salva com sucesso — limpa automaticamente o PDV antes de retornar
      limparCarrinho();           // reseta itens, desconto e tipoDesconto
      setClienteSelecionadoId(""); // remove o cliente selecionado
      setBuscaCliente("");         // limpa o campo de busca de cliente
      setPedidoOS(null);           // desvincula a OS, se houver

      toast.success(orderServiceSale ? "Ordem de Serviço faturada com sucesso!" : "Venda finalizada! PDV liberado para o próximo cliente.", {
        description: orderServiceSale
          ? `A OS #${orderServiceNumber ?? "-"} foi convertida em venda no PDV.`
          : `Comprovante #${venda.vendaId.slice(0, 8)} gerado com sucesso.`,
      });

      return { sucesso: true, vendaId: venda.vendaId };
    } catch (erro) {
      const mensagem =
        erro instanceof Error
          ? erro.message
          : "Não foi possível processar a venda. Tente novamente.";

      return {
        sucesso: false,
        mensagem,
      };
    }
  };

  const aoNovaVenda = () => {
    // Limpa o carrinho (inclui itens, desconto e tipoDesconto via limparCarrinho)
    limparCarrinho();
    // Limpa o cliente selecionado e o campo de busca
    setClienteSelecionadoId("");
    setBuscaCliente("");
    // Limpa o pedido de OS vinculado e remove o param da URL
    setPedidoOS(null);
    router.replace("/pdv");
  };

  const atualizarResumoCaixa = async () => {
    try {
      setCarregandoResumoCaixa(true);
      const resumo = await obterResumoCaixaDiario();
      setResumoCaixaDiario(resumo);
    } catch {
      toast.error("Nao foi possivel atualizar o resumo do caixa.");
    } finally {
      setCarregandoResumoCaixa(false);
    }
  };

  const confirmarLimpezaCarrinho = () => {
    limparCarrinho();
    toast.success("Carrinho limpo com sucesso.");
    setConfirmarLimpezaAberto(false);
  };

  const abrirCaixa = async () => {
    const valor = Number(valorAberturaCaixa || 0);

    try {
      setAbrindoCaixa(true);
      await abrirNovaCaixaSession(valor);
      setCaixaAberto(true);
      setModalAbrirCaixaAberto(false);
      toast.success("Caixa aberto com sucesso.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível abrir o caixa.";
      toast.error(mensagem);
    } finally {
      setAbrindoCaixa(false);
    }
  };

  const fecharCaixa = async () => {
    const valor = Number(valorFechamentoCaixa || 0);

    try {
      setFechandoCaixa(true);
      await fecharCaixaSessionAtual(Number.isFinite(valor) ? valor : null);
      setCaixaAberto(false);
      setModalFecharCaixaAberto(false);
      toast.success("Caixa fechado com sucesso.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel fechar o caixa.";
      toast.error(mensagem);
    } finally {
      setFechandoCaixa(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent">
      {/* Cabeçalho */}
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              PDV - Ponto de Venda
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
              Realize vendas rápidas com catálogo, carrinho e descontos
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:self-start">
            <Button
              type="button"
              variant={caixaAberto ? "secondary" : "outline"}
              onClick={() => setModalAbrirCaixaAberto(true)}
              disabled={caixaAberto}
            >
              <Wallet className="h-4 w-4 mr-2" />
              {caixaAberto ? "Caixa Aberto" : "Abrir Caixa"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  setCarregandoResumoFechamento(true);
                  // Busca o resumo de fechamento e o consolidado diário em paralelo
                  const [resumoFechamento, resumoDiario] = await Promise.all([
                    obterResumoCaixaAbertoAtual(),
                    obterResumoCaixaDiario(),
                  ]);
                  setValorFechamentoCaixa(resumoFechamento.valorSugeridoFechamento.toFixed(2));
                  setResumoCaixaDiario(resumoDiario);
                  setModalFecharCaixaAberto(true);
                } catch (erro) {
                  // Exibe o erro para diagnóstico no terminal e notifica o usuário via toast
                  console.error("[PDV] Falha ao preparar fechamento de caixa:", erro);
                  const mensagem =
                    erro instanceof Error
                      ? erro.message
                      : "Não foi possível carregar o resumo de fechamento.";
                  toast.error("Erro ao fechar caixa", {
                    description: mensagem,
                  });
                } finally {
                  setCarregandoResumoFechamento(false);
                }
              }}
              disabled={!caixaAberto || carregandoStatusCaixa || carregandoResumoFechamento}
            >
              {carregandoResumoFechamento ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Preparando...
                </>
              ) : carregandoStatusCaixa ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verificando caixa...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Fechar Caixa
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmarLimpezaAberto(true)}
              disabled={itens.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Carrinho
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setSheetResumoAberto(true)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Resumo do Dia
            </Button>
          </div>
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
                {carregandoProdutos && (
                  <p className="col-span-full text-center text-zinc-500 dark:text-zinc-400 py-8">
                    Carregando produtos...
                  </p>
                )}

                {produtosFiltrados.map((produto) => (
                  <button
                    key={produto.id}
                    onClick={() => adicionarItem(produto)}
                    className="text-left rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all"
                  >
                    {produto.imagemUrl ? (
                      <div className="h-20 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 mb-3 bg-slate-100 dark:bg-slate-700">
                        <img
                          src={produto.imagemUrl}
                          alt={produto.nome}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="h-20 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                        <ShoppingCart className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                      {produto.nome}
                    </p>
                    <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {formatarMoeda(produto.preco)}
                    </p>
                  </button>
                ))}

                {!carregandoProdutos && produtosFiltrados.length === 0 && (
                  <p className="col-span-full text-center text-zinc-500 dark:text-zinc-400 py-8">
                    Nenhum produto encontrado.
                  </p>
                )}

                {pedidoOS && (
                  <p className="col-span-full text-xs text-emerald-600 dark:text-emerald-400">
                    Modo OS ativo: voce pode adicionar capa, cabo, pelicula e outros produtos junto com esta OS no mesmo pedido.
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
                      onClick={() => setConfirmarLimpezaAberto(true)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Limpar
                    </Button>
                  )}
                </div>

                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Ordem de Serviço no PDV
                  </p>

                  {carregandoPedidoOS && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Carregando dados da OS...
                    </p>
                  )}

                  {!carregandoPedidoOS && !pedidoOS && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Nenhuma OS enviada para este atendimento.
                    </p>
                  )}

                  {!carregandoPedidoOS && pedidoOS && (
                    <div className="rounded-md border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        OS #{pedidoOS.numeroOs}
                      </p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        Cliente: {pedidoOS.nomeCliente}
                      </p>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">
                        Aparelho: {pedidoOS.aparelho}
                      </p>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2">
                        Defeito: {pedidoOS.defeito}
                      </p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                        Valor OS: {formatarMoeda(pedidoOS.valor)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Itens */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Cliente da Venda
                  </p>

                  <Input
                    placeholder="Buscar por nome, CPF ou telefone"
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                  />

                  <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {carregandoClientes && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 p-3">
                        Carregando clientes...
                      </p>
                    )}

                    {!carregandoClientes && !buscaCliente.trim() && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 p-3">
                        Digite para buscar um cliente.
                      </p>
                    )}

                    {!carregandoClientes && !!buscaCliente.trim() && clientesFiltrados.length === 0 && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 p-3">
                        Nenhum cliente encontrado.
                      </p>
                    )}

                    {!carregandoClientes &&
                      clientesFiltrados.map((cliente) => (
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => {
                            setClienteSelecionadoId(cliente.id);
                            setBuscaCliente(cliente.nomeRazaoSocial);
                          }}
                          className={`w-full text-left p-3 transition-colors ${
                            clienteSelecionadoId === cliente.id
                              ? "bg-blue-50 dark:bg-blue-950/40"
                              : "hover:bg-zinc-50 dark:hover:bg-slate-700/40"
                          }`}
                        >
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {cliente.nomeRazaoSocial}
                          </p>
                        </button>
                      ))}
                  </div>

                  {clienteSelecionado && (
                    <div className="flex items-center justify-between rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          Cliente selecionado
                        </p>
                        <p className="text-sm text-emerald-800 dark:text-emerald-200 truncate">
                          {clienteSelecionado.nomeRazaoSocial}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setClienteSelecionadoId("");
                          setBuscaCliente("");
                        }}
                      >
                        Limpar
                      </Button>
                    </div>
                  )}
                </div>

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
                          {item.quantidade > 1 ? `${item.quantidade} un.` : "1 un."}
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

                      {/* Preço unitário editável diretamente no carrinho */}
                      <div className="w-24 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <span className="text-xs text-zinc-400">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={precosEmEdicao[item.id] ?? formatarPrecoInput(item.preco)}
                            onFocus={() => {
                              setPrecosEmEdicao((estadoAnterior) => ({
                                ...estadoAnterior,
                                [item.id]: formatarPrecoInput(item.preco),
                              }));
                            }}
                            onChange={(e) => {
                              const valorSanitizado = sanitizarPrecoInput(e.target.value);
                              setPrecosEmEdicao((estadoAnterior) => ({
                                ...estadoAnterior,
                                [item.id]: valorSanitizado,
                              }));
                            }}
                            onBlur={() => {
                              const valorDigitado = precosEmEdicao[item.id] ?? formatarPrecoInput(item.preco);
                              alterarPreco(item.id, parsePrecoInput(valorDigitado));
                              setPrecosEmEdicao((estadoAnterior) => {
                                const novoEstado = { ...estadoAnterior };
                                delete novoEstado[item.id];
                                return novoEstado;
                              });
                            }}
                            onKeyDown={(evento) => {
                              if (evento.key === "Enter") {
                                evento.currentTarget.blur();
                                return;
                              }

                              if (evento.key === "Escape") {
                                setPrecosEmEdicao((estadoAnterior) => {
                                  const novoEstado = { ...estadoAnterior };
                                  delete novoEstado[item.id];
                                  return novoEstado;
                                });
                                evento.currentTarget.blur();
                              }
                            }}
                            className="w-16 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-zinc-400 focus:border-blue-500 focus:outline-none text-right transition-colors"
                            title="Editar preço unitário"
                          />
                        </div>
                        {item.quantidade > 1 && (
                          <p className="text-xs text-zinc-400 text-right mt-0.5">
                            = {formatarMoeda(item.subtotal)}
                          </p>
                        )}
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
                      disabled={configuracaoPagamentosPdv ? !configuracaoPagamentosPdv.permitirDescontoPDV : false}
                      onChange={(e) => {
                        const valorDigitado = Number(e.target.value) || 0;
                        const limitePercentual =
                          configuracaoPagamentosPdv?.descontoMaximoPDVPercentual ?? 100;
                        const valorAplicado =
                          tipoDesconto === "PERCENTUAL"
                            ? Math.min(limitePercentual, Math.max(0, valorDigitado))
                            : Math.max(0, valorDigitado);
                        setDesconto(valorAplicado);
                      }}
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
                    {pedidoOS && (
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>OS enviada para PDV</span>
                        <span>{formatarMoeda(pedidoOS.valor)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Desconto</span>
                      <span>- {formatarMoeda(resumo.descontoAplicado)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-slate-100 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <span>Total</span>
                      <span>{formatarMoeda(totalGeral)}</span>
                    </div>
                  </div>

                  <Button className="w-full" disabled={(itens.length === 0 && !pedidoOS) || !clienteSelecionadoId} onClick={finalizarVenda}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {caixaAberto ? "Finalizar Venda" : "Abra o Caixa"}
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
        total={totalGeral}
        descontoAplicado={resumo.descontoAplicado}
        configuracaoPagamento={configuracaoPagamentosPdv}
        aoFechar={() => setModalPagamentoAberto(false)}
        aoConfirmar={aoConfirmarPagamento}
        aoNovaVenda={aoNovaVenda}
      />

      <Dialog open={modalAbrirCaixaAberto} onOpenChange={setModalAbrirCaixaAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abertura de Caixa</DialogTitle>
            <DialogDescription>
              Informe o valor inicial para troco e abertura da sessão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="valor-abertura-caixa" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Valor Inicial/Troco (R$)
            </label>
            <Input
              id="valor-abertura-caixa"
              type="number"
              min="0"
              step="0.01"
              value={valorAberturaCaixa}
              onChange={(evento) => setValorAberturaCaixa(evento.target.value)}
              placeholder="0,00"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalAbrirCaixaAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={abrirCaixa} disabled={abrindoCaixa}>
              {abrindoCaixa ? "Abrindo..." : "Confirmar Abertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalFecharCaixaAberto} onOpenChange={setModalFecharCaixaAberto}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fechamento de Caixa</DialogTitle>
            <DialogDescription>
              Resumo financeiro do dia e encerramento da sessão atual.
            </DialogDescription>
          </DialogHeader>

          {/* ── Relatório financeiro do dia ── */}
          {resumoCaixaDiario && (() => {
            const totalEntradas = resumoCaixaDiario.totalVendas;
            const custoTotal    = resumoCaixaDiario.custoTotal;
            const lucroBruto    = resumoCaixaDiario.lucroBruto;
            const formas        = resumoCaixaDiario.totaisPorFormaPagamento;
            const percentualMeta = Math.min((totalEntradas / META_DIARIA_REAIS) * 100, 100);
            const metaAtingida  = totalEntradas >= META_DIARIA_REAIS;
            const faltaMeta     = META_DIARIA_REAIS - totalEntradas;

            // Configuração visual por forma de pagamento
            const cfgForma: Record<string, { cor: string; corTexto: string; corBarra: string; Icone: React.ElementType }> = {
              PIX:             { cor: "bg-teal-50 dark:bg-teal-950/30",     corTexto: "text-teal-700 dark:text-teal-300",      corBarra: "bg-teal-500",    Icone: QrCode          },
              DINHEIRO:        { cor: "bg-emerald-50 dark:bg-emerald-950/30", corTexto: "text-emerald-700 dark:text-emerald-300", corBarra: "bg-emerald-500", Icone: Wallet          },
              CARTAO_CREDITO:  { cor: "bg-violet-50 dark:bg-violet-950/30", corTexto: "text-violet-700 dark:text-violet-300",   corBarra: "bg-violet-500",  Icone: CreditCard      },
              CARTAO_DEBITO:   { cor: "bg-blue-50 dark:bg-blue-950/30",     corTexto: "text-blue-700 dark:text-blue-300",      corBarra: "bg-blue-500",    Icone: CreditCard      },
              BOLETO:          { cor: "bg-orange-50 dark:bg-orange-950/30", corTexto: "text-orange-700 dark:text-orange-300",  corBarra: "bg-orange-500",  Icone: Receipt         },
              CREDIARIO:       { cor: "bg-amber-50 dark:bg-amber-950/30",   corTexto: "text-amber-700 dark:text-amber-300",    corBarra: "bg-amber-500",   Icone: BadgeDollarSign },
              EMPENHO_PUBLICO: { cor: "bg-slate-50 dark:bg-slate-800/50",   corTexto: "text-slate-700 dark:text-slate-300",    corBarra: "bg-slate-500",   Icone: Building2       },
            };
            const fallbackCfg = { cor: "bg-slate-50 dark:bg-slate-800/50", corTexto: "text-slate-600 dark:text-slate-400", corBarra: "bg-slate-400", Icone: Banknote };

            return (
              <div className="space-y-5 pb-2">

                {/* ── Meta Diária ── */}
                <div className="rounded-xl border border-border bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500" />
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" />
                        Meta Diária — {formatarMoeda(META_DIARIA_REAIS)}
                      </span>
                      {metaAtingida ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold px-3">
                          Meta Atingida! 🚀
                        </Badge>
                      ) : (
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                          Faltam {formatarMoeda(faltaMeta)} para a meta
                        </span>
                      )}
                    </div>
                    <Progress value={percentualMeta} className="h-3 rounded-full" />
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{formatarMoeda(totalEntradas)}</span>
                      <span className="tabular-nums">{Math.round(percentualMeta)}% de {formatarMoeda(META_DIARIA_REAIS)}</span>
                    </div>
                  </div>
                </div>

                {/* ── 3 Cartões de Resumo ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Total de Entradas */}
                  <div className="rounded-xl border-l-4 border-l-emerald-500 border border-border bg-white dark:bg-slate-900 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Total de Entradas</p>
                        <p className="text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{formatarMoeda(totalEntradas)}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 shrink-0">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  {/* Custo de Mercadoria */}
                  <div className="rounded-xl border-l-4 border-l-rose-500 border border-border bg-white dark:bg-slate-900 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Custo de Mercadoria / Peças</p>
                        <p className="text-xl font-extrabold tabular-nums text-rose-600 dark:text-rose-400">{formatarMoeda(custoTotal)}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 shrink-0">
                        <Banknote className="h-4 w-4 text-rose-600" />
                      </div>
                    </div>
                  </div>

                  {/* Lucro Bruto */}
                  <div className="rounded-xl border-l-4 border-l-blue-500 border border-border bg-white dark:bg-slate-900 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Lucro Bruto</p>
                        <p className={`text-xl font-extrabold tabular-nums ${lucroBruto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{formatarMoeda(lucroBruto)}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 shrink-0">
                        <BadgeDollarSign className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Detalhamento por Forma de Pagamento ── */}
                <div className="rounded-xl border border-border bg-white dark:bg-slate-900">
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Detalhamento por Forma de Pagamento</span>
                  </div>
                  <div className="px-4 pb-4 space-y-2">
                    {formas.length > 0 ? (
                      <>
                        {formas.map((item) => {
                          const cfg = cfgForma[item.formaPagamento] ?? fallbackCfg;
                          const { Icone } = cfg;
                          const pct = totalEntradas > 0 ? Math.round((item.total / totalEntradas) * 100) : 0;
                          return (
                            <div key={item.formaPagamento} className={`rounded-xl p-3 ${cfg.cor} flex items-center gap-3`}>
                              <div className="shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-900/60 shadow-sm flex items-center justify-center">
                                <Icone className={`w-4 h-4 ${cfg.corTexto}`} />
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-sm font-semibold ${cfg.corTexto}`}>{formatarFormaPagamento(item.formaPagamento)}</span>
                                  <span className={`text-sm font-bold tabular-nums ${cfg.corTexto}`}>{formatarMoeda(item.total)}</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-white/60 dark:bg-slate-900/40 overflow-hidden">
                                  <div className={`h-full rounded-full ${cfg.corBarra} transition-all duration-500`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                              <span className={`shrink-0 text-xs font-bold tabular-nums w-8 text-right ${cfg.corTexto} opacity-70`}>{pct}%</span>
                            </div>
                          );
                        })}
                        {/* Linha de total geral */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Geral</span>
                          <span className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-50">{formatarMoeda(totalEntradas)}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
                        Nenhuma venda registrada nesta sessão.
                      </p>
                    )}
                  </div>
                </div>

              </div>
            );
          })()}

          {/* ── Valor de fechamento ── */}
          <div className="space-y-2">
            <label htmlFor="valor-fechamento-caixa" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Valor Final (R$)
            </label>
            <Input
              id="valor-fechamento-caixa"
              type="number"
              min="0"
              step="0.01"
              value={valorFechamentoCaixa}
              onChange={(evento) => setValorFechamentoCaixa(evento.target.value)}
              placeholder="0,00"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalFecharCaixaAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={fecharCaixa} disabled={fechandoCaixa}>
              {fechandoCaixa ? "Fechando..." : "Confirmar Fechamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarLimpezaAberto} onOpenChange={setConfirmarLimpezaAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar carrinho</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja limpar todo o carrinho?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarLimpezaCarrinho}>Limpar Carrinho</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={sheetResumoAberto} onOpenChange={setSheetResumoAberto}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          <div className="h-full flex flex-col">
            <SheetHeader className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle>Resumo do Dia</SheetTitle>
                  <SheetDescription>
                    Fechamento diario do caixa com faturamento, custos e lucro bruto.
                  </SheetDescription>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={atualizarResumoCaixa}
                  disabled={carregandoResumoCaixa}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${carregandoResumoCaixa ? "animate-spin" : ""}`}
                  />
                  Atualizar
                </Button>
              </div>
            </SheetHeader>

            <div className="px-6 pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30 p-4">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Faturamento Hoje
                  </p>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                    {formatarMoeda(resumoCaixaDiario?.totalVendas ?? 0)}
                  </p>
                </div>

                <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/30 p-4">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                    Custo de Mercadoria
                  </p>
                  <p className="text-xl font-bold text-orange-900 dark:text-orange-100 mt-2">
                    {formatarMoeda(resumoCaixaDiario?.custoTotal ?? 0)}
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 p-4">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    Lucro Bruto
                  </p>
                  <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-2">
                    {formatarMoeda(resumoCaixaDiario?.lucroBruto ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="border-t border-zinc-200 dark:border-zinc-800" />
            </div>

            <div className="px-6 pb-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sessoes Fechadas Hoje
              </h3>
            </div>

            <div className="px-6 pb-4 space-y-3">
              {!carregandoResumoCaixa && (resumoCaixaDiario?.sessoesFechadasHoje.length ?? 0) === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Nenhum fechamento de caixa registrado hoje.
                </p>
              )}

              {!carregandoResumoCaixa &&
                (resumoCaixaDiario?.sessoesFechadasHoje ?? []).map((sessao) => (
                  <div
                    key={sessao.id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatarHora(sessao.dataAbertura)} - {formatarHora(sessao.dataFechamento)}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        #{sessao.id.slice(0, 8)}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <p className="text-zinc-600 dark:text-zinc-300">
                        Abertura: <span className="font-semibold">{formatarMoeda(sessao.valorAbertura)}</span>
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-300">
                        Vendas: <span className="font-semibold">{formatarMoeda(sessao.totalVendasSessao)}</span>
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-300">
                        Esperado: <span className="font-semibold">{formatarMoeda(sessao.valorEsperadoFechamento)}</span>
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-300">
                        Fechamento: <span className="font-semibold">{formatarMoeda(sessao.valorFechamento)}</span>
                      </p>
                    </div>

                    <p
                      className={`mt-3 text-xs font-semibold ${
                        sessao.diferencaFechamento === 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : sessao.diferencaFechamento > 0
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      Diferenca: {formatarMoeda(sessao.diferencaFechamento)}
                    </p>
                  </div>
                ))}
            </div>

            <div className="px-6 py-4">
              <div className="border-t border-zinc-200 dark:border-zinc-800" />
            </div>

            <div className="px-6 pb-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Vendas de Hoje
              </h3>
            </div>

            <ScrollArea className="flex-1 px-6 pb-6">
              {carregandoResumoCaixa && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Carregando resumo do caixa...
                </p>
              )}

              {!carregandoResumoCaixa && (resumoCaixaDiario?.vendas.length ?? 0) === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Nenhuma venda registrada hoje.
                </p>
              )}

              {!carregandoResumoCaixa &&
                (resumoCaixaDiario?.vendas ?? []).map((venda) => (
                  <div
                    key={venda.id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 mb-3 bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatarHora(venda.criadoEm)}
                      </p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {formatarMoeda(venda.valorTotal)}
                      </p>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Cliente: {venda.nomeCliente || "Nao identificado"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Forma de pagamento: {formatarFormaPagamento(venda.formaPagamento)}
                    </p>

                    <div className="mt-3 space-y-1">
                      {venda.itens.map((item) => (
                        <p
                          key={item.id}
                          className="text-xs text-zinc-600 dark:text-zinc-300"
                        >
                          {item.quantidade}x {item.nomeProduto} - {formatarMoeda(item.subtotal)}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
