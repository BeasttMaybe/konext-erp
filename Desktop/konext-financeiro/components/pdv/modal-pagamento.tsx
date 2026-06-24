"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  CheckCircle,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  calcularPagamentoPdv,
  CONFIG_PAGAMENTOS_PDV,
  type EntradaPagamentoPdv,
  type FormaPagamentoPdv,
} from "@/lib/pdv/pagamentos";

export interface DadosPagamento {
  pagamentos: EntradaPagamentoPdv[];
  totalTaxas: number;
  totalLiquido: number;
  totalCobrado: number;
  valorRecebidoDinheiro?: number;
  troco?: number;
}

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);

interface LinhaPagamento {
  id: string;
  formaPagamento: FormaPagamentoPdv;
  valorBruto: number;
  parcelas: number;
  diasVencimento: number;
}

function novaLinhaPagamento(total: number): LinhaPagamento {
  return {
    id: crypto.randomUUID(),
    formaPagamento: "DINHEIRO",
    valorBruto: total,
    parcelas: 1,
    diasVencimento: 0,
  };
}

interface PropsModalPagamento {
  aberto: boolean;
  total: number;
  aoFechar: () => void;
  aoConfirmar: (
    dados: DadosPagamento
  ) => Promise<{ sucesso: boolean; mensagem?: string; vendaId?: string }>;
  aoNovaVenda: () => void;
}

