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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Tipos ────────────────────────────────────────────────────────────────────

type StatusExibicao = "PENDENTE" | "ATRASADO" | "PAGO";

interface FormDespesa {
  fornecedor: string;
  descricao: string;
  valorTotal: string;
  tipo: TipoDespesa;
  qtdParcelas: string;
  dataVencimento: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function inicioDoDia(data: Date) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function statusExibicaoParcela(
  parcela: ParcelaDespesaComRelacao,
  referencia: Date
): StatusExibicao {
  if (parcela.status === "PAGO") return "PAGO";
  if (new Date(parcela.dataVencimento) < referencia) return "ATRASADO";
  return "PENDENTE";
}

function badgeStatus(status: StatusExibicao) {
  if (status === "PAGO") {
    return (
      <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        Pago
      </Badge>
    );
  }
  if (status === "ATRASADO") {
    return <Badge variant="destructive">Atrasado</Badge>;
  }
  return (
    <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      Pendente
    </Badge>
  );
}

function rotuloTipoDespesa(tipo: TipoDespesa) {
  if (tipo === "UNICA") return "Única";
  if (tipo === "PARCELADA") return "Parcelada";
  return "Fixa Mensal";
}

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
  /** Lista de parcelas já filtradas, proveniente do Server Component pai. */
  parcelas: ParcelaDespesaComRelacao[];
}

/**
 * Camada interativa da página de Contas a Pagar.
 * Exibe a tabela, gerencia modais de criação e pagamento de parcelas.
 * Não faz fetching de dados — recebe tudo via props do Server Component.
 * Após cada mutação, chama router.refresh() para acionar novo render do servidor.
 */
