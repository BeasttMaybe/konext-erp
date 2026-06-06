"use client";

import { ContaAPagar, StatusConta } from "@/types/financeiro";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Trash2, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TabelaContasAPagarProps {
  contas: ContaAPagar[];
  aoMarcarPago: (id: string, status: string) => void;
  aoDeletar: (id: string) => void;
}

/**
 * Tabela de Contas a Pagar
 * Exibe lista de contas com status, valores e ações
 */
export function TabelaContasAPagar({
  contas,
  aoMarcarPago,
  aoDeletar,
}: TabelaContasAPagarProps) {
  const [contaParaDeletar, setContaParaDeletar] = useState<string | null>(null);

  // Formatar data
  const formatarData = (data: string): string => {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  // Formatar moeda
  const formatarMoeda = (valor: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  // Mapear badge de status
  const getBadgeStatus = (
    status: StatusConta
  ): { label: string; variant: any } => {
    const mapeamento: Record<StatusConta, { label: string; variant: any }> = {
      PENDENTE: { label: "Pendente", variant: "secondary" },
      PAGO: { label: "Pago", variant: "default" },
      ATRASADO: { label: "Atrasado", variant: "destructive" },
      CANCELADO: { label: "Cancelado", variant: "outline" },
    };
    return mapeamento[status];
  };

  if (contas.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">
          Nenhuma conta a pagar encontrada
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <TableHead className="font-semibold">Descrição</TableHead>
              <TableHead className="font-semibold">Fornecedor</TableHead>
              <TableHead className="font-semibold text-right">Valor</TableHead>
              <TableHead className="font-semibold">Vencimento</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-10 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contas.map((conta) => {
              const badgeStatus = getBadgeStatus(conta.status);
              return (
                <TableRow
                  key={conta.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <TableCell className="font-medium">
                    {conta.descricao}
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">
                    {conta.fornecedor}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatarMoeda(conta.valor)}
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">
                    {formatarData(conta.dataVencimento)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeStatus.variant}>
                      {badgeStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Abrir menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {conta.status !== "PAGO" && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                aoMarcarPago(conta.id, "PAGO")
                              }
                              className="cursor-pointer"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Marcar como Pago
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => setContaParaDeletar(conta.id)}
                          className="cursor-pointer text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-950 focus:text-red-600 dark:focus:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={!!contaParaDeletar}
        onOpenChange={(aberto) => {
          if (!aberto) setContaParaDeletar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta a Pagar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (contaParaDeletar) {
                  aoDeletar(contaParaDeletar);
                  setContaParaDeletar(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
