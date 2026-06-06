"use client";

import { useEffect, useMemo, useState } from "react";
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
  Banknote,
  CreditCard,
  FileText,
  QrCode,
  Landmark,
  Loader2,
  MessageCircle,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

export type FormaPagamento =
  | "DINHEIRO"
  | "PIX"
  | "DEBITO"
  | "CREDITO_VISTA"
  | "CREDITO_PARCELADO";

export interface DadosPagamento {
  formaPagamento: FormaPagamento;
  parcelas: number;
  taxaPercentual: number;
  valorTaxa: number;
  totalLiquido: number;
  totalCobrado: number;
  valorRecebido?: number;
  troco?: number;
}

interface OpcaoPagamento {
  valor: FormaPagamento;
  rotulo: string;
  icone: React.ReactNode;
  /** Taxa base da maquininha em % */
  taxa: number;
}

const opcoesPagamento: OpcaoPagamento[] = [
  {
    valor: "DINHEIRO",
    rotulo: "Dinheiro",
    icone: <Banknote className="h-5 w-5" />,
    taxa: 0,
  },
  {
    valor: "PIX",
    rotulo: "PIX",
    icone: <QrCode className="h-5 w-5" />,
    taxa: 0,
  },
  {
    valor: "DEBITO",
    rotulo: "Débito",
    icone: <Landmark className="h-5 w-5" />,
    taxa: 1.36,
  },
  {
    valor: "CREDITO_VISTA",
    rotulo: "Crédito à vista",
    icone: <CreditCard className="h-5 w-5" />,
    taxa: 3.14,
  },
  {
    valor: "CREDITO_PARCELADO",
    rotulo: "Crédito parcelado",
    icone: <CreditCard className="h-5 w-5" />,
    taxa: 5.38,
  },
];

/**
 * Tabela de taxas de crédito parcelado (2x a 10x).
 */
const taxaPorParcela = (parcelas: number): number => {
  const tabelaTaxas: Record<number, number> = {
    2: 5.38,
    3: 6.11,
    4: 6.84,
    5: 7.56,
    6: 8.27,
    7: 8.98,
    8: 9.68,
    9: 10.37,
    10: 11.05,
  };

  if (parcelas <= 2) return tabelaTaxas[2];
  if (parcelas >= 10) return tabelaTaxas[10];
  return tabelaTaxas[parcelas];
};

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

interface PropsModalPagamento {
  aberto: boolean;
  total: number;
  aoFechar: () => void;
  aoConfirmar: (dados: DadosPagamento) => void;
  aoNovaVenda: () => void;
}

