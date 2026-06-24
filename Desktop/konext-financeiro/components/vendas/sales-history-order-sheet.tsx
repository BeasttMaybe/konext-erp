"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Loader2, XCircle } from "lucide-react";
import { aprovarPedido, cancelarPedido, rejeitarPedido } from "@/app/actions/vendas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OrderStatus = "PENDENTE" | "APROVADO" | "REJEITADO" | "CANCELADO";
type OrderOrigin = "PDV" | "VENDAS";

type PaymentMethod =
  | "PIX"
  | "TED"
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_CREDITO_AVISTA"
  | "CARTAO_CREDITO_PARCELADO"
  | "CARTAO_DEBITO"
  | "BOLETO"
  | "CREDIARIO"
  | "EMPENHO_PUBLICO"
  | null;

interface OrderItemSummary {
  id: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

interface OrderInstallmentSummary {
  id: string;
  valor: number;
  dataVencimento: string;
}

interface SalesHistoryOrderSheetProps {
  trigger?: ReactNode;
  order: {
    id: string;
    numeroPedido: number;
    status: OrderStatus;
    origem: OrderOrigin;
    total: number;
    vendedor: string;
    formaPagamento: PaymentMethod;
    pagamentos?: Array<{
      formaPagamento: string;
      valorBruto: number;
    }>;
    clienteNome: string;
    itens: OrderItemSummary[];
    parcelas: OrderInstallmentSummary[];
  };
}

const statusLabelMap: Record<OrderStatus, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  CANCELADO: "Cancelado",
};

const statusClassNameMap: Record<OrderStatus, string> = {
  PENDENTE: "border-amber-400/20 bg-amber-500/15 text-amber-200 hover:bg-amber-500/20",
  APROVADO: "border-emerald-400/20 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20",
  REJEITADO: "border-rose-400/20 bg-rose-500/15 text-rose-200 hover:bg-rose-500/20",
  CANCELADO: "border-red-400/20 bg-red-500/15 text-red-200 hover:bg-red-500/20",
};

const originLabelMap: Record<OrderOrigin, string> = {
  PDV: "PDV",
  VENDAS: "Vendas",
};

