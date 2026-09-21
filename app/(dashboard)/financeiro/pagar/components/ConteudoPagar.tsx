"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ClienteBuscaCRM } from "@/app/actions/crm";
import {
  criarDespesa,
  pagarParcela,
  type ParcelaDespesaComRelacao,
  type TipoDespesa,
} from "@/app/actions/financeiro-pagar";
import { SeletorClienteCRM } from "@/components/financeiro/seletor-cliente-crm";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ── Tipos e constantes ───────────────────────────────────────────────────────

type StatusExibicao = "PENDENTE" | "ATRASADO" | "PAGO";
type VistaPagar = "PERIODO" | "RECORRENCIAS";

/** Mesmo texto fixo gravado por os-itens.ts (adicionarItemOS) em
 * Despesa.fornecedor — não existe campo de origem no schema (Fase 3-2D,
 * Parte 1/3): esta string é a única forma de distinguir custo de peça de OS
 * de uma despesa de loja de verdade. */
const FORNECEDOR_PECA_OS = "Custo de peça (OS)";

interface FormDespesa {
  fornecedor: string;
  descricao: string;
  valorTotal: string;
  tipo: TipoDespesa;
  qtdParcelas: string;
  dataVencimento: string;
}

function inicioDoDia(data: Date) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function statusExibicaoParcela(parcela: ParcelaDespesaComRelacao, referencia: Date): StatusExibicao {
  if (parcela.status === "PAGO") return "PAGO";
  if (new Date(parcela.dataVencimento) < referencia) return "ATRASADO";
  return "PENDENTE";
}

function pilulaDoStatus(status: StatusExibicao) {
  if (status === "PAGO") return <PilulaStatus variante="sucesso">Pago</PilulaStatus>;
  if (status === "ATRASADO") return <PilulaStatus variante="erro">Atrasado</PilulaStatus>;
  return <PilulaStatus variante="alerta">Pendente</PilulaStatus>;
}

function categoriaDaDespesa(fornecedor: string): { rotulo: string; ehPecaOS: boolean } {
  if (fornecedor === FORNECEDOR_PECA_OS) return { rotulo: "Peça de OS", ehPecaOS: true };
  return { rotulo: "Despesa da loja", ehPecaOS: false };
}

function rotuloTipoDespesa(tipo: TipoDespesa) {
  if (tipo === "UNICA") return "Única";
  if (tipo === "PARCELADA") return "Parcelada";
  return "Fixa Mensal";
}

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FORM_INICIAL: FormDespesa = {
  fornecedor: "",
  descricao: "",
  valorTotal: "",
  tipo: "UNICA",
  qtdParcelas: "1",
  dataVencimento: format(new Date(), "yyyy-MM-dd"),
};

// ── Componente ───────────────────────────────────────────────────────────────

interface ConteudoPagarProps {
  parcelas: ParcelaDespesaComRelacao[];
}

/**
 * Contas a Pagar (Fase 3-2D, Parte 3) — referência:
 * docs/design/referencia-financeiro-pagar.html. Duas vistas por pílula:
 * "Contas do período" (a tabela de sempre, com a categoria derivada — ver
 * categoriaDaDespesa) e "Recorrências". Não existe modelo de recorrência
 * no schema (Fase 3-2D, Parte 1 já apurou isso) — a vista mostra as
 * despesas tipo FIXA_MENSAL que têm parcela no período carregado, a
 * aproximação mais honesta possível sem inventar dado novo.
 */
