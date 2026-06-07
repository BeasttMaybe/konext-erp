"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  criarDespesa,
  listarParcelasPagar,
  pagarParcela,
  type ParcelaDespesaComRelacao,
  type TipoDespesa,
} from "@/app/actions/financeiro-pagar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type StatusExibicao = "PENDENTE" | "ATRASADO" | "PAGO";

interface FormDespesa {
  fornecedor: string;
  descricao: string;
  valorTotal: string;
  tipo: TipoDespesa;
  qtdParcelas: string;
  dataVencimento: string;
}

function paraCentavos(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100);
}

function paraMoeda(centavos: number) {
  return centavos / 100;
}

function inicioDoDia(data: Date) {
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

function statusExibicaoParcela(parcela: ParcelaDespesaComRelacao, referencia: Date): StatusExibicao {
  if (parcela.status === "PAGO") return "PAGO";
  if (parcela.dataVencimento < referencia) return "ATRASADO";
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
  if (tipo === "UNICA") return "Unica";
  if (tipo === "PARCELADA") return "Parcelada";
  return "Fixa mensal";
}

export default function FinanceiroPagarPage() {
  const [parcelas, setParcelas] = useState<ParcelaDespesaComRelacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [dialogNovaDespesaAberto, setDialogNovaDespesaAberto] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [despesaSelecionadaId, setDespesaSelecionadaId] = useState<string | null>(null);
  const [dialogPagarAberto, setDialogPagarAberto] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaDespesaComRelacao | null>(null);
  const [valorPagamento, setValorPagamento] = useState("");
  const [pagandoParcela, setPagandoParcela] = useState(false);

  const [formDespesa, setFormDespesa] = useState<FormDespesa>({
    fornecedor: "",
    descricao: "",
    valorTotal: "",
    tipo: "UNICA",
    qtdParcelas: "1",
    dataVencimento: format(new Date(), "yyyy-MM-dd"),
  });

  const hoje = useMemo(() => inicioDoDia(new Date()), []);

  const carregarParcelas = async () => {
    try {
      setCarregando(true);
      const lista = await listarParcelasPagar();
      setParcelas(
        lista.map((parcela) => ({
          ...parcela,
          dataVencimento: new Date(parcela.dataVencimento),
          dataPagamento: parcela.dataPagamento ? new Date(parcela.dataPagamento) : null,
          criadoEm: new Date(parcela.criadoEm),
          despesa: {
            ...parcela.despesa,
            criadoEm: new Date(parcela.despesa.criadoEm),
            atualizadoEm: new Date(parcela.despesa.atualizadoEm),
          },
        }))
      );
    } catch {
      toast.error("Nao foi possivel carregar as parcelas a pagar.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarParcelas();
  }, []);

  const metricas = useMemo(() => {
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

    const venceHojeCentavos = parcelas.reduce((acumulado, parcela) => {
      const status = statusExibicaoParcela(parcela, hoje);
      const mesmaData =
        parcela.dataVencimento.getDate() === hoje.getDate() &&
        parcela.dataVencimento.getMonth() === hoje.getMonth() &&
        parcela.dataVencimento.getFullYear() === hoje.getFullYear();

      if (status !== "PAGO" && mesmaData) {
        return acumulado + paraCentavos(parcela.valor);
      }

      return acumulado;
    }, 0);

    const atrasadasCentavos = parcelas.reduce((acumulado, parcela) => {
      if (statusExibicaoParcela(parcela, hoje) === "ATRASADO") {
        return acumulado + paraCentavos(parcela.valor);
      }
      return acumulado;
    }, 0);

    const totalMesCentavos = parcelas.reduce((acumulado, parcela) => {
      const status = statusExibicaoParcela(parcela, hoje);
      const vencimentoNoMes =
        parcela.dataVencimento >= primeiroDiaMes && parcela.dataVencimento <= ultimoDiaMes;

      if (status !== "PAGO" && vencimentoNoMes) {
        return acumulado + paraCentavos(parcela.valor);
      }

      return acumulado;
    }, 0);

    return {
      venceHoje: paraMoeda(venceHojeCentavos),
      atrasadas: paraMoeda(atrasadasCentavos),
      totalMes: paraMoeda(totalMesCentavos),
    };
  }, [parcelas, hoje]);

  const despesaSelecionada = useMemo(() => {
    if (!despesaSelecionadaId) return null;
    return parcelas.find((parcela) => parcela.despesaId === despesaSelecionadaId)?.despesa || null;
  }, [despesaSelecionadaId, parcelas]);

  const parcelasDaDespesa = useMemo(() => {
    if (!despesaSelecionadaId) return [];

    return parcelas
      .filter((parcela) => parcela.despesaId === despesaSelecionadaId)
      .sort((a, b) => a.numeroParcela - b.numeroParcela);
  }, [despesaSelecionadaId, parcelas]);

  const progressoDespesa = useMemo(() => {
    if (parcelasDaDespesa.length === 0) {
      return {
        percentual: 0,
        pagas: 0,
        pendentes: 0,
        totalProgramado: 0,
      };
    }

    const pagas = parcelasDaDespesa.filter((parcela) => parcela.status === "PAGO").length;
    const pendentes = parcelasDaDespesa.length - pagas;
    const percentual = Math.round((pagas / parcelasDaDespesa.length) * 100);
    const totalProgramadoCentavos = parcelasDaDespesa.reduce(
      (acumulado, parcela) => acumulado + paraCentavos(parcela.valor),
      0
    );

    return {
      percentual,
      pagas,
      pendentes,
      totalProgramado: paraMoeda(totalProgramadoCentavos),
    };
  }, [parcelasDaDespesa]);

  const abrirSheetDespesa = (despesaId: string) => {
    setDespesaSelecionadaId(despesaId);
    setSheetAberto(true);
  };

  const abrirDialogPagamento = (parcela: ParcelaDespesaComRelacao) => {
    setParcelaSelecionada(parcela);
    setValorPagamento(parcela.valor.toFixed(2));
    setDialogPagarAberto(true);
  };

  const confirmarPagamento = async () => {
    if (!parcelaSelecionada) return;

    const valorPagoNumero = Number(valorPagamento.replace(",", "."));

    if (!Number.isFinite(valorPagoNumero) || valorPagoNumero <= 0) {
      toast.error("Informe um valor de pagamento valido.");
      return;
    }

    try {
      setPagandoParcela(true);
      await pagarParcela(parcelaSelecionada.id, valorPagoNumero);
      toast.success("Parcela atualizada com sucesso.");
      setDialogPagarAberto(false);
      setParcelaSelecionada(null);
      await carregarParcelas();
    } catch {
      toast.error("Nao foi possivel concluir o pagamento da parcela.");
    } finally {
      setPagandoParcela(false);
    }
  };

  const salvarDespesa = async () => {
    const valorTotalNumero = Number(formDespesa.valorTotal.replace(",", "."));
    const qtdParcelasNumero = Math.max(1, Math.trunc(Number(formDespesa.qtdParcelas || "1")));

    if (!formDespesa.fornecedor.trim() || !formDespesa.descricao.trim()) {
      toast.error("Preencha fornecedor e descricao da despesa.");
      return;
    }

    if (!Number.isFinite(valorTotalNumero) || valorTotalNumero <= 0) {
      toast.error("Informe um valor total valido.");
      return;
    }

    try {
      setSalvandoDespesa(true);
      await criarDespesa({
        fornecedor: formDespesa.fornecedor,
        descricao: formDespesa.descricao,
        valorTotal: valorTotalNumero,
        tipo: formDespesa.tipo,
        qtdParcelas: qtdParcelasNumero,
        dataVencimento: new Date(`${formDespesa.dataVencimento}T12:00:00`),
      });

      toast.success("Despesa registrada com sucesso.");
      setDialogNovaDespesaAberto(false);
      setFormDespesa({
        fornecedor: "",
        descricao: "",
        valorTotal: "",
        tipo: "UNICA",
        qtdParcelas: "1",
        dataVencimento: format(new Date(), "yyyy-MM-dd"),
      });
      await carregarParcelas();
    } catch {
      toast.error("Nao foi possivel registrar a despesa.");
    } finally {
      setSalvandoDespesa(false);
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Link
                href="/financeiro"
                className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Link>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mt-2">
                Contas a Pagar
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
                Gestao de despesas unicas, parceladas e recorrencias mensais.
              </p>
            </div>

            <Button onClick={() => setDialogNovaDespesaAberto(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Vence Hoje</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {formatadorMoeda.format(metricas.venceHoje)}
              </p>
            </Card>

            <Card className="border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Atrasadas</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                {formatadorMoeda.format(metricas.atrasadas)}
              </p>
            </Card>

            <Card className="border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Total a Pagar no Mes</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {formatadorMoeda.format(metricas.totalMes)}
              </p>
            </Card>
          </div>

          <Card className="border-border bg-card p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.map((parcela) => {
                  const status = statusExibicaoParcela(parcela, hoje);
                  const totalParcelas = parcela.despesa.qtdParcelas;

                  return (
                    <TableRow key={parcela.id}>
                      <TableCell className="font-medium text-foreground">
                        {parcela.despesa.fornecedor}
                      </TableCell>
                      <TableCell>{parcela.despesa.descricao}</TableCell>
                      <TableCell>
                        {parcela.numeroParcela}/{totalParcelas}
                      </TableCell>
                      <TableCell>{format(parcela.dataVencimento, "dd/MM/yyyy")}</TableCell>
                      <TableCell>{formatadorMoeda.format(parcela.valor)}</TableCell>
                      <TableCell>{badgeStatus(status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirSheetDespesa(parcela.despesaId)}
                        >
                          Gerenciar Despesa
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!carregando && parcelas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma parcela cadastrada para contas a pagar.
                    </TableCell>
                  </TableRow>
                )}

                {carregando && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando parcelas...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          <div className="h-full flex flex-col">
            <SheetHeader className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <SheetTitle>Gerenciamento da Despesa</SheetTitle>
              <SheetDescription>
                Contexto completo da despesa com linha do tempo das parcelas.
              </SheetDescription>
            </SheetHeader>

            {despesaSelecionada ? (
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                <Card className="border-border bg-card p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Fornecedor
                      </p>
                      <p className="text-base font-semibold text-foreground mt-1">
                        {despesaSelecionada.fornecedor}
                      </p>
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
                        {formatadorMoeda.format(despesaSelecionada.valorTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Total Programado
                      </p>
                      <p className="text-base font-semibold text-foreground mt-1">
                        {formatadorMoeda.format(progressoDespesa.totalProgramado)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progresso de pagamento</span>
                      <span className="font-semibold text-foreground">
                        {progressoDespesa.pagas} pagas / {progressoDespesa.pendentes} pendentes
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${progressoDespesa.percentual}%` }}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="border-border bg-card p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor Pago</TableHead>
                        <TableHead className="text-right">Acao</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelasDaDespesa.map((parcela) => {
                        const status = statusExibicaoParcela(parcela, hoje);

                        return (
                          <TableRow key={parcela.id}>
                            <TableCell>
                              {parcela.numeroParcela}/{parcela.despesa.qtdParcelas}
                            </TableCell>
                            <TableCell>{format(parcela.dataVencimento, "dd/MM/yyyy")}</TableCell>
                            <TableCell>{formatadorMoeda.format(parcela.valor)}</TableCell>
                            <TableCell>{badgeStatus(status)}</TableCell>
                            <TableCell>
                              {parcela.valorPago ? formatadorMoeda.format(parcela.valorPago) : "-"}
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
                                <span className="text-sm text-muted-foreground">Concluida</span>
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

      <Dialog open={dialogNovaDespesaAberto} onOpenChange={setDialogNovaDespesaAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
            <DialogDescription>
              Cadastre uma despesa unica, parcelada ou recorrente mensal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-2">
              <Label>Fornecedor</Label>
              <Input
                value={formDespesa.fornecedor}
                onChange={(evento) =>
                  setFormDespesa((anterior) => ({ ...anterior, fornecedor: evento.target.value }))
                }
                placeholder="Ex: Distribuidora Alfa"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label>Descricao</Label>
              <Input
                value={formDespesa.descricao}
                onChange={(evento) =>
                  setFormDespesa((anterior) => ({ ...anterior, descricao: evento.target.value }))
                }
                placeholder="Ex: Compra de pecas para estoque"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Total</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formDespesa.valorTotal}
                onChange={(evento) =>
                  setFormDespesa((anterior) => ({ ...anterior, valorTotal: evento.target.value }))
                }
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formDespesa.tipo}
                onValueChange={(valor: TipoDespesa) =>
                  setFormDespesa((anterior) => ({ ...anterior, tipo: valor }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNICA">Unica</SelectItem>
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
                onChange={(evento) =>
                  setFormDespesa((anterior) => ({ ...anterior, qtdParcelas: evento.target.value }))
                }
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label>Primeiro Vencimento</Label>
              <Input
                type="date"
                value={formDespesa.dataVencimento}
                onChange={(evento) =>
                  setFormDespesa((anterior) => ({ ...anterior, dataVencimento: evento.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovaDespesaAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarDespesa} disabled={salvandoDespesa}>
              {salvandoDespesa ? "Salvando..." : "Salvar Despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogPagarAberto} onOpenChange={setDialogPagarAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar / Antecipar Parcela</DialogTitle>
            <DialogDescription>
              Ajuste o valor pago para refletir desconto por antecipacao ou juros por atraso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {parcelaSelecionada && (
              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3 bg-slate-50 dark:bg-slate-900">
                <p className="text-sm text-muted-foreground">Parcela selecionada</p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {parcelaSelecionada.numeroParcela}/{parcelaSelecionada.despesa.qtdParcelas} -{" "}
                  {format(parcelaSelecionada.dataVencimento, "dd/MM/yyyy")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Valor original: {formatadorMoeda.format(parcelaSelecionada.valor)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor pago</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={valorPagamento}
                onChange={(evento) => setValorPagamento(evento.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPagarAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarPagamento} disabled={pagandoParcela}>
              {pagandoParcela ? "Confirmando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
