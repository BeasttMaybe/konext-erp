"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { darBaixaConta, listarContasReceber, type ContaReceberFinanceiro } from "@/app/actions/financeiro-receber";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type StatusExibicao = "PENDENTE" | "ATRASADO" | "RECEBIDO";

const mapaFormaPagamento: Record<ContaReceberFinanceiro["formaRecebimento"], string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartao de Credito",
  CARTAO_DEBITO: "Cartao de Debito",
  DINHEIRO: "Dinheiro",
  CREDIARIO: "Crediario",
  EMPENHO_PUBLICO: "Empenho Publico",
};

function obterInicioDiaAtual(): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

function obterStatusExibicao(conta: ContaReceberFinanceiro, inicioDiaAtual: Date): StatusExibicao {
  if (conta.status === "RECEBIDO") return "RECEBIDO";
  if (conta.dataVencimento < inicioDiaAtual) return "ATRASADO";
  return "PENDENTE";
}

function obterBadgeStatus(status: StatusExibicao) {
  if (status === "RECEBIDO") {
    return <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Recebido</Badge>;
  }

  if (status === "ATRASADO") {
    return <Badge variant="destructive">Atrasado</Badge>;
  }

  return <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Pendente</Badge>;
}

export default function FinanceiroReceberPage() {
  const [contas, setContas] = useState<ContaReceberFinanceiro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<ContaReceberFinanceiro | null>(null);
  const [baixandoConta, setBaixandoConta] = useState(false);

  const carregarContas = async () => {
    try {
      setCarregando(true);
      const lista = await listarContasReceber();
      setContas(lista);
    } catch {
      toast.error("Nao foi possivel carregar as contas a receber.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarContas();
  }, []);

  const inicioDiaAtual = useMemo(() => obterInicioDiaAtual(), []);

  const metricas = useMemo(() => {
    const totalPendente = contas.reduce((acumulado, conta) => {
      const estaPendente = conta.status === "PENDENTE" && conta.dataVencimento >= inicioDiaAtual;
      return acumulado + (estaPendente ? conta.valor : 0);
    }, 0);

    const totalAtrasado = contas.reduce((acumulado, conta) => {
      const estaAtrasada = conta.status === "PENDENTE" && conta.dataVencimento < inicioDiaAtual;
      return acumulado + (estaAtrasada ? conta.valor : 0);
    }, 0);

    return { totalPendente, totalAtrasado };
  }, [contas, inicioDiaAtual]);

  const aoConfirmarBaixa = async () => {
    if (!contaSelecionada) return;

    try {
      setBaixandoConta(true);
      await darBaixaConta(contaSelecionada.id);
      toast.success("Conta baixada com sucesso.");
      setContaSelecionada(null);
      await carregarContas();
    } catch {
      toast.error("Nao foi possivel dar baixa nesta conta.");
    } finally {
      setBaixandoConta(false);
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl mx-auto w-full space-y-2">
          <Link
            href="/financeiro"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Contas a Receber</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Controle de titulos pendentes, inadimplencia e confirmacao de recebimento.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">Total Pendente</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {formatadorMoeda.format(metricas.totalPendente)}
                </p>
              </Card>

              <Card className="border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">Total Atrasado</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                  {formatadorMoeda.format(metricas.totalAtrasado)}
                </p>
              </Card>
            </div>

            <Card className="border-border bg-card p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.map((conta) => {
                    const statusExibicao = obterStatusExibicao(conta, inicioDiaAtual);
                    const origem = `${mapaFormaPagamento[conta.formaRecebimento]} / ${conta.vendaId ? `Venda ${conta.vendaId.slice(0, 8)}` : "Sem venda"}`;

                    return (
                      <TableRow key={conta.id}>
                        <TableCell className="font-medium text-foreground">{origem}</TableCell>
                        <TableCell>{conta.cliente?.nomeRazaoSocial || "Cliente nao identificado"}</TableCell>
                        <TableCell>{format(new Date(conta.dataVencimento), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{formatadorMoeda.format(conta.valor)}</TableCell>
                        <TableCell>{obterBadgeStatus(statusExibicao)}</TableCell>
                        <TableCell className="text-right">
                          {statusExibicao !== "RECEBIDO" ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Abrir acoes da conta">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setContaSelecionada(conta)}>
                                  Dar Baixa
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {!carregando && contas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma conta a receber encontrada.
                      </TableCell>
                    </TableRow>
                  )}

                  {carregando && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Carregando contas a receber...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog
        open={Boolean(contaSelecionada)}
        onOpenChange={(aberto) => {
          if (!aberto) setContaSelecionada(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que este valor ja consta na conta bancaria?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={baixandoConta}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aoConfirmarBaixa} disabled={baixandoConta}>
              {baixandoConta ? "Confirmando..." : "Dar Baixa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
