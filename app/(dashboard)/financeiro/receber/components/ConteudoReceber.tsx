"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MoreHorizontal, Plus, Pencil, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ClienteBuscaCRM } from "@/app/actions/crm";
import {
  criarContaReceber,
  darBaixaConta,
  editarContaReceber,
  excluirContaReceber,
  type ContaReceberFinanceiro,
} from "@/app/actions/financeiro-receber";
import { SeletorClienteCRM } from "@/components/financeiro/seletor-cliente-crm";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ── Tipos e constantes ───────────────────────────────────────────────────────

type StatusExibicao = "PENDENTE" | "ATRASADO" | "RECEBIDO";
type PilulaFiltro = "ABERTO" | "ATRASADOS" | "RECEBIDOS" | "TODOS";

const FORMA_RECEBIMENTO_INICIAL: ContaReceberFinanceiro["formaRecebimento"] = "PIX";

const MAPA_FORMA_PAGAMENTO: Record<ContaReceberFinanceiro["formaRecebimento"], string> = {
  PIX: "PIX",
  TED: "TED",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_CREDITO_AVISTA: "Cartão de Crédito (À vista)",
  CARTAO_CREDITO_PARCELADO: "Cartão de Crédito (Parcelado)",
  CARTAO_DEBITO: "Cartão de Débito",
  DINHEIRO: "Dinheiro",
  CREDIARIO: "Crediário",
  EMPENHO_PUBLICO: "Empenho Público",
};

const PILULAS: { chave: PilulaFiltro; rotulo: string }[] = [
  { chave: "ABERTO", rotulo: "Em aberto" },
  { chave: "ATRASADOS", rotulo: "Atrasados" },
  { chave: "RECEBIDOS", rotulo: "Recebidos" },
  { chave: "TODOS", rotulo: "Todos" },
];

interface FormNovaConta {
  descricao: string;
  valorTotal: string;
  qtdParcelas: string;
  dataInicio: string;
  dataVencimentoPrimeiraParcela: string;
  formaRecebimento: ContaReceberFinanceiro["formaRecebimento"];
  observacaoLancamento: string;
}

const FORM_INICIAL: FormNovaConta = {
  descricao: "",
  valorTotal: "",
  qtdParcelas: "1",
  dataInicio: format(new Date(), "yyyy-MM-dd"),
  dataVencimentoPrimeiraParcela: format(new Date(), "yyyy-MM-dd"),
  formaRecebimento: FORMA_RECEBIMENTO_INICIAL,
  observacaoLancamento: "",
};

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Helpers ──────────────────────────────────────────────────────────────────

function obterStatusExibicao(conta: ContaReceberFinanceiro, inicioDiaAtual: Date): StatusExibicao {
  if (conta.status === "RECEBIDO") return "RECEBIDO";
  if (new Date(conta.dataVencimento) < inicioDiaAtual) return "ATRASADO";
  return "PENDENTE";
}

function pilulaDoStatus(status: StatusExibicao) {
  if (status === "RECEBIDO") return <PilulaStatus variante="sucesso">Recebido</PilulaStatus>;
  if (status === "ATRASADO") return <PilulaStatus variante="erro">Atrasado</PilulaStatus>;
  return <PilulaStatus variante="alerta">Pendente</PilulaStatus>;
}

// ── Componente ───────────────────────────────────────────────────────────────

interface ConteudoReceberProps {
  contas: ContaReceberFinanceiro[];
}

/**
 * Tabela + painel lateral de Contas a Receber (Fase 3-2D, Parte 2). "Dar
 * baixa" era um Dialog aberto pelo menu da linha; agora é um painel fixo à
 * direita (aside "Dar baixa" da referência) que carrega ao clicar na linha —
 * mesma action `darBaixaConta` e mesma validação de antes, só o layout mudou.
 */