export function ModalPagamento({
  aberto,
  total,
  aoFechar,
  aoConfirmar,
  aoNovaVenda,
}: PropsModalPagamento) {
  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [parcelas, setParcelas] = useState(1);
  const [valorRecebido, setValorRecebido] = useState<number>(0);
  const [processando, setProcessando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(false);

  // Taxa efetiva conforme forma de pagamento e parcelas
  const taxaPercentual = useMemo(() => {
    if (forma === "CREDITO_PARCELADO") return taxaPorParcela(parcelas);
    const opcao = opcoesPagamento.find((o) => o.valor === forma);
    return opcao?.taxa ?? 0;
  }, [forma, parcelas]);

  const valorTaxa = useMemo(
    () => total * (taxaPercentual / 100),
    [total, taxaPercentual]
  );

  // Valor líquido que o lojista recebe (descontada a taxa da maquininha)
  const totalLiquido = useMemo(
    () => total - valorTaxa,
    [total, valorTaxa]
  );

  const troco = useMemo(() => {
    if (forma !== "DINHEIRO") return 0;
    return Math.max(0, valorRecebido - total);
  }, [forma, valorRecebido, total]);

  const valorParcela = useMemo(
    () => (parcelas > 0 ? total / parcelas : total),
    [parcelas, total]
  );

  const dinheiroInsuficiente =
    forma === "DINHEIRO" && valorRecebido > 0 && valorRecebido < total;

  const podeConfirmar =
    !processando &&
    total > 0 &&
    (forma !== "DINHEIRO" || valorRecebido >= total);

  const resetar = () => {
    setForma("DINHEIRO");
    setParcelas(1);
    setValorRecebido(0);
    setProcessando(false);
    setVendaFinalizada(false);
  };

  // Reseta o estado interno sempre que o modal é fechado
  useEffect(() => {
    if (!aberto) resetar();
  }, [aberto]);

  const handleFechar = () => {
    aoFechar();
  };

  const handleConfirmar = () => {
    setProcessando(true);
    // Simula a comunicação com a maquininha / gateway
    setTimeout(() => {
      setProcessando(false);
      const dados: DadosPagamento = {
        formaPagamento: forma,
        parcelas: forma === "CREDITO_PARCELADO" ? parcelas : 1,
        taxaPercentual,
        valorTaxa,
        totalLiquido,
        totalCobrado: total,
        valorRecebido: forma === "DINHEIRO" ? valorRecebido : undefined,
        troco: forma === "DINHEIRO" ? troco : undefined,
      };
      aoConfirmar(dados);
      setVendaFinalizada(true);
    }, 1000);
  };

  const handleNovaVenda = () => {
    // Adia o fechamento um instante para evitar click-through no botão
    // de "Finalizar Venda" que fica atrás do modal.
    setTimeout(() => {
      aoNovaVenda();
      aoFechar();
    }, 80);
  };

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
            </div>

            <div className="w-full space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => window.print()}
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
                    "https://wa.me/?text=Ol%C3%A1!%20Segue%20o%20comprovante%20da%20sua%20compra%20na%20Konext...",
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
                Selecione a forma de pagamento. As taxas da maquininha são
                aplicadas automaticamente.
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

              {/* Formas de pagamento */}
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {opcoesPagamento.map((opcao) => {
                    const ativo = forma === opcao.valor;
                    return (
                      <button
                        key={opcao.valor}
                        type="button"
                        onClick={() => {
                          setForma(opcao.valor);
                          setParcelas(opcao.valor === "CREDITO_PARCELADO" ? 2 : 1);
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
                          ativo
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-blue-300 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {opcao.icone}
                        <span className="text-xs font-medium leading-tight">
                          {opcao.rotulo}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {opcao.valor === "CREDITO_PARCELADO"
                            ? "2x a 10x"
                            : opcao.taxa > 0
                              ? `taxa ${opcao.taxa}%`
                              : "sem taxa"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Parcelas (apenas crédito parcelado) */}
              {forma === "CREDITO_PARCELADO" && (
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select
                    value={String(parcelas)}
                    onValueChange={(v) => setParcelas(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de {formatarMoeda(total / n)} ({taxaPorParcela(n)}
                          %)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {parcelas}x de {formatarMoeda(valorParcela)}
                  </p>
                </div>
              )}

              {/* Valor recebido (apenas dinheiro) */}
              {forma === "DINHEIRO" && (
                <div className="space-y-2">
                  <Label>Valor recebido</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0,00"
                    value={valorRecebido || ""}
                    onChange={(e) =>
                      setValorRecebido(Number(e.target.value) || 0)
                    }
                  />
                  <div className="flex gap-2 flex-wrap">
                    {[total, 50, 100, 200].map((v, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setValorRecebido(v)}
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
                <div className="flex justify-between text-orange-600 dark:text-orange-400">
                  <span>
                    Taxa da maquininha ({taxaPercentual.toFixed(2)}%)
                  </span>
                  <span>- {formatarMoeda(valorTaxa)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span>Você recebe (líquido)</span>
                  <span>{formatarMoeda(totalLiquido)}</span>
                </div>
                {forma === "DINHEIRO" && valorRecebido >= total && (
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
