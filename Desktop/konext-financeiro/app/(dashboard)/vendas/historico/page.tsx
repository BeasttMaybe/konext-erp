import Link from "next/link";
import { OrigemPedido, Prisma, StatusPedido } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
} from "lucide-react";
import { SalesHistoryOrderSheet } from "@/components/vendas/sales-history-order-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

const ITEMS_PER_PAGE = 10;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const statusLabelMap: Record<StatusPedido, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  CANCELADO: "Cancelado",
};

const statusClassNames: Record<StatusPedido, string> = {
  PENDENTE: "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-300",
  APROVADO: "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-300",
  REJEITADO: "border-red-500/30 bg-red-500/12 text-red-700 dark:border-red-400/30 dark:bg-red-400/12 dark:text-red-300",
  CANCELADO: "border-red-500/30 bg-red-500/12 text-red-700 dark:border-red-400/30 dark:bg-red-400/12 dark:text-red-300",
};

const originLabelMap: Record<OrigemPedido, string> = {
  PDV: "PDV",
  VENDAS: "Vendas",
};

const originClassNames: Record<OrigemPedido, string> = {
  PDV: "border-blue-500/30 bg-blue-500/12 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/12 dark:text-blue-300",
  VENDAS: "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200",
};

async function syncLegacyPdvSalesIntoOrderHistory() {
  const mirroredSaleIds = await prisma.pedidoVenda.findMany({
    where: {
      vendaId: {
        not: null,
      },
    },
    select: {
      vendaId: true,
    },
  });

  const legacySales = await prisma.venda.findMany({
    where: mirroredSaleIds.length
      ? {
          id: {
            notIn: mirroredSaleIds.flatMap((sale) => (sale.vendaId ? [sale.vendaId] : [])),
          },
        }
      : undefined,
    include: {
      itens: {
        select: {
          produtoId: true,
          descricao: true,
          quantidade: true,
          precoUnitario: true,
          subtotal: true,
        },
      },
    },
  });

  if (legacySales.length === 0) {
    return;
  }

  for (const sale of legacySales) {
    try {
      await prisma.pedidoVenda.upsert({
        where: {
          vendaId: sale.id,
        },
        update: {},
        create: {
          venda: {
            connect: {
              id: sale.id,
            },
          },
          ...(sale.clienteId
            ? {
                cliente: {
                  connect: {
                    id: sale.clienteId,
                  },
                },
              }
            : {}),
          vendedor: "PDV",
          total: sale.valorTotal,
          origem: "PDV",
          status: "APROVADO",
          formaPagamento: sale.formaPagamento,
          dataCriacao: sale.criadoEm,
          itens: {
            create: sale.itens.map((item) => ({
              produtoId: item.produtoId,
              nome: item.descricao,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              descontoPorcentagem: 0,
              subtotal: item.subtotal,
            })),
          },
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }
  }
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = {
  title: "Histórico de Vendas - Konext ERP",
  description: "Acompanhe e gerencie todos os pedidos emitidos.",
};

export default async function SalesHistoryPage({ searchParams }: PageProps) {
  await syncLegacyPdvSalesIntoOrderHistory();

  const params = await searchParams;

  const clientFilter = getSingleParam(params, "cliente")?.trim() ?? "";
  const sellerFilter = getSingleParam(params, "vendedor")?.trim() ?? "";
  const statusFilter = getSingleParam(params, "status")?.trim() ?? "";
  const requestedPage = Number(getSingleParam(params, "page") ?? "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const where: Prisma.PedidoVendaWhereInput = {};

  if (clientFilter) {
    where.cliente = {
      OR: [
        { nomeRazaoSocial: { contains: clientFilter, mode: "insensitive" } },
        { nomeFantasia: { contains: clientFilter, mode: "insensitive" } },
      ],
    };
  }

  if (sellerFilter) {
    where.vendedor = {
      contains: sellerFilter,
      mode: "insensitive",
    };
  }

  if (statusFilter && ["PENDENTE", "APROVADO", "REJEITADO", "CANCELADO"].includes(statusFilter)) {
    where.status = statusFilter as StatusPedido;
  }

  const totalOrders = await prisma.pedidoVenda.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalOrders / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  const orders = await prisma.pedidoVenda.findMany({
    where,
    include: {
      cliente: {
        select: {
          nomeRazaoSocial: true,
          nomeFantasia: true,
        },
      },
      itens: {
        select: {
          id: true,
          nome: true,
          quantidade: true,
          precoUnitario: true,
        },
      },
      parcelas: {
        select: {
          id: true,
          valor: true,
          dataVencimento: true,
        },
        orderBy: {
          dataVencimento: "asc",
        },
      },
    },
    orderBy: {
      dataCriacao: "desc",
    },
    skip,
    take: ITEMS_PER_PAGE,
  });

  const buildHistoryHref = (nextPage: number) => {
    const query = new URLSearchParams();

    if (clientFilter) query.set("cliente", clientFilter);
    if (sellerFilter) query.set("vendedor", sellerFilter);
    if (statusFilter) query.set("status", statusFilter);
    if (nextPage > 1) query.set("page", String(nextPage));

    const queryString = query.toString();
    return queryString ? `/vendas/historico?${queryString}` : "/vendas/historico";
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-transparent">
      <div className="border-b border-white/10 bg-slate-950/55 px-6 py-6 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
              Gestão Comercial
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 lg:text-4xl">
              Histórico de Vendas
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/80 lg:text-base">
              Acompanhe e gerencie todos os pedidos emitidos.
            </p>
          </div>

          <Button
            asChild
            size="lg"
            className="bg-cyan-400 text-slate-950 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.9)] hover:bg-cyan-300"
          >
            <Link href="/vendas/pedidos/novo">
              <Plus className="h-4 w-4" />
              Novo Pedido
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl">
            <form className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_220px_auto_auto] xl:items-end">
              <div className="space-y-2">
                <label htmlFor="cliente" className="text-sm font-medium text-slate-200">
                  Cliente
                </label>
                <Input
                  id="cliente"
                  name="cliente"
                  defaultValue={clientFilter}
                  placeholder="Buscar por cliente..."
                  className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="vendedor" className="text-sm font-medium text-slate-200">
                  Vendedor
                </label>
                <Input
                  id="vendedor"
                  name="vendedor"
                  defaultValue={sellerFilter}
                  placeholder="Buscar por vendedor..."
                  className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2 xl:mt-1.5">
                <label className="text-sm font-medium text-slate-200">Status</label>
                <Select name="status" defaultValue={statusFilter || "TODOS"}>
                  <SelectTrigger className="h-8 rounded-lg border-white/10 bg-slate-900/80 px-2.5 py-1 text-slate-100">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="APROVADO">Aprovado</SelectItem>
                    <SelectItem value="REJEITADO">Rejeitado</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                Aplicar filtros
              </Button>

              <Button asChild type="button" variant="outline" className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80">
                <Link href="/vendas/historico">Limpar</Link>
              </Button>
            </form>
          </Card>

          <Card className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Pedidos Emitidos</h2>
                  <p className="mt-1 text-sm text-slate-400">Visualize o histórico de pedidos com status e ações rápidas.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                  {totalOrders} registros
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-white/10 bg-white/[0.03]">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-300">Pedido</TableHead>
                    <TableHead className="text-slate-300">Data</TableHead>
                    <TableHead className="text-slate-300">Cliente</TableHead>
                    <TableHead className="text-slate-300">Vendedor</TableHead>
                    <TableHead className="text-slate-300">Origem</TableHead>
                    <TableHead className="text-slate-300">Valor Total</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-right text-slate-300">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={8} className="py-12 text-center text-slate-400">
                        Nenhum pedido encontrado para os filtros informados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => {
                      return (
                      <TableRow key={order.id} className="border-white/10 hover:bg-white/[0.03]">
                        <TableCell className="font-medium text-slate-100">#{order.numeroPedido}</TableCell>
                        <TableCell className="text-slate-300">{order.dataCriacao.toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-slate-300">
                          {order.cliente?.nomeFantasia?.trim() || order.cliente?.nomeRazaoSocial || "Cliente não informado"}
                        </TableCell>
                        <TableCell className="text-slate-300">{order.vendedor}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={originClassNames[order.origem]}>
                            {originLabelMap[order.origem]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-100">{formatCurrency(order.total)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClassNames[order.status]}>
                            {statusLabelMap[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end">
                            <SalesHistoryOrderSheet
                              trigger={
                                <Button type="button" variant="ghost" size="icon-sm" aria-label="Ver detalhes do pedido" className="text-slate-300 hover:bg-white/5 hover:text-slate-100">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              }
                              order={{
                                id: order.id,
                                numeroPedido: order.numeroPedido,
                                status: order.status,
                                origem: order.origem,
                                total: order.total,
                                vendedor: order.vendedor,
                                formaPagamento: order.formaPagamento,
                                clienteNome:
                                  order.cliente?.nomeFantasia?.trim() ||
                                  order.cliente?.nomeRazaoSocial ||
                                  "Cliente não informado",
                                itens: order.itens,
                                parcelas: order.parcelas.map((installment) => ({
                                  ...installment,
                                  dataVencimento: installment.dataVencimento.toISOString(),
                                })),
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );})
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
              <p className="text-sm text-slate-400">
                Página {currentPage} de {totalPages}
              </p>

              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Button asChild variant="outline" className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80">
                    <Link href={buildHistoryHref(currentPage - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="border-white/10 bg-slate-900/70 text-slate-100">
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                )}

                {currentPage < totalPages ? (
                  <Button asChild variant="outline" className="border-white/10 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80">
                    <Link href={buildHistoryHref(currentPage + 1)}>
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="border-white/10 bg-slate-900/70 text-slate-100">
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}