export function ConteudoPagar({ parcelas }: ConteudoPagarProps) {
  const router = useRouter();
  const hoje = useMemo(() => inicioDoDia(new Date()), []);

  const podeLancar = useTemPermissao("financeiro.lancar");
  const podeBaixar = useTemPermissao("financeiro.baixar");

  const [vista, setVista] = useState<VistaPagar>("PERIODO");

  const [dialogNovaDespesaAberto, setDialogNovaDespesaAberto] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBuscaCRM | null>(null);
  const [formDespesa, setFormDespesa] = useState<FormDespesa>(FORM_INICIAL);

  const [sheetAberto, setSheetAberto] = useState(false);
  const [despesaSelecionadaId, setDespesaSelecionadaId] = useState<string | null>(null);

  const [dialogPagarAberto, setDialogPagarAberto] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaDespesaComRelacao | null>(null);
  const [valorPagamento, setValorPagamento] = useState("");
  const [pagandoParcela, setPagandoParcela] = useState(false);

  const despesaSelecionada = useMemo(() => {
    if (!despesaSelecionadaId) return null;
    return parcelas.find((p) => p.despesaId === despesaSelecionadaId)?.despesa ?? null;
  }, [despesaSelecionadaId, parcelas]);

  const parcelasDaDespesa = useMemo(() => {
    if (!despesaSelecionadaId) return [];
    return parcelas.filter((p) => p.despesaId === despesaSelecionadaId).sort((a, b) => a.numeroParcela - b.numeroParcela);
  }, [despesaSelecionadaId, parcelas]);

  const progressoDespesa = useMemo(() => {
    if (!parcelasDaDespesa.length) return { percentual: 0, pagas: 0, pendentes: 0, total: 0 };
    const pagas = parcelasDaDespesa.filter((p) => p.status === "PAGO").length;
    const total = parcelasDaDespesa.reduce((acc, p) => acc + p.valor, 0);
    return {
      percentual: Math.round((pagas / parcelasDaDespesa.length) * 100),
      pagas,
      pendentes: parcelasDaDespesa.length - pagas,
      total,
    };
  }, [parcelasDaDespesa]);

  const totalDoPeriodo = useMemo(() => parcelas.reduce((acc, p) => acc + p.valor, 0), [parcelas]);

  const recorrencias = useMemo(() => {
    const porDespesa = new Map<string, ParcelaDespesaComRelacao[]>();
    for (const parcela of parcelas) {
      if (parcela.despesa.tipo !== "FIXA_MENSAL") continue;
      const lista = porDespesa.get(parcela.despesaId) ?? [];
      lista.push(parcela);
      porDespesa.set(parcela.despesaId, lista);
    }
    return Array.from(porDespesa.entries()).map(([despesaId, lista]) => {
      const ordenadas = [...lista].sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
      const proxima = ordenadas.find((p) => p.status !== "PAGO") ?? ordenadas[ordenadas.length - 1]!;
      return { despesaId, despesa: lista[0]!.despesa, proxima };
    });
  }, [parcelas]);

  // ── Handlers: Nova Despesa ───────────────────────────────────────────────

  function abrirNovaDespesa() {
    setFormDespesa(FORM_INICIAL);
    setClienteSelecionado(null);
    setDialogNovaDespesaAberto(true);
  }

  async function salvarDespesa() {
    const valorTotalNumero = Number(formDespesa.valorTotal.replace(",", "."));
    const qtdParcelasNumero = Math.max(1, Math.trunc(Number(formDespesa.qtdParcelas || "1")));

    if (!clienteSelecionado) {
      toast.error("Selecione a pessoa no CRM para registrar a despesa.");
      return;
    }
    if (!formDespesa.descricao.trim()) {
      toast.error("Preencha a descrição da despesa.");
      return;
    }
    if (!Number.isFinite(valorTotalNumero) || valorTotalNumero <= 0) {
      toast.error("Informe um valor total válido.");
      return;
    }

    try {
      setSalvandoDespesa(true);
      const resultado = await criarDespesa({
        fornecedor: clienteSelecionado.nomeRazaoSocial,
        clienteId: clienteSelecionado.id,
        descricao: formDespesa.descricao,
        valorTotal: valorTotalNumero,
        tipo: formDespesa.tipo,
        qtdParcelas: qtdParcelasNumero,
        dataVencimento: new Date(`${formDespesa.dataVencimento}T12:00:00`),
      });
      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }
      toast.success("Despesa registrada com sucesso.");
      setDialogNovaDespesaAberto(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível registrar a despesa.");
    } finally {
      setSalvandoDespesa(false);
    }
  }

  // ── Handlers: Pagamento de Parcela ───────────────────────────────────────

  function abrirDialogPagamento(parcela: ParcelaDespesaComRelacao) {
    setParcelaSelecionada(parcela);
    setValorPagamento(parcela.valor.toFixed(2));
    setDialogPagarAberto(true);
  }

  async function confirmarPagamento() {
    if (!parcelaSelecionada) return;

    const valorPagoNumero = Number(valorPagamento.replace(",", "."));
    if (!Number.isFinite(valorPagoNumero) || valorPagoNumero <= 0) {
      toast.error("Informe um valor de pagamento válido.");
      return;
    }

    try {
      setPagandoParcela(true);
      const resultado = await pagarParcela(parcelaSelecionada.id, valorPagoNumero);
      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }
      toast.success("Parcela registrada como paga.");
      setDialogPagarAberto(false);
      setParcelaSelecionada(null);
      router.refresh();
    } catch {
      toast.error("Não foi possível registrar o pagamento.");
    } finally {
      setPagandoParcela(false);
    }
  }

  function abrirGerenciamento(despesaId: string) {
    setDespesaSelecionadaId(despesaId);
    setSheetAberto(true);
  }

  // ── Renderização ─────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVista("PERIODO")}
            aria-pressed={vista === "PERIODO"}
            className={`h-9 shrink-0 rounded-kx-pilula border px-4 text-sm font-bold transition-colors ${
              vista === "PERIODO" ? "border-kx-primaria bg-kx-primaria text-primary-foreground" : "border-kx-painel-borda bg-kx-superficie text-kx-texto-2 hover:border-kx-destaque"
            }`}
          >
            Contas do período
          </button>
          <button
            type="button"
            onClick={() => setVista("RECORRENCIAS")}
            aria-pressed={vista === "RECORRENCIAS"}
            className={`h-9 shrink-0 rounded-kx-pilula border px-4 text-sm font-bold transition-colors ${
              vista === "RECORRENCIAS" ? "border-kx-primaria bg-kx-primaria text-primary-foreground" : "border-kx-painel-borda bg-kx-superficie text-kx-texto-2 hover:border-kx-destaque"
            }`}
          >
            Recorrências
          </button>
          {podeLancar && (
            <Button onClick={abrirNovaDespesa} size="sm" className="ml-auto h-9 rounded-kx-botao">
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Despesa
            </Button>
          )}
        </div>

        {vista === "PERIODO" ? (
          <>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_90px_110px_110px_120px] gap-3 px-3 text-[11px] font-bold uppercase tracking-wide text-kx-legenda sm:grid">
              <span>Fornecedor / descrição</span>
              <span>Categoria</span>
              <span>Parcela</span>
              <span>Vencimento</span>
              <span className="text-right">Valor</span>
              <span className="text-right">Situação</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {parcelas.length === 0 && (
                <p className="py-10 text-center text-sm text-kx-legenda">Nenhuma parcela encontrada com os filtros selecionados.</p>
              )}
              {parcelas.map((parcela) => {
                const status = statusExibicaoParcela(parcela, hoje);
                const categoria = categoriaDaDespesa(parcela.despesa.fornecedor);
                return (
                  <button
                    key={parcela.id}
                    type="button"
                    onClick={() => abrirGerenciamento(parcela.despesaId)}
                    className="grid grid-cols-1 gap-2 rounded-kx-botao border border-kx-painel-borda bg-kx-cartao px-3 py-2.5 text-left text-sm transition-colors hover:border-kx-destaque sm:grid-cols-[minmax(0,1.4fr)_120px_90px_110px_110px_120px] sm:items-center sm:gap-3"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-bold text-kx-texto">
                        {parcela.despesa.cliente?.nomeRazaoSocial ?? parcela.despesa.fornecedor}
                      </span>
                      <span className="truncate text-xs text-kx-legenda">{parcela.despesa.descricao}</span>
                    </span>
                    <span>
                      <PilulaStatus variante={categoria.ehPecaOS ? "garantia" : "neutro"} className="w-fit">
                        {categoria.rotulo}
                      </PilulaStatus>
                    </span>
                    <span className="text-kx-texto-2">
                      {parcela.numeroParcela}/{parcela.despesa.qtdParcelas}
                    </span>
                    <span className="tabular-nums text-kx-texto-2">{format(new Date(parcela.dataVencimento), "dd/MM/yyyy")}</span>
                    <span className="text-right font-bold tabular-nums text-kx-texto">{formatarMoeda(parcela.valor)}</span>
                    <span className="flex justify-end">{pilulaDoStatus(status)}</span>
                  </button>
                );
              })}
            </div>

            {parcelas.length > 0 && (
              <div className="flex shrink-0 items-center justify-between border-t border-kx-painel-borda px-2 pt-2.5 text-sm">
                <span className="text-kx-legenda">
                  {parcelas.length} {parcelas.length === 1 ? "conta" : "contas"} no período
                </span>
                <span className="font-extrabold tabular-nums text-kx-texto">Total: {formatarMoeda(totalDoPeriodo)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {recorrencias.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-kx-legenda">
                Nenhuma despesa fixa mensal com parcela no período selecionado. Recorrência de verdade (regra, pausar, data de fim) chega
                numa reconstrução futura do financeiro — esta vista usa as despesas já marcadas como &ldquo;Fixa Mensal&rdquo; hoje.
              </p>
            )}
            {recorrencias.map(({ despesaId, despesa, proxima }) => (
              <div key={despesaId} className="flex flex-col gap-2 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-kx-texto">{despesa.cliente?.nomeRazaoSocial ?? despesa.fornecedor}</span>
                  <PilulaStatus variante="neutro">{rotuloTipoDespesa(despesa.tipo)}</PilulaStatus>
                  <span className="ml-auto font-extrabold tabular-nums text-kx-texto">{formatarMoeda(proxima.valor)}</span>
                </div>
                <p className="truncate text-xs text-kx-texto-2">{despesa.descricao}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-kx-legenda">
                    Próxima: <span className="tabular-nums text-kx-texto-2">{format(new Date(proxima.dataVencimento), "dd/MM/yyyy")}</span>
                  </span>
                  <span className={`ml-auto flex items-center gap-1.5 font-bold ${proxima.status === "PAGO" ? "text-kx-legenda" : "text-kx-sucesso"}`}>
                    <span className={`h-2 w-2 rounded-full ${proxima.status === "PAGO" ? "bg-kx-legenda" : "bg-kx-sucesso"}`} />
                    {proxima.status === "PAGO" ? "Paga este mês" : "Ativa"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sheet: Gerenciamento de despesa com suas parcelas — mesma action/validação de antes. */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border px-6 py-5">
              <SheetTitle>Gerenciamento da Despesa</SheetTitle>
              <SheetDescription>Contexto completo da despesa com linha do tempo das parcelas.</SheetDescription>
            </SheetHeader>

            {despesaSelecionada ? (
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <div className="rounded-md border border-border bg-card p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Fornecedor</p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {despesaSelecionada.cliente?.nomeRazaoSocial ?? despesaSelecionada.fornecedor}
                      </p>
                      {despesaSelecionada.cliente?.documento && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{despesaSelecionada.cliente.documento}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de Despesa</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{rotuloTipoDespesa(despesaSelecionada.tipo)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor Total Base</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{formatarMoeda(despesaSelecionada.valorTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Programado</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{formatarMoeda(progressoDespesa.total)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso de pagamento</span>
                      <span className="font-semibold text-foreground">
                        {progressoDespesa.pagas} pagas / {progressoDespesa.pendentes} pendentes
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-kx-sucesso transition-all duration-300" style={{ width: `${progressoDespesa.percentual}%` }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {parcelasDaDespesa.map((parcela) => {
                    const status = statusExibicaoParcela(parcela, hoje);
                    return (
                      <div key={parcela.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                        <span className="w-16 text-muted-foreground">
                          {parcela.numeroParcela}/{despesaSelecionada.qtdParcelas}
                        </span>
                        <span className="w-24">{format(new Date(parcela.dataVencimento), "dd/MM/yyyy")}</span>
                        <span className="w-24 font-mono">{formatarMoeda(parcela.valor)}</span>
                        <span>{pilulaDoStatus(status)}</span>
                        <span className="w-24 font-mono text-muted-foreground">{parcela.valorPago ? formatarMoeda(parcela.valorPago) : "-"}</span>
                        <span className="ml-auto">
                          {status === "PAGO" ? (
                            <span className="text-sm text-muted-foreground">Concluída</span>
                          ) : podeBaixar ? (
                            <Button size="sm" variant="outline" onClick={() => abrirDialogPagamento(parcela)}>
                              Pagar / Antecipar
                            </Button>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-6 py-8 text-sm text-muted-foreground">Nenhuma despesa selecionada.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: Nova Despesa */}
      <Dialog open={dialogNovaDespesaAberto} onOpenChange={setDialogNovaDespesaAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
            <DialogDescription>Cadastre uma despesa única, parcelada ou recorrente mensal.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <SeletorClienteCRM
                label="Pessoa do CRM (Fornecedor)"
                clienteSelecionado={clienteSelecionado}
                papelFiltro="FORNECEDOR"
                onSelecionarCliente={(cliente) => {
                  setClienteSelecionado(cliente);
                  setFormDespesa((prev) => ({ ...prev, fornecedor: cliente.nomeRazaoSocial }));
                }}
                onLimparCliente={() => {
                  setClienteSelecionado(null);
                  setFormDespesa((prev) => ({ ...prev, fornecedor: "" }));
                }}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={formDespesa.descricao}
                onChange={(e) => setFormDespesa((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Ex: Compra de peças para estoque"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Total</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formDespesa.valorTotal}
                onChange={(e) => setFormDespesa((prev) => ({ ...prev, valorTotal: e.target.value }))}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formDespesa.tipo} onValueChange={(v: TipoDespesa) => setFormDespesa((prev) => ({ ...prev, tipo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNICA">Única</SelectItem>
                  <SelectItem value="PARCELADA">Parcelada</SelectItem>
                  <SelectItem value="FIXA_MENSAL">Fixa Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade de Parcelas</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={formDespesa.qtdParcelas}
                onChange={(e) => setFormDespesa((prev) => ({ ...prev, qtdParcelas: e.target.value }))}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label>Primeiro Vencimento</Label>
              <Input
                type="date"
                value={formDespesa.dataVencimento}
                onChange={(e) => setFormDespesa((prev) => ({ ...prev, dataVencimento: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovaDespesaAberto(false)} disabled={salvandoDespesa}>
              Cancelar
            </Button>
            <Button onClick={salvarDespesa} disabled={salvandoDespesa}>
              {salvandoDespesa ? "Salvando..." : "Salvar Despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Pagar / Antecipar Parcela */}
      <Dialog open={dialogPagarAberto} onOpenChange={setDialogPagarAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar / Antecipar Parcela</DialogTitle>
            <DialogDescription>Ajuste o valor pago para refletir desconto por antecipação ou juros por atraso.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {parcelaSelecionada && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">Parcela selecionada</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {parcelaSelecionada.numeroParcela}/{parcelaSelecionada.despesa.qtdParcelas} —{" "}
                  {format(new Date(parcelaSelecionada.dataVencimento), "dd/MM/yyyy")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Valor original: {formatarMoeda(parcelaSelecionada.valor)}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor pago (R$)</Label>
              <Input type="number" min="0" step="0.01" value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPagarAberto(false)} disabled={pagandoParcela}>
              Cancelar
            </Button>
            <Button onClick={confirmarPagamento} disabled={pagandoParcela}>
              {pagandoParcela ? "Confirmando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
