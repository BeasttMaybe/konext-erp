"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Lock, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { BarraEtapasPdv } from "@/components/pdv/balcao/barra-etapas-pdv";
import { ResumoVendaPdv } from "@/components/pdv/balcao/resumo-venda-pdv";
import { EtapaProdutoPdv } from "@/components/pdv/balcao/etapa-produto-pdv";
import { EtapaClientePdv } from "@/components/pdv/balcao/etapa-cliente-pdv";
import { EtapaPagamentoPdv } from "@/components/pdv/balcao/etapa-pagamento-pdv";
import { ModalVendaConcluidaPdv } from "@/components/pdv/balcao/modal-venda-concluida-pdv";
import { useCartStore, ProdutoPDV } from "@/store/useCartStore";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { calcularLimiteDesconto, converterDescontoEntreUnidades } from "@/lib/dominio/pdv/desconto-input";
import type { EtapaPdv } from "@/lib/dominio/pdv/etapas-pdv";
import { usePagamentoPdv, type DadosPagamento } from "@/lib/pdv/hooks/usar-pagamento-pdv";
import { MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO } from "@/lib/pdv/formatacao-pagamento-pdv";
import { ehPagamentoPrazo } from "@/lib/pdv/pagamentos";
import {
  DADOS_CLIENTE_CONSUMIDOR_FINAL,
  exigeClienteRealParaFinalizarVenda,
} from "@/lib/dominio/crm/consumidor-final";
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

const MENSAGEM_VINCULAR_OS =
  'Para vincular uma OS, abra a OS e use "Enviar para o PDV" por lá.';