const paymentMethodLabelMap: Record<Exclude<PaymentMethod, null>, string> = {
  PIX: "PIX",
  TED: "TED",
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_CREDITO_AVISTA: "Cartão de Crédito (À vista)",
  CARTAO_CREDITO_PARCELADO: "Cartão de Crédito (Parcelado)",
  CARTAO_DEBITO: "Cartão de Débito",
  BOLETO: "Boleto",
  CREDIARIO: "Crediário",
  EMPENHO_PUBLICO: "Empenho Público",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

export function SalesHistoryOrderSheet({ trigger, order }: SalesHistoryOrderSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPdvApprovedOrder = order.origem === "PDV" && order.status === "APROVADO";
  const isLocked = order.status === "REJEITADO" || order.status === "CANCELADO" || (order.status === "APROVADO" && order.origem !== "PDV");
  const isMissingApprovalData = !order.formaPagamento || order.itens.length === 0;

  const paymentRows = useMemo(() => {
    if ((order.pagamentos?.length ?? 0) > 0) {
      return order.pagamentos!.map((payment) => ({
        label: paymentMethodLabelMap[payment.formaPagamento as Exclude<PaymentMethod, null>] ?? payment.formaPagamento,
        value: payment.valorBruto,
      }));
    }

    return [
      {
        label: order.formaPagamento ? paymentMethodLabelMap[order.formaPagamento] : "Não informado",
        value: order.total,
      },
    ];
  }, [order.formaPagamento, order.pagamentos, order.total]);

  const handleApprove = () => {
    if (isMissingApprovalData) {
      setFeedbackMessage("Este pedido foi criado sem itens ou forma de pagamento persistidos.");
      return;
    }

    setFeedbackMessage(null);

    startTransition(async () => {
      const result = await aprovarPedido(order.id);

      if (!result.success) {
        setFeedbackMessage(result.message);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  const handleReject = () => {
    setFeedbackMessage(null);

    startTransition(async () => {
      const result = await rejeitarPedido(order.id);

      if (!result.success) {
        setFeedbackMessage(result.message);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  const handleCancel = () => {
    setFeedbackMessage(null);

    startTransition(async () => {
      const result = await cancelarPedido(order.id);

      if (!result.success) {
        setFeedbackMessage(result.message);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Ver detalhes do pedido" className="text-slate-300 hover:bg-white/5 hover:text-slate-100">
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/10 bg-slate-950 p-0 text-slate-100 sm:max-w-2xl"
      >
        <div className="flex min-h-full flex-col">
          <SheetHeader className="border-b border-white/10 bg-slate-950/95 px-6 py-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 pr-8">
              <div>
                <SheetTitle className="text-xl text-slate-50">Revisão do Pedido</SheetTitle>
                <p className="mt-1 text-sm text-slate-400">Confira os dados antes de aprovar ou rejeitar a venda.</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Origem: {originLabelMap[order.origem]}</p>
              </div>
              <Badge className={statusClassNameMap[order.status]}>{statusLabelMap[order.status]}</Badge>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-6 py-6">
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cliente</p>
                <p className="mt-2 text-sm font-medium text-slate-100">{order.clienteNome}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pedido</p>
                <p className="mt-2 text-sm font-medium text-slate-100">#{order.numeroPedido}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Valor Total</p>
                <p className="mt-2 text-sm font-medium text-slate-100">{formatCurrency(order.total)}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="border-b border-white/10 px-5 py-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Itens do Pedido</h3>
              </div>

              {order.itens.length === 0 ? (
                <div className="space-y-2 px-5 py-8">
                  <p className="text-sm text-slate-300">Nenhum item registrado neste pedido.</p>
                  <p className="text-xs text-amber-300/80">
                    Este pedido foi salvo antes da persistência completa dos itens no histórico.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="border-white/10 bg-white/[0.03]">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-slate-300">Produto</TableHead>
                      <TableHead className="text-slate-300">Qtd.</TableHead>
                      <TableHead className="text-right text-slate-300">Preço Unit.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.itens.map((item) => (
                      <TableRow key={item.id} className="border-white/10 hover:bg-transparent">
                        <TableCell className="text-slate-100">{item.nome}</TableCell>
                        <TableCell className="text-slate-300">{item.quantidade}</TableCell>
                        <TableCell className="text-right text-slate-100">{formatCurrency(item.precoUnitario)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Pagamento</h3>
                <div className="mt-3 space-y-2">
                  {paymentRows.map((payment, index) => (
                    <div
                      key={`${payment.label}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm"
                    >
                      <span className="text-slate-200">{payment.label}</span>
                      <span className="font-medium text-slate-100">{formatCurrency(payment.value)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-sm text-slate-400">Vendedor: {order.vendedor}</p>
                {!order.formaPagamento && (
                  <p className="mt-2 text-xs text-amber-300/80">
                    Este pedido foi salvo sem a forma de pagamento persistida.
                  </p>
                )}
              </div>

              {order.parcelas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Parcelas</p>
                  <div className="space-y-2">
                    {order.parcelas.map((installment, index) => (
                      <div
                        key={installment.id}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm"
                      >
                        <span className="text-slate-200">{index + 1}ª parcela</span>
                        <div className="text-right">
                          <p className="text-slate-100">{formatCurrency(installment.valor)}</p>
                          <p className="text-xs text-slate-400">Vencimento: {formatDate(installment.dataVencimento)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {feedbackMessage && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {feedbackMessage}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-slate-950/95 px-6 py-5 backdrop-blur-xl">
            {isLocked ? (
              <Button
                type="button"
                disabled
                className="w-full border border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-800"
              >
                Pedido Bloqueado - {statusLabelMap[order.status]}
              </Button>
            ) : isPdvApprovedOrder ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={isPending}
                className="w-full"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Cancelar Pedido
              </Button>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isPending}
                  className="sm:min-w-40"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Rejeitar
                </Button>
                <Button
                  type="button"
                  onClick={handleApprove}
                  disabled={isPending || isMissingApprovalData}
                  className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 sm:min-w-40"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Aprovar Venda
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
