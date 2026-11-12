"use client";

import { useState } from "react";
import {
  Banknote,
  Check,
  CreditCard,
  Loader2,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Printer,
  QrCode,
  ScanBarcode,
  Search,
  Trash2,
  UserPlus,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import type { ClientePDV, PedidoOSPDV } from "@/app/actions/pdv";
import { CadastroRapidoDoCliente } from "@/components/crm/cadastro-rapido-cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeitorCamera } from "@/components/ui/leitor-camera";
import { produtoPeloCodigoLido } from "@/lib/dominio/estoque/codigo-lido";
import {
  filtrarClientes,
  filtrarProdutos,
  MENSAGEM_DA_PENDENCIA,
  pendenciaDaVendaNoCelular,
  type PendenciaDaVenda,
} from "@/lib/dominio/pdv/pdv-celular";
import type { ResultadoUsePagamentoPdv } from "@/lib/pdv/hooks/usar-pagamento-pdv";
import {
  formatarDecimalPtBr,
  formatarMoeda,
  formatarRotuloParcelas,
  rotuloFormaPagamentoCurto,
} from "@/lib/pdv/formatacao-pagamento-pdv";
import type { FormaPagamentoPdv } from "@/lib/pdv/pagamentos";
import { cn } from "@/lib/utils";
import type { ItemCarrinho, ProdutoPDV } from "@/store/useCartStore";

type ProdutoDoCatalogo = ProdutoPDV & { sku?: string | null };

const CAMPO =
  "h-12 rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3.5 text-base text-kx-texto placeholder:text-kx-placeholder";

const ICONE_DA_FORMA: Partial<Record<FormaPagamentoPdv, typeof Wallet>> = {
  PIX: QrCode,
  DINHEIRO: Banknote,
  CARTAO_DEBITO: CreditCard,
  CARTAO_CREDITO: CreditCard,
};

export type PropsPdvCelular = {
  caixaAberto: boolean;
  carregandoStatusCaixa: boolean;
  onAbrirCaixa: () => void;

  clientes: ClientePDV[];
  carregandoClientes: boolean;
  clienteSelecionado: ClientePDV | null;
  onSelecionarCliente: (id: string) => void;
  onClienteCriado: (cliente: ClientePDV) => void;

  produtosCatalogo: ProdutoDoCatalogo[];
  carregandoProdutos: boolean;
  itens: ItemCarrinho[];
  onAdicionarProduto: (produto: ProdutoPDV) => void;
  onAlterarQuantidade: (id: string, quantidade: number) => void;
  onRemoverItem: (id: string) => void;
  pedidoOS: PedidoOSPDV | null;

  total: number;
  pagamento: ResultadoUsePagamentoPdv;
  onFinalizar: () => void;
  onNovaVenda: () => void;
};

/**
 * PDV no celular: uma tela so, de cima para baixo — cliente, itens (pela
 * camera ou pela busca), pagamento — e o botao de finalizar sempre a vista
 * no rodape. Toda a regra de venda (calculo, idempotencia, caixa) e a mesma
 * do balcao do computador: esta tela so troca o desenho, recebendo o estado
 * da pagina do PDV.
 */
export function PdvCelular(props: PropsPdvCelular) {
  const { pagamento } = props;
  // A forma vem pre-escolhida pelo hook (a primeira habilitada). No celular
  // a pessoa precisa tocar numa: venda cobrada no PIX que era em dinheiro
  // desarruma o caixa do dia.
  const [formaTocada, setFormaTocada] = useState(false);

  if (pagamento.vendaFinalizada) {
    return (
      <VendaConcluida
        vendaId={pagamento.vendaIdGerada}
        total={pagamento.totalVendaFinalizada}
        telefoneCliente={props.clienteSelecionado?.telefone ?? null}
        onNovaVenda={() => {
          setFormaTocada(false);
          props.onNovaVenda();
        }}
      />
    );
  }

  const pendencia = pendenciaDaVendaNoCelular({
    clienteId: props.clienteSelecionado?.id ?? "",
    quantidadeItens: props.itens.length,
    temOS: Boolean(props.pedidoOS),
    caixaAberto: props.caixaAberto,
    pagamentoFechado: formaTocada && pagamento.podeConfirmar,
  });

  const finalizar = () => {
    if (pendencia) {
      mostrarPendencia(pendencia);
      return;
    }
    props.onFinalizar();
  };

  return (
    <div className="flex min-h-full flex-col bg-kx-fundo">
      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold tracking-tight text-kx-texto">Nova venda</h1>
          {!props.carregandoStatusCaixa && !props.caixaAberto ? (
            <Button type="button" variant="secondary" className="h-10" onClick={props.onAbrirCaixa}>
              <Wallet className="h-4 w-4" />
              Abrir caixa
            </Button>
          ) : null}
        </div>

        {!props.carregandoStatusCaixa && !props.caixaAberto ? (
          <p id="pdv-cel-caixa" role="status" className="rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo px-3.5 py-2.5 text-sm text-kx-alerta-texto">
            O caixa está fechado. Abra o caixa para finalizar vendas.
          </p>
        ) : null}

        <Bloco id="pdv-cel-cliente" titulo="Cliente" obrigatorio>
          <ClienteDaVenda {...props} />
        </Bloco>

        <Bloco id="pdv-cel-itens" titulo="Itens">
          <ItensDaVenda {...props} />
        </Bloco>

        <Bloco id="pdv-cel-pagamento" titulo="Forma de pagamento">
          <PagamentoDaVenda
            pagamento={pagamento}
            total={props.total}
            formaTocada={formaTocada}
            onTocarForma={(forma) => {
              setFormaTocada(true);
              // A linha unica ja nesta forma (a pre-escolhida): so confirma.
              // Reaplicar faria o hook avisar "forma ja adicionada".
              const unica = pagamento.linhas.length === 1 ? pagamento.linhas[0] : null;
              if (unica?.formaPagamento === forma) return;
              pagamento.aplicarFormaRapida(forma);
            }}
          />
        </Bloco>
      </div>

      <footer className="sticky bottom-0 z-kx-sticky border-t border-kx-painel-borda bg-kx-painel px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-kx-texto-2">Total</span>
          <span className="text-2xl font-extrabold tabular-nums text-kx-texto">{formatarMoeda(props.total)}</span>
        </div>
        <Button
          type="button"
          className="h-12 w-full text-base font-bold"
          disabled={pagamento.processando}
          onClick={finalizar}
        >
          {pagamento.processando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Check className="h-5 w-5" aria-hidden />}
          {pagamento.processando ? "Finalizando…" : "Finalizar venda"}
        </Button>
      </footer>
    </div>
  );
}

function mostrarPendencia(pendencia: PendenciaDaVenda) {
  toast.error(MENSAGEM_DA_PENDENCIA[pendencia]);
  const alvo = pendencia === "caixa" ? "pdv-cel-caixa" : `pdv-cel-${pendencia}`;
  document.getElementById(alvo)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function Bloco({
  id,
  titulo,
  obrigatorio = false,
  children,
}: {
  id: string;
  titulo: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="flex flex-col gap-2.5">
      <h2 id={`${id}-titulo`} className="text-sm font-bold text-kx-texto">
        {titulo}
        {obrigatorio ? (
          <span className="ml-1 text-kx-erro-texto" aria-hidden>
            *
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cliente                                                             */
/* ------------------------------------------------------------------ */

function ClienteDaVenda({
  clientes,
  carregandoClientes,
  clienteSelecionado,
  onSelecionarCliente,
  onClienteCriado,
  pedidoOS,
}: PropsPdvCelular) {
  const [termo, setTermo] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const encontrados = filtrarClientes(clientes, termo);

  if (clienteSelecionado) {
    return (
      <div className="flex items-center gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-kx-texto">{clienteSelecionado.nomeRazaoSocial}</p>
          <p className="text-sm text-kx-legenda">{clienteSelecionado.telefone}</p>
        </div>
        {/* Venda de OS: o cliente e o da OS, nao se troca aqui. */}
        {!pedidoOS ? (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => {
              setTermo("");
              onSelecionarCliente("");
            }}
          >
            Trocar
          </Button>
        ) : null}
      </div>
    );
  }

  if (cadastrando) {
    return (
      <CadastroRapidoDoCliente
        nomeInicial={termo.trim()}
        classeDoCampo={CAMPO}
        onCancelar={() => setCadastrando(false)}
        onCadastrado={(cliente) => {
          setCadastrando(false);
          onClienteCriado(cliente);
        }}
      />
    );
  }

  const buscando = termo.trim().length >= 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda" aria-hidden />
        <Input
          className={cn(CAMPO, "pl-10")}
          placeholder={carregandoClientes ? "Carregando clientes…" : "Nome, telefone ou CPF"}
          aria-label="Buscar cliente"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>

      {buscando && encontrados.length > 0 ? (
        <ul aria-label="Clientes encontrados" className="flex flex-col overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-painel">
          {encontrados.map((cliente) => (
            <li key={cliente.id} className="border-b border-kx-painel-borda last:border-b-0">
              <button
                type="button"
                className="flex min-h-12 w-full flex-col items-start px-3.5 py-2.5 text-left hover:bg-kx-superficie focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kx-foco"
                onClick={() => onSelecionarCliente(cliente.id)}
              >
                <span className="text-base font-medium text-kx-texto">{cliente.nomeRazaoSocial}</span>
                <span className="text-sm text-kx-legenda">{[cliente.telefone, cliente.documento].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {buscando && !carregandoClientes && encontrados.length === 0 ? (
        <p className="text-sm text-kx-legenda">Nenhum cliente com “{termo.trim()}”.</p>
      ) : null}

      <Button type="button" variant="outline" className="h-11 justify-start" onClick={() => setCadastrando(true)}>
        <UserPlus className="h-4 w-4" />
        {buscando && encontrados.length === 0 ? `Cadastrar “${termo.trim()}”` : "Cliente novo"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Itens                                                               */
/* ------------------------------------------------------------------ */

function FotoDoProduto({ url, nome }: { url?: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-kx-botao border border-kx-painel-borda bg-kx-superficie">
      {url && !falhou ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto do cadastro do produto, de qualquer endereco.
        <img src={url} alt={nome} className="h-full w-full object-cover" onError={() => setFalhou(true)} />
      ) : (
        <Package className="h-6 w-6 text-kx-legenda" aria-hidden />
      )}
    </span>
  );
}

function codigoDoProduto(produto: ProdutoDoCatalogo): string | null {
  return produto.codigoBarras || produto.sku || null;
}

function ItensDaVenda({
  produtosCatalogo,
  carregandoProdutos,
  itens,
  onAdicionarProduto,
  onAlterarQuantidade,
  onRemoverItem,
  pedidoOS,
}: PropsPdvCelular) {
  const [leitorAberto, setLeitorAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const resultados = filtrarProdutos(produtosCatalogo, termo);

  const adicionar = (produto: ProdutoPDV) => {
    onAdicionarProduto(produto);
    setTermo("");
  };

  const aoLer = (texto: string) => {
    const produto = produtoPeloCodigoLido(produtosCatalogo, texto);
    if (produto) {
      onAdicionarProduto(produto);
      toast.success(`${produto.nome} adicionado`);
      return;
    }
    // O catalogo do PDV so traz o que esta a venda — as duas causas possiveis.
    toast.error(`Código ${texto}: produto não cadastrado ou sem estoque.`);
  };

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" className="h-14 text-base font-bold" onClick={() => setLeitorAberto(true)} disabled={carregandoProdutos}>
        <ScanBarcode className="h-6 w-6" aria-hidden />
        {carregandoProdutos ? "Carregando produtos…" : "Ler código de barras"}
      </Button>
      <LeitorCamera
        aberto={leitorAberto}
        onFechar={() => setLeitorAberto(false)}
        continuo
        titulo="Ler etiqueta"
        instrucao="Aponte para o código de barras. Cada produto lido entra na venda; o leitor continua aberto para o próximo."
        onLido={aoLer}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda" aria-hidden />
        <Input
          className={cn(CAMPO, "pl-10")}
          placeholder="Ou busque por nome ou código"
          aria-label="Buscar produto"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>

      {termo.trim().length >= 2 ? (
        resultados.length > 0 ? (
          <ul aria-label="Produtos encontrados" className="flex flex-col overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-painel">
            {resultados.map((produto) => (
              <li key={produto.id} className="border-b border-kx-painel-borda last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-kx-superficie focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kx-foco"
                  onClick={() => adicionar(produto)}
                >
                  <FotoDoProduto url={produto.imagemUrl} nome={produto.nome} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-kx-texto">{produto.nome}</span>
                    <span className="block text-xs text-kx-legenda">
                      {[codigoDoProduto(produto), produto.quantidadeEstoque != null ? `estoque ${produto.quantidadeEstoque}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-base font-semibold tabular-nums text-kx-texto">{formatarMoeda(produto.preco)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-kx-legenda">Nenhum produto à venda com “{termo.trim()}”.</p>
        )
      ) : null}

      {pedidoOS ? (
        <div className="flex items-center gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel px-3 py-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-kx-botao bg-kx-conserto-fundo">
            <Wrench className="h-6 w-6 text-kx-conserto-texto" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-kx-texto">OS #{pedidoOS.numeroOs}</span>
            <span className="block truncate text-sm text-kx-legenda">{pedidoOS.aparelho}</span>
          </span>
          <span className="text-base font-semibold tabular-nums text-kx-texto">{formatarMoeda(pedidoOS.valor)}</span>
        </div>
      ) : null}

      {itens.length > 0 ? (
        <ul aria-label="Itens da venda" className="flex flex-col gap-2">
          {itens.map((item) => {
            const codigo = codigoDoProduto(item as ProdutoDoCatalogo);
            return (
              <li key={item.id} className="flex flex-col gap-2.5 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-3">
                <div className="flex items-start gap-3">
                  <FotoDoProduto url={item.imagemUrl} nome={item.nome} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug text-kx-texto">{item.nome}</p>
                    <p className="text-xs text-kx-legenda">{codigo ? `Cód. ${codigo}` : "Sem código"}</p>
                    <p className="text-sm text-kx-texto-2">{formatarMoeda(item.preco)} cada</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`Remover ${item.nome}`}
                    onClick={() => onRemoverItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-kx-botao border border-kx-campo-borda">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label={`Diminuir ${item.nome}`}
                      disabled={item.quantidade <= 1}
                      onClick={() => onAlterarQuantidade(item.id, item.quantidade - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="min-w-10 text-center text-base font-bold tabular-nums text-kx-texto" aria-live="polite">
                      {item.quantidade}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label={`Aumentar ${item.nome}`}
                      onClick={() => onAlterarQuantidade(item.id, item.quantidade + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-kx-texto">{formatarMoeda(item.subtotal)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : !pedidoOS ? (
        <p className="rounded-kx-cartao border border-dashed border-kx-campo-borda px-4 py-5 text-center text-sm text-kx-legenda">
          Nenhum item ainda. Leia a etiqueta com a câmera ou busque o produto.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagamento                                                           */
/* ------------------------------------------------------------------ */

function PagamentoDaVenda({
  pagamento,
  total,
  formaTocada,
  onTocarForma,
}: {
  pagamento: ResultadoUsePagamentoPdv;
  total: number;
  formaTocada: boolean;
  onTocarForma: (forma: FormaPagamentoPdv) => void;
}) {
  const linha = pagamento.linhas[0] ?? null;
  const formaAtual = formaTocada && linha ? linha.formaPagamento : null;
  const maxParcelas = pagamento.configuracaoAtiva.maxParcelasCartaoCredito;

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2">
        {pagamento.formasPagamentoDisponiveis.map((opcao) => {
          const ativa = formaAtual === opcao.formaPagamento;
          const Icone = ICONE_DA_FORMA[opcao.formaPagamento] ?? Wallet;
          return (
            <button
              key={opcao.formaPagamento}
              type="button"
              role="radio"
              aria-checked={ativa}
              onClick={() => onTocarForma(opcao.formaPagamento)}
              className={cn(
                "flex min-h-14 items-center gap-2.5 rounded-kx-botao border px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco",
                ativa
                  ? "border-transparent bg-kx-primaria text-primary-foreground"
                  : "border-kx-painel-borda bg-kx-painel text-kx-texto"
              )}
            >
              <Icone className="h-5 w-5 shrink-0" aria-hidden />
              {rotuloFormaPagamentoCurto(opcao.formaPagamento)}
            </button>
          );
        })}
      </div>

      {formaAtual === "CARTAO_CREDITO" && linha ? (
        <div className="flex items-center justify-between gap-3 rounded-kx-cartao bg-kx-superficie p-3">
          <div>
            <p className="text-sm font-semibold text-kx-texto">Parcelas</p>
            <p className="text-xs text-kx-legenda">{formatarRotuloParcelas(linha.valorBruto, linha.parcelas)}</p>
          </div>
          <div className="flex items-center rounded-kx-botao border border-kx-campo-borda bg-kx-painel">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label="Menos parcelas"
              disabled={linha.parcelas <= 1}
              onClick={() => pagamento.editarPagamento(linha.id, { parcelas: Math.max(1, linha.parcelas - 1) })}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-12 text-center text-base font-bold tabular-nums text-kx-texto">{linha.parcelas}x</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label="Mais parcelas"
              disabled={linha.parcelas >= maxParcelas}
              onClick={() => pagamento.editarPagamento(linha.id, { parcelas: Math.min(maxParcelas, linha.parcelas + 1) })}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {formaAtual === "DINHEIRO" ? (
        <div className="flex flex-col gap-2.5 rounded-kx-cartao bg-kx-superficie p-3">
          <label htmlFor="pdv-cel-recebido" className="text-sm font-semibold text-kx-texto">
            Valor recebido
          </label>
          <Input
            id="pdv-cel-recebido"
            inputMode="decimal"
            className={CAMPO}
            value={pagamento.valorRecebidoEmEdicao ?? formatarDecimalPtBr(pagamento.valorRecebidoDinheiro)}
            placeholder="0,00"
            onChange={(e) => pagamento.digitarValorRecebido(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {[total, 50, 100, 200]
              .filter((valor, i, lista) => valor > 0 && lista.indexOf(valor) === i)
              .map((valor, i) => (
                <Button key={valor} type="button" variant="outline" className="h-10" onClick={() => pagamento.aplicarAtalhoValorRecebido(valor)}>
                  {i === 0 ? "Valor exato" : formatarMoeda(valor)}
                </Button>
              ))}
          </div>
          <p className="flex items-baseline justify-between text-sm">
            <span className="text-kx-texto-2">Troco</span>
            <span className={cn("text-lg font-bold tabular-nums", pagamento.troco > 0 ? "text-kx-sucesso-texto" : "text-kx-texto")}>
              {formatarMoeda(pagamento.troco)}
            </span>
          </p>
        </div>
      ) : null}

      {formaTocada && !pagamento.estadoFechamento.podeConfirmar ? (
        <p role="alert" className="text-sm font-medium text-kx-alerta-texto">
          {pagamento.estadoFechamento.mensagem}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Venda concluida                                                     */
/* ------------------------------------------------------------------ */

function VendaConcluida({
  vendaId,
  total,
  telefoneCliente,
  onNovaVenda,
}: {
  vendaId: string | null;
  total: number;
  telefoneCliente: string | null;
  onNovaVenda: () => void;
}) {
  const urlRecibo = vendaId ? `/recibo/${vendaId}` : null;
  // WhatsApp direto para o cliente quando ha telefone; senao, a pessoa escolhe o contato.
  const numero = (telefoneCliente ?? "").replace(/\D/g, "");
  const destino =
    numero.length === 10 || numero.length === 11
      ? `55${numero}`
      : numero.startsWith("55") && (numero.length === 12 || numero.length === 13)
        ? numero
        : "";
  const texto = encodeURIComponent(
    `Olá! Obrigado pela compra. Total: ${formatarMoeda(total)}${vendaId ? ` · Venda #${vendaId.slice(0, 8)}` : ""}`
  );

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-kx-fundo px-6 py-10 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-kx-sucesso-fundo">
        <Check className="h-10 w-10 text-kx-sucesso-texto" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-kx-texto">Venda finalizada</h1>
        <p className="text-3xl font-extrabold tabular-nums text-kx-texto">{formatarMoeda(total)}</p>
        {vendaId ? <p className="text-sm text-kx-legenda">Comprovante #{vendaId.slice(0, 8)}</p> : null}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button
          type="button"
          className="h-14 text-base font-bold"
          disabled={!urlRecibo}
          onClick={() => urlRecibo && window.open(`${urlRecibo}?autoprint=1`, "_blank", "noopener,noreferrer")}
        >
          <Printer className="h-5 w-5" aria-hidden />
          Imprimir recibo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => window.open(`https://wa.me/${destino}?text=${texto}`, "_blank", "noopener,noreferrer")}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          Enviar pelo WhatsApp
        </Button>
        <Button type="button" variant="secondary" className="h-12" onClick={onNovaVenda}>
          Nova venda
        </Button>
      </div>
    </div>
  );
}