/**
 * Página do módulo PDV (Ponto de Venda) — fluxo de balcão em 3 etapas
 * (Produto → Cliente → Pagamento), referência aprovada em
 * docs/design/referencia-pdv-tres-etapas.html. Orquestra: qual etapa está
 * ativa, o estado do carrinho (useCartStore), busca de produto/cliente,
 * vínculo de OS, desconto, abertura/status de caixa e o pagamento (delegado
 * a lib/pdv/hooks/usar-pagamento-pdv.ts, chamado aqui porque o botão
 * primário da coluna "Resumo da venda" precisa acionar a confirmação
 * também na Etapa Pagamento).
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
  const buscaClienteRef = useRef<HTMLInputElement>(null);

  const [etapaAtual, setEtapaAtual] = useState<EtapaPdv>("produto");
  // Incrementa a cada NOVA TENTATIVA de venda (nova venda após sucesso,
  // "Cancelar venda") — ver lib/pdv/hooks/usar-pagamento-pdv.ts.
  const [tentativaVendaId, setTentativaVendaId] = useState(0);
  const [confirmarCancelamentoVendaAberto, setConfirmarCancelamentoVendaAberto] = useState(false);
  const [descontoPainelAberto, setDescontoPainelAberto] = useState(false);

  const [busca, setBusca] = useState("");
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoPDV[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<ClientePDV[]>([]);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>("");
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [modalAbrirCaixaAberto, setModalAbrirCaixaAberto] = useState(false);
  const [pedidoOS, setPedidoOS] = useState<PedidoOSPDV | null>(null);
  const [carregandoPedidoOS, setCarregandoPedidoOS] = useState(false);
  const [sheetResumoAberto, setSheetResumoAberto] = useState(false);
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

  // Etapa Produto (modelo Bling): busca por nome OU código de barras — sem
  // filtro de categoria (os chips de categoria saíram da etapa nesta fase;
  // ver components/pdv/balcao/chips-categoria-pdv.tsx, que ficou sem uso).
  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return produtosCatalogo.filter((p) => {
      const bateNome = p.nome.toLowerCase().includes(termo);
      const bateCodigo = Boolean(p.codigoBarras && p.codigoBarras.toLowerCase().includes(termo));
      return bateNome || bateCodigo;
    });
  }, [busca, produtosCatalogo]);

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
    // limparCarrinho vem do useCartStore (zustand): a referência da action é
    // estável entre renders (definida uma única vez em create()), então
    // incluí-la na lista de dependências não mudaria quando este efeito
    // dispara — só adicionaria ruído.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Etapa Produto (modelo Bling): insere/atualiza uma linha do pedido.
  // `modoEdicao` true (veio do botao "Editar" de uma linha existente)
  // SOBRESCREVE a quantidade; false (selecao nova na busca, ou leitor de
  // codigo de barras) SOMA a quantidade pedida a quantidade ja existente do
  // mesmo produto — reaproveita adicionarItem/alterarQuantidade do
  // useCartStore sem precisar de uma acao nova na store.
  //
  // "Desconto no item" (painel esquerdo) nao e um conceito separado no
  // dominio do servidor (calcularVendaPdv aceita desconto por item, mas
  // ItemCarrinhoPdvInput hoje so envia produtoId+quantidade — ver
  // app/actions/pdv.ts): em vez de estender o contrato do servidor so pra
  // isso, o valor pedido no painel e somado ao MESMO desconto global ja
  // existente (controle-desconto-pdv.tsx), convertido sempre para R$. O
  // total final cobrado continua exatamente certo e validado pelo mesmo
  // limite de desconto por cargo — so a granularidade "quanto foi descontado
  // de qual item" nao fica registrada em separado.
  const onInserirItemProduto = useCallback(
    (produto: ProdutoPDV, quantidade: number, descontoItemReais: number, modoEdicao: boolean) => {
      const existente = itens.find((item) => item.id === produto.id);
      const quantidadeFinal = modoEdicao || !existente ? quantidade : existente.quantidade + quantidade;

      if (existente) {
        alterarQuantidade(produto.id, quantidadeFinal);
      } else {
        adicionarItem(produto);
        if (quantidade > 1) alterarQuantidade(produto.id, quantidade);
      }

      if (descontoItemReais > 0) {
        const descontoAtualEmReais = converterDescontoEntreUnidades({
          valor: desconto,
          deUnidade: tipoDesconto === "PERCENTUAL" ? "PERCENTUAL" : "VALOR",
          paraUnidade: "VALOR",
          subtotal: resumo.subtotal,
        });
        setTipoDesconto("FIXO");
        setDesconto(descontoAtualEmReais + descontoItemReais);
      }

      // Leitor de codigo de barras "digita" no campo ativo — o foco precisa
      // voltar pra busca depois de cada insercao, senao o proximo produto
      // lido vai parar em qualquer campo que estiver focado.
      buscaProdutoRef.current?.focus();
    },
    [itens, adicionarItem, alterarQuantidade, desconto, tipoDesconto, resumo.subtotal, setDesconto, setTipoDesconto]
  );

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
            chaveIdempotencia: dados.chaveIdempotencia,
          })
        : await processarVenda(itensParaServidor, dados.pagamentos, {
            clienteId: clienteSelecionadoId || undefined,
            desconto: descontoParaServidor,
            chaveIdempotencia: dados.chaveIdempotencia,
          });

      // Venda salva com sucesso — limpa o carrinho/cliente/OS já aqui (o
      // modal de sucesso guarda o total/id da venda no próprio estado local,
      // não depende mais desses valores). A ETAPA só volta pra "produto"
      // quando o operador clicar "Nova venda" no modal de sucesso — ver
      // iniciarNovaTentativa.
      limparCarrinho();
      setClienteSelecionadoId("");
      setBuscaCliente("");
      setPedidoOS(null);

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

  const focarBuscaClienteEmSeguida = () => {
    setEtapaAtual("cliente");
    setTimeout(() => buscaClienteRef.current?.focus(), 80);
  };

  const pagamento = usePagamentoPdv({
    total: totalGeral,
    descontoAplicado: resumo.descontoAplicado,
    configuracaoPagamento: configuracaoPagamentosPdv,
    temClienteSelecionado: Boolean(clienteSelecionadoId),
    tentativaVendaId,
    aoConfirmar: aoConfirmarPagamento,
    aoPrecisarDeCliente: focarBuscaClienteEmSeguida,
  });

  // Boleto/crediário sem cliente real (Fase 3-2C — consumidor final): a
  // mesma trava autoritativa do servidor (processarVenda), checada aqui
  // proativamente pra bloquear o avanço da Etapa Cliente e mostrar o aviso
  // ANTES da tentativa de confirmar — ver components/pdv/balcao/etapa-cliente-pdv.tsx.
  const temPagamentoPrazoSelecionado = exigeClienteRealParaFinalizarVenda(pagamento.linhas, ehPagamentoPrazo);
  const precisaClienteRealEtapaCliente = !clienteSelecionadoId && temPagamentoPrazoSelecionado;

  const produtoEtapaCompleta = itens.length > 0 || Boolean(pedidoOS);
  const clienteEtapaCompleta = Boolean(clienteSelecionadoId) || !temPagamentoPrazoSelecionado;
  const pagamentoEtapaCompleta = pagamento.vendaFinalizada;

  const clienteResumo = clienteSelecionado
    ? clienteSelecionado.nomeRazaoSocial
    : DADOS_CLIENTE_CONSUMIDOR_FINAL.nomeRazaoSocial;

  const iniciarNovaTentativa = () => {
    limparCarrinho();
    setClienteSelecionadoId("");
    setBuscaCliente("");
    setPedidoOS(null);
    setEtapaAtual("produto");
    setDescontoPainelAberto(false);
    setTentativaVendaId((id) => id + 1);
    router.replace("/pdv");
  };

  const aoSelecionarCliente = (clienteId: string) => {
    setClienteSelecionadoId(clienteId);
    const cliente = clientes.find((c) => c.id === clienteId);
    setBuscaCliente(cliente ? cliente.nomeRazaoSocial : "");
  };

  const aoClienteCriado = (cliente: ClientePDV) => {
    setClientes((atual) => [cliente, ...atual]);
    setClienteSelecionadoId(cliente.id);
    setBuscaCliente(cliente.nomeRazaoSocial);
  };

  const aoVincularOS = useCallback(() => {
    toast.info(MENSAGEM_VINCULAR_OS);
  }, []);

  const tentarConfirmarVenda = useCallback(() => {
    if (itens.length === 0 && !pedidoOS) return;

    if (!caixaAberto) {
      toast.error("Abra o caixa para finalizar a venda.");
      return;
    }

    if (descontoBloqueiaVenda) {
      toast.error("Desconto acima do limite do seu cargo. Ajuste o desconto para continuar.");
      return;
    }

    pagamento.handleConfirmar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.length, pedidoOS, caixaAberto, descontoBloqueiaVenda, pagamento.handleConfirmar]);

  const aoClicarBotaoPrimario = () => {
    if (etapaAtual === "produto") {
      setEtapaAtual("cliente");
      return;
    }

    if (etapaAtual === "cliente") {
      if (precisaClienteRealEtapaCliente) {
        toast.error(MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO);
        return;
      }
      setEtapaAtual("pagamento");
      return;
    }

    tentarConfirmarVenda();
  };

  const rotuloBotaoPrimario =
    etapaAtual === "produto"
      ? "Ir para cliente"
      : etapaAtual === "cliente"
        ? "Ir para pagamento"
        : !caixaAberto
          ? "Abra o Caixa"
          : "Confirmar venda";

  const atalhoBotaoPrimario = etapaAtual === "produto" ? "Alt+2" : etapaAtual === "pagamento" ? "F9" : "";

  const botaoPrimarioDesabilitado =
    (etapaAtual === "produto" && !produtoEtapaCompleta) ||
    (etapaAtual === "cliente" && precisaClienteRealEtapaCliente) ||
    (etapaAtual === "pagamento" && (!caixaAberto || !pagamento.podeConfirmar || descontoBloqueiaVenda));

  const dicaBotaoPrimario =
    etapaAtual === "produto"
      ? "F2 busca produto · F4 vincula OS · Alt+2 vai pro cliente."
      : etapaAtual === "cliente"
        ? precisaClienteRealEtapaCliente
          ? MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO
          : "F3 busca cliente · Consumidor Final já está selecionado."
        : "F9 confirma a venda de qualquer etapa quando os pagamentos fecharem o total.";

  // Alt+1/2/3 trocam de etapa (navegação livre — não força sequência); F2
  // busca produto, F3 busca cliente, F4 vincula OS, F6 abre o desconto, F9
  // confirma a venda de qualquer etapa (leitor de código de barras "digita"
  // como teclado — o foco de F2 precisa voltar sempre pra lá; ver
  // onAdicionarProduto acima). *Ref existe porque este efeito só roda uma
  // vez ([]), mas as funções fecham sobre estado que muda a cada render.
  const tentarConfirmarVendaRef = useRef(tentarConfirmarVenda);
  useEffect(() => {
    tentarConfirmarVendaRef.current = tentarConfirmarVenda;
  });

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "F2") {
        evento.preventDefault();
        setEtapaAtual("produto");
        setTimeout(() => buscaProdutoRef.current?.focus(), 0);
      }
      if (evento.key === "F3") {
        evento.preventDefault();
        setEtapaAtual("cliente");
        setTimeout(() => buscaClienteRef.current?.focus(), 0);
      }
      if (evento.key === "F4") {
        evento.preventDefault();
        setEtapaAtual("produto");
        toast.info(MENSAGEM_VINCULAR_OS);
      }
      if (evento.key === "F6") {
        evento.preventDefault();
        setDescontoPainelAberto(true);
      }
      if (evento.key === "F9") {
        evento.preventDefault();
        tentarConfirmarVendaRef.current();
      }
      if (evento.altKey && evento.key === "1") {
        evento.preventDefault();
        setEtapaAtual("produto");
      }
      if (evento.altKey && evento.key === "2") {
        evento.preventDefault();
        setEtapaAtual("cliente");
      }
      if (evento.altKey && evento.key === "3") {
        evento.preventDefault();
        setEtapaAtual("pagamento");
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  const atualizarResumoCaixa = async () => {
    try {
      setCarregandoResumoCaixa(true);
      const resumoDia = await obterResumoCaixaDiario();
      setResumoCaixaDiario(resumoDia);
    } catch {
      toast.error("Nao foi possivel atualizar o resumo do caixa.");
    } finally {
      setCarregandoResumoCaixa(false);
    }
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
      // nao tem altura própria — ver o comentário original desta decisão no
      // histórico do arquivo (Fase PDV 3 etapas manteve a mesma disciplina).
      className="flex h-[calc(100vh-72px)] w-full flex-col gap-3.5 overflow-hidden bg-kx-fundo p-5 lg:h-[calc(100vh-104px)] lg:p-6 xl:h-[calc(100vh-120px)]"
    >
      {/* Cabeçalho */}
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <div className="flex flex-col gap-0.5">
          {caixaAbertoResumoTexto(caixaAberto, caixaAbertaDesde)}
          <span className="text-[21px] font-extrabold tracking-tight text-kx-texto">PDV · nova venda</span>
        </div>

        <div className="ml-auto flex flex-wrap gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-kx-botao"
            onClick={() => setConfirmarCancelamentoVendaAberto(true)}
            disabled={itens.length === 0 && !pedidoOS}
          >
            Cancelar venda
          </Button>

          {caixaAberto && !carregandoStatusCaixa ? (
            <Link
              href="/pdv/caixa"
              className="flex h-10 items-center rounded-kx-botao border border-kx-painel-borda px-4 text-sm font-semibold text-kx-texto hover:bg-kx-cartao"
            >
              <Lock className="h-4 w-4 mr-2" />
              Caixa e fechamento
            </Link>
          ) : (
            <Button type="button" variant="outline" className="h-10 rounded-kx-botao" disabled>
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

          {!caixaAberto && !carregandoStatusCaixa && (
            <Button type="button" variant="secondary" className="h-10 rounded-kx-botao" onClick={() => setModalAbrirCaixaAberto(true)}>
              <Wallet className="h-4 w-4 mr-2" />
              Abrir Caixa
            </Button>
          )}

          <Button type="button" variant="secondary" className="h-10 rounded-kx-botao" onClick={() => setSheetResumoAberto(true)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Resumo do Dia
          </Button>
        </div>
      </div>

      <div className="shrink-0">
        <BarraEtapasPdv
          etapaAtual={etapaAtual}
          quantidadeItens={itens.length}
          clienteResumo={clienteResumo}
          totalFormatado={formatarMoeda(totalGeral)}
          produtoCompleta={produtoEtapaCompleta}
          clienteCompleta={clienteEtapaCompleta}
          pagamentoCompleta={pagamentoEtapaCompleta}
          onEscolher={setEtapaAtual}
        />
      </div>

      {etapaAtual === "produto" ? (
        // Etapa Produto (modelo Bling): sem a coluna "Resumo da venda" ao
        // lado — o rodapé (cliente/desconto/total/botão) fica embutido no
        // próprio painel de itens, então o total NUNCA aparece duas vezes
        // nesta etapa (mesma regra que já valia pra ResumoVendaPdv, ver o
        // comentário lá). As etapas Cliente/Pagamento (branch abaixo)
        // continuam exatamente como estavam, com a coluna à parte.
        <section className="grid min-h-0 flex-1 grid-cols-1">
          <EtapaProdutoPdv
            busca={busca}
            onBuscaChange={setBusca}
            buscaProdutoRef={buscaProdutoRef}
            produtosFiltrados={produtosFiltrados}
            carregandoProdutos={carregandoProdutos}
            itens={itens}
            onInserirItem={onInserirItemProduto}
            onRemover={(item) => removerItem(item.id)}
            onVincularOS={aoVincularOS}
            pedidoOS={pedidoOS}
            carregandoPedidoOS={carregandoPedidoOS}
            clienteResumo={clienteResumo}
            total={totalGeral}
            rotuloBotaoPrimario={rotuloBotaoPrimario}
            atalhoBotaoPrimario={atalhoBotaoPrimario}
            botaoPrimarioDesabilitado={botaoPrimarioDesabilitado}
            onClickBotaoPrimario={aoClicarBotaoPrimario}
            configuracaoPagamentosPdv={configuracaoPagamentosPdv}
            desconto={desconto}
            tipoDesconto={tipoDesconto}
            subtotalGlobal={resumo.subtotal + (pedidoOS?.valor ?? 0)}
            limiteDesconto={limiteDesconto}
            descontoBloqueiaVenda={descontoBloqueiaVenda}
            descontoTextoEmEdicao={descontoTextoEmEdicao}
            onTextoEmEdicaoChange={setDescontoTextoEmEdicao}
            onDescontoChange={setDesconto}
            onTipoDescontoChange={setTipoDesconto}
            descontoPainelAberto={descontoPainelAberto}
            onDescontoPainelAbertoChange={setDescontoPainelAberto}
          />
        </section>
      ) : (
        <section className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 lg:p-5">
            {etapaAtual === "cliente" && (
              <EtapaClientePdv
                buscaCliente={buscaCliente}
                onBuscaClienteChange={setBuscaCliente}
                buscaClienteRef={buscaClienteRef}
                clientesFiltrados={clientesFiltrados}
                carregandoClientes={carregandoClientes}
                clienteSelecionadoId={clienteSelecionadoId}
                onSelecionarCliente={aoSelecionarCliente}
                onClienteCriado={aoClienteCriado}
                precisaClienteReal={precisaClienteRealEtapaCliente}
              />
            )}

            {etapaAtual === "pagamento" && <EtapaPagamentoPdv pagamento={pagamento} />}
          </div>

          <ResumoVendaPdv
            quantidadeItens={itens.length}
            subtotal={resumo.subtotal + (pedidoOS?.valor ?? 0)}
            descontoAplicado={resumo.descontoAplicado}
            clienteResumo={clienteResumo}
            total={totalGeral}
            dica={dicaBotaoPrimario}
            rotuloBotaoPrimario={rotuloBotaoPrimario}
            atalhoBotaoPrimario={atalhoBotaoPrimario}
            botaoPrimarioDesabilitado={botaoPrimarioDesabilitado}
            botaoPrimarioProcessando={etapaAtual === "pagamento" && pagamento.processando}
            onClickBotaoPrimario={aoClicarBotaoPrimario}
            configuracaoPagamentosPdv={configuracaoPagamentosPdv}
            desconto={desconto}
            tipoDesconto={tipoDesconto}
            limiteDesconto={limiteDesconto}
            descontoBloqueiaVenda={descontoBloqueiaVenda}
            descontoTextoEmEdicao={descontoTextoEmEdicao}
            onTextoEmEdicaoChange={setDescontoTextoEmEdicao}
            onDescontoChange={setDesconto}
            onTipoDescontoChange={setTipoDesconto}
            descontoPainelAberto={descontoPainelAberto}
            onDescontoPainelAbertoChange={setDescontoPainelAberto}
          />
        </section>
      )}

      <ModalVendaConcluidaPdv
        aberto={pagamento.vendaFinalizada}
        vendaIdGerada={pagamento.vendaIdGerada}
        totalVendaFinalizada={pagamento.totalVendaFinalizada}
        aoNovaVenda={iniciarNovaTentativa}
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

      <AlertDialog open={confirmarCancelamentoVendaAberto} onOpenChange={setConfirmarCancelamentoVendaAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda</AlertDialogTitle>
            <AlertDialogDescription>
              Isso limpa todos os itens, o cliente selecionado e a OS vinculada, voltando pro passo 1 vazio. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                iniciarNovaTentativa();
                setConfirmarCancelamentoVendaAberto(false);
                toast.success("Venda cancelada.");
              }}
            >
              Cancelar venda
            </AlertDialogAction>
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