export function ConteudoReceber({ contas }: ConteudoReceberProps) {
  const router = useRouter();

  const inicioDiaAtual = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const podeLancar = useTemPermissao("financeiro.lancar");
  const podeBaixar = useTemPermissao("financeiro.baixar");
  const podeEditar = useTemPermissao("financeiro.editar");
  const podeExcluir = useTemPermissao("financeiro.excluir");

  const [pilulaAtiva, setPilulaAtiva] = useState<PilulaFiltro>("ABERTO");

  // Painel "Dar baixa"
  const [contaSelecionadaId, setContaSelecionadaId] = useState<string | null>(null);
  const [observacaoBaixa, setObservacaoBaixa] = useState("");
  const [baixandoConta, setBaixandoConta] = useState(false);

  // Dialog: Editar
  const [contaEditando, setContaEditando] = useState<ContaReceberFinanceiro | null>(null);
  const [formEdicao, setFormEdicao] = useState({ dataVencimento: "", valor: "" });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Dialog: Detalhes
  const [contaDetalhes, setContaDetalhes] = useState<ContaReceberFinanceiro | null>(null);

  // Dialog: Excluir
  const [contaParaExcluir, setContaParaExcluir] = useState<ContaReceberFinanceiro | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [dialogNovaContaAberto, setDialogNovaContaAberto] = useState(false);
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBuscaCRM | null>(null);
  const [formNovaConta, setFormNovaConta] = useState<FormNovaConta>(FORM_INICIAL);

  const contasComStatus = useMemo(
    () => contas.map((conta) => ({ conta, status: obterStatusExibicao(conta, inicioDiaAtual) })),
    [contas, inicioDiaAtual]
  );

  const contasFiltradas = useMemo(() => {
    if (pilulaAtiva === "TODOS") return contasComStatus;
    if (pilulaAtiva === "ABERTO") return contasComStatus.filter((c) => c.status !== "RECEBIDO");
    if (pilulaAtiva === "ATRASADOS") return contasComStatus.filter((c) => c.status === "ATRASADO");
    return contasComStatus.filter((c) => c.status === "RECEBIDO");
  }, [contasComStatus, pilulaAtiva]);

  const contaSelecionada = contas.find((c) => c.id === contaSelecionadaId) ?? null;

  // ── Handlers: Dar Baixa ──────────────────────────────────────────────────

  async function confirmarBaixa() {
    if (!contaSelecionada) return;
    try {
      setBaixandoConta(true);
      const resultado = await darBaixaConta(contaSelecionada.id, observacaoBaixa);
      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }
      toast.success("Conta baixada com sucesso.");
      setContaSelecionadaId(null);
      setObservacaoBaixa("");
      router.refresh();
    } catch {
      toast.error("Não foi possível dar baixa nesta conta.");
    } finally {
      setBaixandoConta(false);
    }
  }

  // ── Handlers: Editar Conta ───────────────────────────────────────────────

  function abrirEdicao(conta: ContaReceberFinanceiro) {
    setContaEditando(conta);
    setFormEdicao({
      dataVencimento: format(new Date(conta.dataVencimento), "yyyy-MM-dd"),
      valor: String(conta.valor),
    });
  }

  async function salvarEdicao() {
    if (!contaEditando) return;
    const valorNumero = Number(String(formEdicao.valor).replace(",", "."));
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!formEdicao.dataVencimento) {
      toast.error("Informe a data de vencimento.");
      return;
    }
    try {
      setSalvandoEdicao(true);
      const resultado = await editarContaReceber(contaEditando.id, {
        dataVencimento: new Date(`${formEdicao.dataVencimento}T12:00:00`),
        valor: valorNumero,
      });
      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }
      toast.success("Conta atualizada com sucesso.");
      setContaEditando(null);
      router.refresh();
    } catch {
      toast.error("Não foi possível atualizar a conta.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  // ── Handlers: Excluir Conta ──────────────────────────────────────────────

  async function confirmarExclusao() {
    if (!contaParaExcluir) return;
    try {
      setExcluindo(true);
      const resultado = await excluirContaReceber(contaParaExcluir.id);
      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }
      toast.success("Conta excluída com sucesso.");
      setContaParaExcluir(null);
      if (contaSelecionadaId === contaParaExcluir.id) setContaSelecionadaId(null);
      router.refresh();
    } catch {
      toast.error("Não foi possível excluir a conta.");
    } finally {
      setExcluindo(false);
    }
  }

  // ── Handlers: Nova Conta a Receber ───────────────────────────────────────

  function abrirNovaConta() {
    setFormNovaConta(FORM_INICIAL);
    setClienteSelecionado(null);
    setDialogNovaContaAberto(true);
  }

  async function salvarNovaConta() {
    const valorTotalNumero = Number(formNovaConta.valorTotal.replace(",", "."));
    const qtdParcelasNumero = Math.max(1, Math.trunc(Number(formNovaConta.qtdParcelas || "1")));

    if (!formNovaConta.descricao.trim()) {
      toast.error("Preencha a descrição da conta.");
      return;
    }
    if (!Number.isFinite(valorTotalNumero) || valorTotalNumero <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!clienteSelecionado) {
      toast.error("Selecione a pessoa no CRM para registrar a conta.");
      return;
    }

    try {
      setSalvandoConta(true);
      const resultado = await criarContaReceber({
        descricao: formNovaConta.descricao,
        valorTotal: valorTotalNumero,
        clienteId: clienteSelecionado.id,
        qtdParcelas: qtdParcelasNumero,
        dataInicio: new Date(`${formNovaConta.dataInicio}T12:00:00`),
        dataVencimentoPrimeiraParcela: new Date(`${formNovaConta.dataVencimentoPrimeiraParcela}T12:00:00`),
        formaRecebimento: formNovaConta.formaRecebimento,
        observacaoLancamento: formNovaConta.observacaoLancamento,
      });
      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }
      toast.success("Conta a receber registrada com sucesso.");
      setDialogNovaContaAberto(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível registrar a conta a receber.");
    } finally {
      setSalvandoConta(false);
    }
  }

  // ── Renderização ─────────────────────────────────────────────────────────

  return (
    <>
      {/* min-[1400px], nao xl (1280px): com o paineel de 340px ao lado, as
          colunas fixas da tabela (parcela/vencimento/valor/situacao = ~480px
          + gaps) nao deixam quase nada pra "Cliente / origem" a 1280px —
          empilha em vez de espremer. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto min-[1400px]:overflow-hidden min-[1400px]:grid-cols-[1fr_340px]">
        <div className="flex min-h-0 flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
          <div className="flex flex-wrap items-center gap-2">
            {PILULAS.map((pilula) => (
              <button
                key={pilula.chave}
                type="button"
                onClick={() => setPilulaAtiva(pilula.chave)}
                aria-pressed={pilulaAtiva === pilula.chave}
                className={`h-9 shrink-0 rounded-kx-pilula border px-4 text-sm font-bold transition-colors ${
                  pilulaAtiva === pilula.chave
                    ? "border-kx-primaria bg-kx-primaria text-primary-foreground"
                    : "border-kx-painel-borda bg-kx-superficie text-kx-texto-2 hover:border-kx-destaque"
                }`}
              >
                {pilula.rotulo}
              </button>
            ))}
            <span className="ml-auto hidden text-xs text-kx-legenda sm:inline">Clique em um título para dar baixa</span>
            {podeLancar && (
              <Button onClick={abrirNovaConta} size="sm" className="h-9 rounded-kx-botao">
                <Plus className="mr-1.5 h-4 w-4" />
                Nova Conta
              </Button>
            )}
          </div>

          <div className="hidden grid-cols-[minmax(0,1.5fr)_90px_110px_120px_120px_40px] gap-3 px-3 text-[11px] font-bold uppercase tracking-wide text-kx-legenda sm:grid">
            <span>Cliente / origem</span>
            <span>Parcela</span>
            <span>Vencimento</span>
            <span className="text-right">Valor</span>
            <span className="text-right">Situação</span>
            <span />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {contasFiltradas.length === 0 && (
              <p className="py-10 text-center text-sm text-kx-legenda">Nenhuma conta encontrada com os filtros selecionados.</p>
            )}
            {contasFiltradas.map(({ conta, status }) => {
              const parcela = conta.totalParcelas > 1 ? `${conta.numeroParcela}/${conta.totalParcelas}` : "Única";
              const selecionada = contaSelecionadaId === conta.id;

              return (
                <div
                  key={conta.id}
                  className={`grid grid-cols-1 gap-2 rounded-kx-botao border px-3 py-2.5 text-sm transition-colors sm:grid-cols-[minmax(0,1.5fr)_90px_110px_120px_120px_40px] sm:items-center sm:gap-3 ${
                    selecionada ? "border-kx-primaria bg-kx-primaria/8" : "border-kx-painel-borda bg-kx-cartao"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => (status !== "RECEBIDO" && podeBaixar ? setContaSelecionadaId(conta.id) : setContaDetalhes(conta))}
                    className="flex min-w-0 flex-col text-left"
                  >
                    <span className="truncate font-bold text-kx-texto">{conta.cliente?.nomeRazaoSocial ?? conta.descricao}</span>
                    <span className="truncate text-xs text-kx-legenda">{conta.descricao}</span>
                  </button>
                  <span className="text-kx-texto-2">{parcela}</span>
                  <span className="tabular-nums text-kx-texto-2">{format(new Date(conta.dataVencimento), "dd/MM/yyyy")}</span>
                  <span className="text-right font-bold tabular-nums text-kx-texto">{formatarMoeda(conta.valor)}</span>
                  <span className="flex justify-end">{pilulaDoStatus(status)}</span>
                  <span className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mais ações">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {status !== "RECEBIDO" && podeEditar && (
                          <DropdownMenuItem onClick={() => abrirEdicao(conta)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setContaDetalhes(conta)}>
                          <Info className="mr-2 h-4 w-4" /> Detalhes
                        </DropdownMenuItem>
                        {podeExcluir && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setContaParaExcluir(conta)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel "Dar baixa" — substitui o Dialog; mesma action/validação de antes. */}
        <aside
          aria-label="Dar baixa"
          className="flex min-h-0 flex-col gap-3.5 overflow-y-auto rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5"
        >
          <div>
            <p className="text-base font-bold text-kx-texto">Dar baixa</p>
            <p className="text-xs text-kx-legenda">
              {contaSelecionada ? contaSelecionada.descricao : "Selecione um título pendente na lista para registrar o recebimento."}
            </p>
          </div>

          {contaSelecionada ? (
            <>
              <div className="flex flex-col gap-1 rounded-kx-botao bg-kx-superficie p-3.5">
                <span className="text-xs text-kx-legenda">Valor do título</span>
                <span className="text-2xl font-extrabold tabular-nums text-kx-texto">{formatarMoeda(contaSelecionada.valor)}</span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="obs-baixa" className="text-xs font-bold text-kx-texto">
                  Observações do pagamento
                </Label>
                <Textarea
                  id="obs-baixa"
                  placeholder="Ex.: recebido via PIX, comprovante enviado pelo cliente"
                  value={observacaoBaixa}
                  onChange={(e) => setObservacaoBaixa(e.target.value)}
                  className="border-kx-campo-borda bg-kx-superficie"
                />
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <Button onClick={confirmarBaixa} disabled={baixandoConta} className="h-11 rounded-kx-botao text-sm font-bold">
                  {baixandoConta ? "Confirmando..." : "Confirmar recebimento"}
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-kx-botao"
                  disabled={baixandoConta}
                  onClick={() => {
                    setContaSelecionadaId(null);
                    setObservacaoBaixa("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-kx-botao border border-dashed border-kx-campo-borda p-6 text-center text-xs text-kx-legenda">
              Nada selecionado ainda.
            </div>
          )}
        </aside>
      </div>

      {/* Dialog: Editar Conta */}
      <Dialog open={Boolean(contaEditando)} onOpenChange={(aberto) => { if (!aberto) setContaEditando(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Conta a Receber</DialogTitle>
            <DialogDescription>Altere o vencimento ou o valor da parcela. Contas já baixadas não podem ser editadas.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-vencimento">Data de Vencimento</Label>
              <Input
                id="edit-vencimento"
                type="date"
                value={formEdicao.dataVencimento}
                onChange={(e) => setFormEdicao((prev) => ({ ...prev, dataVencimento: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-valor">Valor (R$)</Label>
              <Input
                id="edit-valor"
                placeholder="0,00"
                value={formEdicao.valor}
                onChange={(e) => setFormEdicao((prev) => ({ ...prev, valor: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setContaEditando(null)} disabled={salvandoEdicao}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={salvandoEdicao}>
              {salvandoEdicao ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes (somente leitura) */}
      <Dialog open={Boolean(contaDetalhes)} onOpenChange={(aberto) => { if (!aberto) setContaDetalhes(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Conta</DialogTitle>
            <DialogDescription>Informações completas do título selecionado.</DialogDescription>
          </DialogHeader>

          {contaDetalhes && (
            <div className="space-y-3 py-1 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição</dt>
                  <dd className="mt-0.5 text-foreground">{contaDetalhes.descricao}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</dt>
                  <dd className="mt-0.5">{pilulaDoStatus(obterStatusExibicao(contaDetalhes, inicioDiaAtual))}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{formatarMoeda(contaDetalhes.valor)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vencimento</dt>
                  <dd className="mt-0.5 text-foreground">{format(new Date(contaDetalhes.dataVencimento), "dd/MM/yyyy")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parcela</dt>
                  <dd className="mt-0.5 text-foreground">
                    {contaDetalhes.totalParcelas > 1 ? `${contaDetalhes.numeroParcela} de ${contaDetalhes.totalParcelas}` : "Parcela única"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forma</dt>
                  <dd className="mt-0.5 text-foreground">{MAPA_FORMA_PAGAMENTO[contaDetalhes.formaRecebimento]}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente / Devedor</dt>
                  <dd className="mt-0.5 text-foreground">{contaDetalhes.cliente?.nomeRazaoSocial ?? "— sem cliente —"}</dd>
                </div>
                {contaDetalhes.dataRecebimento && (
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data de Recebimento</dt>
                    <dd className="mt-0.5 text-foreground">{format(new Date(contaDetalhes.dataRecebimento), "dd/MM/yyyy")}</dd>
                  </div>
                )}
                {contaDetalhes.observacaoLancamento && (
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obs. do Lançamento</dt>
                    <dd className="mt-0.5 text-muted-foreground">{contaDetalhes.observacaoLancamento}</dd>
                  </div>
                )}
                {contaDetalhes.observacaoPagamento && (
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obs. do Recebimento</dt>
                    <dd className="mt-0.5 text-muted-foreground">{contaDetalhes.observacaoPagamento}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setContaDetalhes(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar Exclusão */}
      <AlertDialog open={Boolean(contaParaExcluir)} onOpenChange={(aberto) => { if (!aberto) setContaParaExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a receber?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong>não pode ser desfeita</strong>. O título{" "}
              <span className="font-semibold">&ldquo;{contaParaExcluir?.descricao}&rdquo;</span> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={excluindo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Nova Conta a Receber */}
      <Dialog open={dialogNovaContaAberto} onOpenChange={setDialogNovaContaAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta a Receber</DialogTitle>
            <DialogDescription>Registre um título avulso a receber.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <SeletorClienteCRM
              label="Devedor"
              clienteSelecionado={clienteSelecionado}
              papelFiltro="CLIENTE"
              onSelecionarCliente={setClienteSelecionado}
              onLimparCliente={() => setClienteSelecionado(null)}
            />

            <div className="space-y-1">
              <Label htmlFor="descricao-conta">Descrição</Label>
              <Input
                id="descricao-conta"
                placeholder="Ex: Serviço de consultoria"
                value={formNovaConta.descricao}
                onChange={(e) => setFormNovaConta((prev) => ({ ...prev, descricao: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="valor-conta">Valor Total (R$)</Label>
              <Input
                id="valor-conta"
                placeholder="0,00"
                value={formNovaConta.valorTotal}
                onChange={(e) => setFormNovaConta((prev) => ({ ...prev, valorTotal: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="parcelas-conta">Quantidade de Parcelas</Label>
              <Input
                id="parcelas-conta"
                type="number"
                min={1}
                value={formNovaConta.qtdParcelas}
                onChange={(e) => setFormNovaConta((prev) => ({ ...prev, qtdParcelas: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="inicio-conta">Data de Início</Label>
                <Input
                  id="inicio-conta"
                  type="date"
                  value={formNovaConta.dataInicio}
                  onChange={(e) => setFormNovaConta((prev) => ({ ...prev, dataInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vencimento-conta">Primeiro Vencimento</Label>
                <Input
                  id="vencimento-conta"
                  type="date"
                  value={formNovaConta.dataVencimentoPrimeiraParcela}
                  onChange={(e) => setFormNovaConta((prev) => ({ ...prev, dataVencimentoPrimeiraParcela: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="forma-recebimento">Forma de Recebimento</Label>
              <Select
                value={formNovaConta.formaRecebimento}
                onValueChange={(v) => setFormNovaConta((prev) => ({ ...prev, formaRecebimento: v as ContaReceberFinanceiro["formaRecebimento"] }))}
              >
                <SelectTrigger id="forma-recebimento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                  <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CREDIARIO">Crediário</SelectItem>
                  <SelectItem value="EMPENHO_PUBLICO">Empenho Público</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="obs-lancamento">Observações do Lançamento</Label>
              <Textarea
                id="obs-lancamento"
                placeholder="Ex: Parcelamento negociado em contrato mensal"
                value={formNovaConta.observacaoLancamento}
                onChange={(e) => setFormNovaConta((prev) => ({ ...prev, observacaoLancamento: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovaContaAberto(false)} disabled={salvandoConta}>
              Cancelar
            </Button>
            <Button onClick={salvarNovaConta} disabled={salvandoConta}>
              {salvandoConta ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