export function ModalPagamento({
  aberto,
  total,
  aoFechar,
  aoConfirmar,
  aoNovaVenda,
}: PropsModalPagamento) {
  const [linhas, setLinhas] = useState<LinhaPagamento[]>([novaLinhaPagamento(total)]);
  const [valorRecebidoDinheiro, setValorRecebidoDinheiro] = useState<number>(0);
  const [processando, setProcessando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(false);
  const [vendaIdGerada, setVendaIdGerada] = useState<string | null>(null);

  const pagamentosCalculados = useMemo(() => {
    return linhas.map((linha) =>
      calcularPagamentoPdv({
        formaPagamento: linha.formaPagamento,
        valorBruto: linha.valorBruto,
        parcelas: linha.parcelas,
        diasVencimento: linha.diasVencimento,
      })
    );
  }, [linhas]);

  const totalInformado = useMemo(() => {
    return pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorBruto), 0) / 100;
  }, [pagamentosCalculados]);

  const totalTaxas = useMemo(() => {
    return pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorTaxa), 0) / 100;
  }, [pagamentosCalculados]);

  const totalLiquido = useMemo(() => {
    return pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorLiquido), 0) / 100;
  }, [pagamentosCalculados]);

  const totalDinheiro = useMemo(() => {
    return pagamentosCalculados
      .filter((item) => item.formaPagamento === "DINHEIRO")
      .reduce((acc, item) => acc + paraCentavos(item.valorBruto), 0) / 100;
  }, [pagamentosCalculados]);

  const troco = Math.max(0, valorRecebidoDinheiro - totalDinheiro);
  const dinheiroInsuficiente = totalDinheiro > 0 && valorRecebidoDinheiro > 0 && valorRecebidoDinheiro < totalDinheiro;
  const totalCorreto = paraCentavos(totalInformado) === paraCentavos(total);
  const diferenca = totalInformado - total;

  const podeConfirmar =
    !processando &&
    total > 0 &&
    totalCorreto &&
    (totalDinheiro === 0 || valorRecebidoDinheiro >= totalDinheiro);

  const resetar = () => {
    setLinhas([novaLinhaPagamento(total)]);
    setValorRecebidoDinheiro(0);
    setProcessando(false);
    setVendaFinalizada(false);
    setVendaIdGerada(null);
  };

  const atualizarLinha = (id: string, patch: Partial<LinhaPagamento>) => {
    setLinhas((estadoAtual) =>
      estadoAtual.map((linha) => (linha.id === id ? { ...linha, ...patch } : linha))
    );
  };

  const adicionarLinha = () => {
    setLinhas((estadoAtual) => [
      ...estadoAtual,
      {
        id: crypto.randomUUID(),
        formaPagamento: "PIX",
        valorBruto: 0,
        parcelas: 1,
        diasVencimento: 0,
      },
    ]);
  };

  const removerLinha = (id: string) => {
    setLinhas((estadoAtual) => {
      if (estadoAtual.length === 1) return estadoAtual;
      return estadoAtual.filter((linha) => linha.id !== id);
    });
  };

  const handleFechar = () => {
    resetar();
    aoFechar();
  };

  const handleConfirmar = async () => {
    setProcessando(true);

    const dados: DadosPagamento = {
      pagamentos: linhas.map((linha) => ({
        formaPagamento: linha.formaPagamento,
        valorBruto: linha.valorBruto,
        parcelas: linha.parcelas,
        diasVencimento: linha.diasVencimento,
      })),
      totalTaxas,
      totalLiquido,
      totalCobrado: totalInformado,
      valorRecebidoDinheiro: totalDinheiro > 0 ? valorRecebidoDinheiro : undefined,
      troco: totalDinheiro > 0 ? troco : undefined,
    };

    try {
      const resultado = await aoConfirmar(dados);

      if (!resultado.sucesso) {
        if (resultado.mensagem) {
          toast.error(resultado.mensagem);
        }
        return;
      }

      setVendaIdGerada(resultado.vendaId || null);
      setVendaFinalizada(true);
    } finally {
      setProcessando(false);
    }
  };

  const handleNovaVenda = () => {
    // Adia o fechamento um instante para evitar click-through no botão
    // de "Finalizar Venda" que fica atrás do modal.
    setTimeout(() => {
      aoNovaVenda();
      aoFechar();
    }, 80);
  };

  const urlRecibo = vendaIdGerada ? `/recibo/${vendaIdGerada}` : null;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado && !processando) handleFechar();
      }}
    >
      <DialogContent className="max-w-lg transition-all duration-300">
        {vendaFinalizada ? (
          <div className="flex flex-col items-center justify-center py-4 text-center space-y-5">
            <CheckCircle size={64} className="text-emerald-500 animate-pulse" />

            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                Venda Finalizada com Sucesso!
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Total da venda: <span className="font-semibold">{formatarMoeda(total)}</span>
              </p>
              {vendaIdGerada && (
                <p className="text-slate-600 dark:text-slate-400">
                  Comprovante: <span className="font-semibold">#{vendaIdGerada.slice(0, 8)}</span>
                </p>
              )}
            </div>

            {urlRecibo && (
              <div className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-slate-900">
                <iframe
                  src={`${urlRecibo}?embed=1`}
                  title="Preview do recibo"
                  className="w-full h-72"
                />
              </div>
            )}

            <div className="w-full space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!urlRecibo) return;
                  window.open(`${urlRecibo}?autoprint=1`, "_blank", "noopener,noreferrer");
                }}
                disabled={!urlRecibo}
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Recibo
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(
                      `Ola! Segue o comprovante da sua compra na Konext. Total: ${formatarMoeda(total)}${
                        vendaIdGerada ? ` | Venda: #${vendaIdGerada.slice(0, 8)}` : ""
                      }`
                    )}`,
                    "_blank"
                  )
                }
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar pelo WhatsApp
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() =>
                  toast("Módulo Fiscal (NF-e) em desenvolvimento.")
                }
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Nota Fiscal
              </Button>
            </div>

            <div className="w-full border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <Button type="button" className="w-full h-12 text-base" onClick={handleNovaVenda}>
                Nova Venda
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Finalizar Venda</DialogTitle>
              <DialogDescription>
                Distribua o valor entre uma ou mais formas de pagamento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Total a pagar */}
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total a pagar
                </span>
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {formatarMoeda(total)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Pagamentos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar forma
                  </Button>
                </div>

                <div className="space-y-2">
                  {linhas.map((linha, index) => {
                    const config = CONFIG_PAGAMENTOS_PDV.find((item) => item.formaPagamento === linha.formaPagamento);
                    return (
                      <div key={linha.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Pagamento {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removerLinha(linha.id)}
                            disabled={linhas.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label>Forma</Label>
                            <Select
                              value={linha.formaPagamento}
                              onValueChange={(valor) => {
                                const forma = valor as FormaPagamentoPdv;
                                atualizarLinha(linha.id, {
                                  formaPagamento: forma,
                                  parcelas: 1,
                                  diasVencimento: 0,
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {CONFIG_PAGAMENTOS_PDV.map((opcao) => (
                                  <SelectItem key={opcao.formaPagamento} value={opcao.formaPagamento}>
                                    {opcao.rotulo}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label>Valor</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={linha.valorBruto || ""}
                              onChange={(e) => {
                                const valor = Number(e.target.value) || 0;
                                atualizarLinha(linha.id, { valorBruto: valor });
                              }}
                            />
                          </div>
                        </div>

                        {config?.permiteParcelas && (
                          <div className="space-y-1">
                            <Label>Parcelas</Label>
                            <Input
                              type="number"
                              min={1}
                              max={24}
                              value={linha.parcelas}
                              onChange={(e) => {
                                const parcelas = Math.max(1, Number(e.target.value) || 1);
                                atualizarLinha(linha.id, { parcelas });
                              }}
                            />
                          </div>
                        )}

                        {config?.exigePrazo && (
                          <div className="space-y-1">
                            <Label>Dias para vencimento</Label>
                            <Input
                              type="number"
                              min={0}
                              max={3650}
                              value={linha.diasVencimento}
                              onChange={(e) => {
                                const dias = Math.max(0, Number(e.target.value) || 0);
                                atualizarLinha(linha.id, { diasVencimento: dias });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {totalDinheiro > 0 && (
                <div className="space-y-2">
                  <Label>Valor recebido em dinheiro</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0,00"
                    value={valorRecebidoDinheiro || ""}
                    onChange={(e) =>
                      setValorRecebidoDinheiro(Number(e.target.value) || 0)
                    }
                  />
                  <div className="flex gap-2 flex-wrap">
                    {[totalDinheiro, 50, 100, 200].map((v, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setValorRecebidoDinheiro(v)}
                      >
                        {idx === 0 ? "Exato" : formatarMoeda(v)}
                      </Button>
                    ))}
                  </div>
                  {dinheiroInsuficiente && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Valor recebido menor que o total.
                    </p>
                  )}
                </div>
              )}

              {/* Resumo de taxas */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total da venda</span>
                  <span>{formatarMoeda(total)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total informado</span>
                  <span>{formatarMoeda(totalInformado)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Diferenca</span>
                  <span className={diferenca === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {formatarMoeda(diferenca)}
                  </span>
                </div>
                <div className="flex justify-between text-orange-600 dark:text-orange-400">
                  <span>Taxas totais</span>
                  <span>- {formatarMoeda(totalTaxas)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span>Você recebe (líquido)</span>
                  <span>{formatarMoeda(totalLiquido)}</span>
                </div>
                {totalDinheiro > 0 && valorRecebidoDinheiro >= totalDinheiro && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                    <span>Troco</span>
                    <span>{formatarMoeda(troco)}</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleFechar}
                disabled={processando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmar}
                disabled={!podeConfirmar}
              >
                {processando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>Confirmar Recebimento</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
