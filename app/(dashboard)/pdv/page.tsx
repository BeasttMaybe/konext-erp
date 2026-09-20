"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Trash2,
  ShoppingCart,
  CreditCard,
  BarChart3,
  RefreshCw,
  Wallet,
  Lock,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { ChipsCategoriaPdv } from "@/components/pdv/balcao/chips-categoria-pdv";
import { ListaProdutosPdv } from "@/components/pdv/balcao/lista-produtos-pdv";
import { CartaoVincularOS } from "@/components/pdv/balcao/cartao-vincular-os";
import { LinhaItemCarrinho } from "@/components/pdv/balcao/linha-item-carrinho";
import { ControleDescontoPdv } from "@/components/pdv/balcao/controle-desconto-pdv";
import { useCartStore, ProdutoPDV } from "@/store/useCartStore";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { calcularLimiteDesconto } from "@/lib/dominio/pdv/desconto-input";
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
  type ItemCarrinhoPdvInput,
  type DescontoPdvInput,
} from "@/app/actions/pdv";
import { obterResumoCaixaDiario, type ResumoCaixaDiario } from "@/app/actions/caixa";
import {
  abrirNovaCaixaSession,
  obterResumoCaixaAbertoAtual,
  verificarStatusCaixa,
} from "@/app/actions/caixa-pdv";
import { toast } from "sonner";

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

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
  const buscaProdutoRef = useRef<HTMLInputElement>(null);

  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoPDV[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<ClientePDV[]>([]);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>("");
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalAbrirCaixaAberto, setModalAbrirCaixaAberto] = useState(false);
  const [pedidoOS, setPedidoOS] = useState<PedidoOSPDV | null>(null);
  const [carregandoPedidoOS, setCarregandoPedidoOS] = useState(false);
  const [sheetResumoAberto, setSheetResumoAberto] = useState(false);
  const [confirmarLimpezaAberto, setConfirmarLimpezaAberto] = useState(false);
  const [valorAberturaCaixa, setValorAberturaCaixa] = useState<string>("0");
  // Indica que o status do caixa ainda está sendo verificado ao carregar a página
  const [carregandoStatusCaixa, setCarregandoStatusCaixa] = useState(true);
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [caixaAbertaDesde, setCaixaAbertaDesde] = useState<Date | null>(null);
  const [abrindoCaixa, setAbrindoCaixa] = useState(false);
  const [resumoCaixaDiario, setResumoCaixaDiario] = useState<ResumoCaixaDiario | null>(null);
  const [configuracaoPagamentosPdv, setConfiguracaoPagamentosPdv] =
    useState<ConfiguracaoPagamentosPDV | null>(null);
  const [carregandoResumoCaixa, setCarregandoResumoCaixa] = useState(false);
  const [descontoTextoEmEdicao, setDescontoTextoEmEdicao] = useState<string | null>(null);
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

  const categorias = useMemo(() => {
    const vistas = new Set<string>();
    for (const produto of produtosCatalogo) {
      if (produto.categoria) vistas.add(produto.categoria);
    }
    return Array.from(vistas);
  }, [produtosCatalogo]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtosCatalogo.filter((p) => {
      const bateBusca = !termo || p.nome.toLowerCase().includes(termo);
      const bateCategoria = !categoriaAtiva || p.categoria === categoriaAtiva;
      return bateBusca && bateCategoria;
    });
  }, [busca, categoriaAtiva, produtosCatalogo]);

  const normalizarBuscaCliente = (valor: string) =>
    valor
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
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

        if (status) {
          try {
            const resumo = await obterResumoCaixaAbertoAtual();
            if (ativo) setCaixaAbertaDesde(new Date(resumo.dataAbertura));
          } catch {
            // Sem o horario de abertura o cabecalho so omite a informacao — nao impede vender.
          }
        }
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

  // Preview do lado do cliente — meramente informativo. O servidor recalcula
  // tudo de novo (calcularVendaPdv) e e quem realmente decide se o desconto
  // pedido passa; ver processarVenda/processarVendaComOSNoPDV.
  const podeAplicarDescontoAcimaDoLimite = useTemPermissao("pdv.aplicar_desconto_acima_limite");
  const limiteDesconto = calcularLimiteDesconto({
    valor: desconto,
    unidade: tipoDesconto === "PERCENTUAL" ? "PERCENTUAL" : "VALOR",
    subtotal: resumo.subtotal,
    limitePercentual: configuracaoPagamentosPdv?.descontoMaximoPDVPercentual ?? 100,
  });
  const descontoBloqueiaVenda = limiteDesconto.acimaDoLimite && !podeAplicarDescontoAcimaDoLimite;

  const onAdicionarProduto = useCallback(
    (produto: ProdutoPDV) => {
      adicionarItem(produto);
      // Leitor de codigo de barras "digita" no campo ativo — o foco precisa
      // voltar pra busca depois de cada adicao, senao o proximo produto lido
      // vai parar em qualquer campo que estiver focado.
      buscaProdutoRef.current?.focus();
    },
    [adicionarItem]
  );

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

  const finalizarVendaRef = useRef(finalizarVenda);
  useEffect(() => {
    finalizarVendaRef.current = finalizarVenda;
  });

  // F2 foca a busca de produto, F9 finaliza a venda (referencia: leitor de
  // codigo de barras digita como teclado — o foco precisa voltar sempre pra
  // cá; ver onAdicionarProduto abaixo). finalizarVendaRef existe porque este
  // efeito so roda uma vez ([]), mas finalizarVenda fecha sobre estado
  // (caixaAberto, clienteSelecionadoId...) que muda a cada render.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "F2") {
        evento.preventDefault();
        buscaProdutoRef.current?.focus();
      }
      if (evento.key === "F9") {
        evento.preventDefault();
        finalizarVendaRef.current();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  // O servidor nunca confia no preco/total do navegador (F-04/F-33): so
  // aceita id do produto + quantidade, e recalcula tudo a partir do banco.
  // O desconto pedido pelo operador (controle de desconto) vira um PEDIDO,
  // validado contra o limite configurado.
  const construirItensParaServidor = (): ItemCarrinhoPdvInput[] =>
    itens.map((item) => ({ produtoId: item.id, quantidade: item.quantidade }));

  const construirDescontoParaServidor = (): DescontoPdvInput | null => {
    return resumo.descontoAplicado > 0.001 ? { tipo: "VALOR", valor: resumo.descontoAplicado } : null;
  };

  const aoConfirmarPagamento = async (dados: DadosPagamento) => {
    try {
      const orderServiceSale = Boolean(pedidoOS);
      const orderServiceNumber = pedidoOS?.numeroOs;
      const itensParaServidor = construirItensParaServidor();
      const descontoParaServidor = construirDescontoParaServidor();
      const venda = pedidoOS
        ? await processarVendaComOSNoPDV(pedidoOS.osId, itensParaServidor, dados.pagamentos, {
            desconto: descontoParaServidor,
          })
        : await processarVenda(itensParaServidor, dados.pagamentos, {
            clienteId: clienteSelecionadoId || undefined,
            desconto: descontoParaServidor,
          });

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

      // O servidor recalculou o total (preco pode ter mudado, produto pode
      // ter sido desativado) e ele não bate mais com o que o carrinho local
      // mostrava. Atualiza o catálogo em segundo plano para a próxima
      // tentativa já refletir os preços reais — a mensagem pt-BR do servidor
      // já orienta o operador a revisar o carrinho.
      if (mensagem.includes("Atualize o carrinho")) {
        listarProdutosPDV()
          .then((lista) => setProdutosCatalogo(lista))
          .catch(() => {
            // Falha ao atualizar o catálogo em segundo plano — não impede o operador de recarregar a página.
          });
      }

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
      setCaixaAbertaDesde(new Date());
      setModalAbrirCaixaAberto(false);
      toast.success("Caixa aberto com sucesso.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível abrir o caixa.";
      toast.error(mensagem);
    } finally {
      setAbrindoCaixa(false);
    }
  };

  return (
    <div
      // Altura travada por viewport, nao por herança de `h-full` (Fase 3-2C):
      // o wrapper de `<main>` no shell (components/shell/shell-dashboard.tsx)
      // nao tem altura própria, entao `h-full` aqui cairia pra `auto` e o
      // balcão cresceria pro tamanho do conteúdo em vez de ficar preso ao
      // viewport — testado e revertido: mudar o shell pra dar `h-full` a
      // ele quebrou a rolagem do Kanban de OS (regressão real, não algo
      // hipotético). 72px é a altura da barra superior; 0/16px/24px são as
      // margens do cartão flutuante nos mesmos breakpoints do shell.
      className="flex h-[calc(100vh-72px)] w-full flex-col gap-4 overflow-hidden bg-kx-fundo p-5 lg:h-[calc(100vh-104px)] lg:p-6 xl:h-[calc(100vh-120px)]"
    >
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          {caixaAbertoResumoTexto(caixaAberto, caixaAbertaDesde)}
          <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">PDV · balcão</span>
        </div>

        <div className="ml-auto flex flex-wrap gap-2.5">
          <Button
            type="button"
            variant={caixaAberto ? "secondary" : "outline"}
            onClick={() => setModalAbrirCaixaAberto(true)}
            disabled={caixaAberto}
            className="h-[42px] rounded-kx-botao"
          >
            <Wallet className="h-4 w-4 mr-2" />
            {caixaAberto ? "Caixa Aberto" : "Abrir Caixa"}
          </Button>

          {/* Substitui o antigo modal de "Fechamento de Caixa" (Fase 3-2C,
              Parte 3): a contagem as cegas e o resumo do dia agora moram na
              tela dedicada, que também é onde fica a visão "Caixa aberto"
              (3 cartões + movimentações) que o modal nunca teve. */}
          {caixaAberto && !carregandoStatusCaixa ? (
            <Link
              href="/pdv/caixa"
              className="flex h-[42px] items-center rounded-kx-botao border border-kx-painel-borda px-4 text-sm font-semibold text-kx-texto hover:bg-kx-cartao"
            >
              <Lock className="h-4 w-4 mr-2" />
              Caixa e fechamento
            </Link>
          ) : (
            <Button type="button" variant="outline" className="h-[42px] rounded-kx-botao" disabled>
              {carregandoStatusCaixa ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verificando caixa...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Caixa e fechamento
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-[42px] rounded-kx-botao"
            onClick={() => setConfirmarLimpezaAberto(true)}
            disabled={itens.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Carrinho
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="h-[42px] rounded-kx-botao"
            onClick={() => setSheetResumoAberto(true)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Resumo do Dia
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Catálogo de Produtos */}
        <div className="flex min-h-0 flex-col gap-3.5">
          <div className="flex gap-2.5">
            <label className="flex h-[54px] flex-1 items-center gap-3 rounded-kx-cartao border border-kx-destaque bg-kx-painel px-4">
              <Search className="h-5 w-5 shrink-0 text-kx-link" aria-hidden="true" />
              <input
                ref={buscaProdutoRef}
                placeholder="Passe o leitor ou digite o nome, SKU ou código de barras"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                className="flex-1 bg-transparent text-[15px] text-kx-texto outline-none placeholder:text-kx-placeholder"
              />
              <span className="shrink-0 rounded-md border border-kx-campo-borda px-2 py-0.5 text-xs text-kx-legenda">F2</span>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled
              title="Chega numa fase futura — ainda não é possível lançar um serviço avulso pelo balcão."
              className="h-[54px] shrink-0 rounded-kx-botao px-4"
            >
              Vender serviço avulso
            </Button>
          </div>

          <ChipsCategoriaPdv categorias={categorias} categoriaAtiva={categoriaAtiva} onEscolher={setCategoriaAtiva} />

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ListaProdutosPdv produtos={produtosFiltrados} carregando={carregandoProdutos} onAdicionar={onAdicionarProduto} />

            {pedidoOS && (
              <p className="mt-3 text-xs text-kx-sucesso-texto">
                Modo OS ativo: você pode adicionar capa, cabo, película e outros produtos junto com esta OS no mesmo pedido.
              </p>
            )}
          </div>
        </div>

        {/* Carrinho */}
        <aside
          aria-label="Carrinho"
          className="flex min-h-0 flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[17px] font-extrabold text-kx-texto">Carrinho</span>
            <span className="rounded-kx-pilula bg-kx-cartao px-2.5 py-0.5 text-xs font-bold tabular-nums text-kx-texto-2">
              {itens.length} {itens.length === 1 ? "item" : "itens"}
            </span>
            {itens.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmarLimpezaAberto(true)}
                className="ml-auto text-[13px] font-bold text-kx-erro-icone hover:opacity-80"
              >
                Limpar
              </button>
            )}
          </div>

          {carregandoPedidoOS && <p className="text-xs text-kx-legenda">Carregando dados da OS...</p>}

          {!carregandoPedidoOS && !pedidoOS && <CartaoVincularOS />}

          {!carregandoPedidoOS && pedidoOS && (
            <div className="flex flex-col gap-1.5 rounded-kx-cartao border border-kx-destaque/40 bg-kx-cartao p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-kx-destaque">
                  <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                  OS #{pedidoOS.numeroOs}
                </p>
                <span className="rounded-kx-pilula bg-kx-entregue-fundo px-2 py-0.5 text-[10px] font-bold text-kx-entregue-texto">
                  Vinculada
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-kx-texto">{pedidoOS.nomeCliente}</p>
              <p className="truncate text-xs text-kx-texto-2">Equipamento: {pedidoOS.aparelho}</p>
              <p className="line-clamp-2 text-xs text-kx-legenda">Defeito: {pedidoOS.defeito}</p>
              <div className="flex items-center justify-between border-t border-kx-painel-borda pt-1.5 text-xs">
                <span className="text-kx-legenda">Valor OS</span>
                <span className="font-bold text-kx-destaque">{formatarMoeda(pedidoOS.valor)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 rounded-kx-cartao bg-kx-superficie px-3.5 py-3">
            <Search className="h-[18px] w-[18px] shrink-0 text-kx-legenda" aria-hidden="true" />
            <input
              placeholder="Cliente (nome, CPF ou telefone)"
              value={buscaCliente}
              onChange={(evento) => setBuscaCliente(evento.target.value)}
              className="flex-1 bg-transparent text-[13px] text-kx-texto outline-none placeholder:text-kx-legenda"
            />
          </div>

          {!clienteSelecionado && !!buscaCliente.trim() && (
            <div className="max-h-36 overflow-y-auto rounded-kx-botao border border-kx-painel-borda bg-kx-painel">
              {carregandoClientes && <p className="p-3 text-xs text-kx-legenda">Carregando clientes...</p>}
              {!carregandoClientes && clientesFiltrados.length === 0 && (
                <p className="p-3 text-xs text-kx-legenda">Nenhum cliente encontrado.</p>
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
                    className="w-full border-b border-kx-painel-borda px-3 py-2 text-left last:border-b-0 hover:bg-kx-cartao"
                  >
                    <p className="truncate text-sm font-semibold text-kx-texto">{cliente.nomeRazaoSocial}</p>
                    <p className="truncate text-[11px] text-kx-legenda">
                      {cliente.documento || cliente.telefone || "Sem documento informado"}
                    </p>
                  </button>
                ))}
            </div>
          )}

          {clienteSelecionado && (
            <div className="flex items-center justify-between gap-3 rounded-kx-cartao bg-kx-sucesso-fundo px-3 py-2">
              <p className="truncate text-sm font-semibold text-kx-sucesso-texto">{clienteSelecionado.nomeRazaoSocial}</p>
              <button
                type="button"
                onClick={() => {
                  setClienteSelecionadoId("");
                  setBuscaCliente("");
                }}
                className="shrink-0 text-xs font-bold text-kx-sucesso-texto hover:opacity-80"
              >
                Limpar
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {itens.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-kx-cartao border border-dashed border-kx-campo-borda px-4 py-8 text-center">
                <ShoppingCart className="h-5 w-5 text-kx-legenda" aria-hidden="true" />
                <p className="text-sm font-semibold text-kx-texto">Seu carrinho está vazio</p>
                <p className="text-xs text-kx-legenda">Clique em um produto para adicionar.</p>
              </div>
            )}

            {itens.map((item) => (
              <LinhaItemCarrinho
                key={item.id}
                item={item}
                onDiminuir={() => alterarQuantidade(item.id, item.quantidade - 1)}
                onAumentar={() => alterarQuantidade(item.id, item.quantidade + 1)}
                onRemover={() => removerItem(item.id)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-kx-painel-borda pt-3">
            {configuracaoPagamentosPdv && (
              <ControleDescontoPdv
                desconto={desconto}
                tipoDesconto={tipoDesconto}
                subtotal={resumo.subtotal}
                configuracaoPagamentosPdv={configuracaoPagamentosPdv}
                limiteDesconto={limiteDesconto}
                descontoBloqueiaVenda={descontoBloqueiaVenda}
                descontoTextoEmEdicao={descontoTextoEmEdicao}
                onTextoEmEdicaoChange={setDescontoTextoEmEdicao}
                onDescontoChange={setDesconto}
                onTipoDescontoChange={setTipoDesconto}
              />
            )}

            <div className="flex justify-between text-[13px] text-kx-texto-2">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatarMoeda(resumo.subtotal)}</span>
            </div>
            {pedidoOS && (
              <div className="-mt-2 flex justify-between text-[13px] text-kx-destaque">
                <span>OS enviada para PDV</span>
                <span className="tabular-nums">{formatarMoeda(pedidoOS.valor)}</span>
              </div>
            )}
            <div className="-mt-2 flex justify-between text-[13px] text-kx-sucesso-texto">
              <span>Desconto</span>
              <span className="tabular-nums">- {formatarMoeda(resumo.descontoAplicado)}</span>
            </div>

            <div className="flex items-baseline justify-between rounded-kx-cartao bg-kx-entregue-fundo px-3.5 py-3">
              <span className="text-sm font-bold text-kx-texto">Total</span>
              <span className="text-[26px] font-extrabold tabular-nums text-kx-texto">{formatarMoeda(totalGeral)}</span>
            </div>

            <Button
              className="h-[52px] w-full rounded-kx-botao text-base font-bold"
              disabled={(itens.length === 0 && !pedidoOS) || !clienteSelecionadoId || descontoBloqueiaVenda}
              onClick={finalizarVenda}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {caixaAberto ? "Finalizar venda" : "Abra o Caixa"}
              {caixaAberto && <span className="ml-2 text-xs opacity-80">F9</span>}
            </Button>
          </div>
        </aside>
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
            <label htmlFor="valor-abertura-caixa" className="text-sm font-medium text-kx-texto">
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

function caixaAbertoResumoTexto(caixaAberto: boolean, desde: Date | null) {
  if (!caixaAberto || !desde) return <span className="h-4" />;
  const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(desde);
  return <span className="text-xs text-kx-legenda">Caixa aberto desde {hora}</span>;
}