export function ConteudoPagar({ parcelas }: ConteudoPagarProps) {
  const router = useRouter();
  const hoje = useMemo(() => inicioDoDia(new Date()), []);

  // ── Estado dos modais ────────────────────────────────────────────────────

  const [dialogNovaDespesaAberto, setDialogNovaDespesaAberto] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBuscaCRM | null>(null);
  const [formDespesa, setFormDespesa] = useState<FormDespesa>(FORM_INICIAL);

  const [sheetAberto, setSheetAberto] = useState(false);
  const [despesaSelecionadaId, setDespesaSelecionadaId] = useState<string | null>(null);

  const [dialogPagarAberto, setDialogPagarAberto] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaDespesaComRelacao | null>(
    null
  );
  const [valorPagamento, setValorPagamento] = useState("");
  const [pagandoParcela, setPagandoParcela] = useState(false);

  // ── Dados derivados ──────────────────────────────────────────────────────

  const despesaSelecionada = useMemo(() => {
    if (!despesaSelecionadaId) return null;
    return parcelas.find((p) => p.despesaId === despesaSelecionadaId)?.despesa ?? null;
  }, [despesaSelecionadaId, parcelas]);

  const parcelasDaDespesa = useMemo(() => {
    if (!despesaSelecionadaId) return [];
    return parcelas
      .filter((p) => p.despesaId === despesaSelecionadaId)
      .sort((a, b) => a.numeroParcela - b.numeroParcela);
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
      await criarDespesa({
        fornecedor: clienteSelecionado.nomeRazaoSocial,
        clienteId: clienteSelecionado.id,
        descricao: formDespesa.descricao,
        valorTotal: valorTotalNumero,
        tipo: formDespesa.tipo,
        qtdParcelas: qtdParcelasNumero,
        dataVencimento: new Date(`${formDespesa.dataVencimento}T12:00:00`),
      });
      toast.success("Despesa registrada com sucesso.");
      setDialogNovaDespesaAberto(false);
      router.refresh(); // Aciona novo render do Server Component com dados atualizados
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
      await pagarParcela(parcelaSelecionada.id, valorPagoNumero);
      toast.success("Parcela registrada como paga.");
      setDialogPagarAberto(false);
      setParcelaSelecionada(null);
      router.refresh(); // Aciona novo render do Server Component com dados atualizados
    } catch {
      toast.error("Não foi possível registrar o pagamento.");
    } finally {
      setPagandoParcela(false);
    }
  }

  // ── Renderização ─────────────────────────────────────────────────────────

  return (
    <>
      {/* Cabeçalho da seção com botão de nova despesa */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Parcelas</h2>
        <Button onClick={abrirNovaDespesa}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Despesa
        </Button>
      </div>

      {/* Tabela de parcelas */}
      <Card className="border-border bg-card p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelas.map((parcela) => {
              const status = statusExibicaoParcela(parcela, hoje);
              return (
                <TableRow key={parcela.id}>
                  <TableCell className="font-medium text-foreground">
                    <p>{parcela.despesa.cliente?.nomeRazaoSocial ?? parcela.despesa.fornecedor}</p>
                    {parcela.despesa.cliente?.documento && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {parcela.despesa.cliente.documento}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{parcela.despesa.descricao}</TableCell>
                  <TableCell>
                    {parcela.numeroParcela}/{parcela.despesa.qtdParcelas}
                  </TableCell>
                  <TableCell>
                    {format(new Date(parcela.dataVencimento), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="font-mono">
                    {parcela.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>{badgeStatus(status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDespesaSelecionadaId(parcela.despesaId);
                        setSheetAberto(true);
                      }}
                    >
                      Gerenciar Despesa
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {parcelas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma parcela encontrada com os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Sheet: Gerenciamento de despesa com suas parcelas */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          <div className="h-full flex flex-col">
            <SheetHeader className="px-6 py-5 border-b border-border">
              <SheetTitle>Gerenciamento da Despesa</SheetTitle>
              <SheetDescription>
                Contexto completo da despesa com linha do tempo das parcelas.
              </SheetDescription>
            </SheetHeader>

            {despesaSelecionada ? (
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Resumo da despesa */}
                <Card className="border-border bg-card p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Fornecedor
                      </p>
                      <p className="text-base font-semibold text-foreground mt-1">
                        {despesaSelecionada.cliente?.nomeRazaoSocial ?? despesaSelecionada.fornecedor}
                      </p>
                      {despesaSelecionada.cliente?.documento && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {despesaSelecionada.cliente.documento}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Tipo de Despesa
                      </p>
                      <p className="text-base font-semibold text-foreground mt-1">
                        {rotuloTipoDespesa(despesaSelecionada.tipo)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Valor Total Base
                      </p>
                      <p className="text-base font-semibold text-foreground mt-1">
                        {despesaSelecionada.valorTotal.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Total Programado
                      </p>
                      <p className="text-base font-semibold text-foreground mt-1">
                        {progressoDespesa.total.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progresso de pagamento</span>
                      <span className="font-semibold text-foreground">
                        {progressoDespesa.pagas} pagas / {progressoDespesa.pendentes} pendentes
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${progressoDespesa.percentual}%` }}
                      />
                    </div>
                  </div>
                </Card>

                {/* Tabela de parcelas da despesa */}
                <Card className="border-border bg-card p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor Pago</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelasDaDespesa.map((parcela) => {
                        const status = statusExibicaoParcela(parcela, hoje);
                        return (
                          <TableRow key={parcela.id}>
                            <TableCell>
                              {parcela.numeroParcela}/{despesaSelecionada.qtdParcelas}
                            </TableCell>
                            <TableCell>
                              {format(new Date(parcela.dataVencimento), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="font-mono">
                              {parcela.valor.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </TableCell>
                            <TableCell>{badgeStatus(status)}</TableCell>
                            <TableCell className="font-mono">
                              {parcela.valorPago
                                ? parcela.valorPago.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {status !== "PAGO" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => abrirDialogPagamento(parcela)}
                                >
                                  Pagar / Antecipar
                                </Button>
                              ) : (
                                <span className="text-sm text-muted-foreground">Concluída</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            ) : (
              <div className="px-6 py-8 text-sm text-muted-foreground">
                Nenhuma despesa selecionada.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: Nova Despesa */}
      <Dialog open={dialogNovaDespesaAberto} onOpenChange={setDialogNovaDespesaAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
            <DialogDescription>
              Cadastre uma despesa única, parcelada ou recorrente mensal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-2">
              <SeletorClienteCRM
                label="Pessoa do CRM (Fornecedor)"
                clienteSelecionado={clienteSelecionado}
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

            <div className="sm:col-span-2 space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formDespesa.descricao}
                onChange={(e) =>
                  setFormDespesa((prev) => ({ ...prev, descricao: e.target.value }))
                }
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
                onChange={(e) =>
                  setFormDespesa((prev) => ({ ...prev, valorTotal: e.target.value }))
                }
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formDespesa.tipo}
                onValueChange={(v: TipoDespesa) =>
                  setFormDespesa((prev) => ({ ...prev, tipo: v }))
                }
              >
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
                onChange={(e) =>
                  setFormDespesa((prev) => ({ ...prev, qtdParcelas: e.target.value }))
                }
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label>Primeiro Vencimento</Label>
              <Input
                type="date"
                value={formDespesa.dataVencimento}
                onChange={(e) =>
                  setFormDespesa((prev) => ({ ...prev, dataVencimento: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogNovaDespesaAberto(false)}
              disabled={salvandoDespesa}
            >
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
            <DialogDescription>
              Ajuste o valor pago para refletir desconto por antecipação ou juros por atraso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {parcelaSelecionada && (
              <div className="rounded-md border border-border p-3 bg-muted/30">
                <p className="text-sm text-muted-foreground">Parcela selecionada</p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {parcelaSelecionada.numeroParcela}/{parcelaSelecionada.despesa.qtdParcelas} —{" "}
                  {format(new Date(parcelaSelecionada.dataVencimento), "dd/MM/yyyy")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Valor original:{" "}
                  {parcelaSelecionada.valor.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor pago (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={valorPagamento}
                onChange={(e) => setValorPagamento(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogPagarAberto(false)}
              disabled={pagandoParcela}
            >
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
