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
  | "PIX"
  | "DINHEIRO"
  | "CARTAO_DEBITO"
  | "CARTAO_CREDITO"
  | "BOLETO"
  | "CREDIARIO";

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
    valor: "PIX",
    rotulo: "PIX (Instantaneo)",
    icone: <QrCode className="h-5 w-5" />,
    taxa: 0,
  },
  {
    valor: "DINHEIRO",
    rotulo: "Dinheiro",
    icone: <Banknote className="h-5 w-5" />,
    taxa: 0,
  },
  {
    valor: "CARTAO_DEBITO",
    rotulo: "Cartao de Debito",
    icone: <Landmark className="h-5 w-5" />,
    taxa: 1.36,
  },
  {
    valor: "CARTAO_CREDITO",
    rotulo: "Cartao de Credito",
    icone: <CreditCard className="h-5 w-5" />,
    taxa: 3.14,
  },
  {
    valor: "BOLETO",
    rotulo: "Boleto Bancario (A prazo)",
    icone: <FileText className="h-5 w-5" />,
    taxa: 0,
  },
  {
    valor: "CREDIARIO",
    rotulo: "Crediario / Promissoria (A prazo)",
    icone: <FileText className="h-5 w-5" />,
    taxa: 0,
  },
];

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

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
  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [parcelas, setParcelas] = useState(1);
  const [valorRecebido, setValorRecebido] = useState<number>(0);
  const [processando, setProcessando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(false);
  const [vendaIdGerada, setVendaIdGerada] = useState<string | null>(null);

  // Taxa efetiva conforme forma de pagamento selecionada
  const taxaPercentual = useMemo(() => {
    const opcao = opcoesPagamento.find((o) => o.valor === forma);
    return opcao?.taxa ?? 0;
  }, [forma]);

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
    setVendaIdGerada(null);
  };

  const handleFechar = () => {
    resetar();
    aoFechar();
  };

  const handleConfirmar = async () => {
    setProcessando(true);

    const dados: DadosPagamento = {
      formaPagamento: forma,
      parcelas: 1,
      taxaPercentual,
      valorTaxa,
      totalLiquido,
      totalCobrado: total,
      valorRecebido: forma === "DINHEIRO" ? valorRecebido : undefined,
      troco: forma === "DINHEIRO" ? troco : undefined,
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
                Selecione a forma de pagamento para concluir o recebimento.
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
                          setParcelas(1);
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
                          {opcao.taxa > 0 ? `taxa ${opcao.taxa}%` : "sem taxa"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

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
