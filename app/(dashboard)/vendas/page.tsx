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
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { CabecalhoPagina } from "@/components/ui/pagina";
import { calcularPresetEsteMes, validarIntervalo } from "@/lib/filtro-periodo";
import { dataDeCalendario, fimDoDia, inicioDoDia } from "@/lib/datas";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { deDecimal, type EntradaDecimal, formatarReais, paraMoeda } from "@/lib/dinheiro";

const ITEMS_PER_PAGE = 10;
type PrismaTenant = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];

const formatCurrency = (value: EntradaDecimal) => formatarReais(deDecimal(value));

const paymentMethodLabelMap: Record<string, string> = {
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
 NAO_INFORMADO: "Não informado",
};

const formatPaymentMethod = (paymentMethod: string | null | undefined) => {
 if (!paymentMethod) return "Não informado";
 return paymentMethodLabelMap[paymentMethod] ?? paymentMethod;
};

const statusLabelMap: Record<StatusPedido, string> = {
 PENDENTE: "Pendente",
 APROVADO: "Aprovado",
 REJEITADO: "Rejeitado",
 CANCELADO: "Cancelado",
};

const statusClassNames: Record<StatusPedido, string> = {
 PENDENTE: "border-kx-alerta bg-kx-alerta-fundo text-kx-alerta-texto",
 APROVADO: "border-kx-sucesso bg-kx-sucesso-fundo text-kx-sucesso-texto",
 REJEITADO: "border-kx-erro-borda bg-kx-erro-fundo text-kx-erro-texto",
 CANCELADO: "border-kx-erro-borda bg-kx-erro-fundo text-kx-erro-texto",
};

const originLabelMap: Record<OrigemPedido, string> = {
 PDV: "PDV",
 VENDAS: "Vendas",
};

const originClassNames: Record<OrigemPedido, string> = {
 PDV: "border-kx-info bg-kx-info-fundo text-kx-info-texto",
 VENDAS: "border-kx-painel-borda bg-kx-superficie text-kx-texto-2",
};

type PedidoHistoricoComPagamentos = Prisma.PedidoVendaGetPayload<{
 include: {
 cliente: {
 select: {
 nomeRazaoSocial: true;
 nomeFantasia: true;
 };
 };
 itens: {
 select: {
 id: true;
 nome: true;
 quantidade: true;
 precoUnitario: true;
 };
 };
 parcelas: {
 select: {
 id: true;
 valor: true;
 dataVencimento: true;
 };
 };
 venda: {
 select: {
 pagamentos: {
 select: {
 formaPagamento: true;
 valorBruto: true;
 };
 };
 };
 };
 };
}>;

type PagamentoHistorico = {
 formaPagamento: string;
 valorBruto: number;
};

type PedidoHistoricoSeguro = Omit<PedidoHistoricoComPagamentos, "venda"> & {
 venda: {
 pagamentos: PagamentoHistorico[];
 } | null;
};

async function carregarPedidosHistorico(
 prisma: PrismaTenant,
 where: Prisma.PedidoVendaWhereInput,
 skip: number,
 take: number
): Promise<PedidoHistoricoSeguro[]> {
 const includeBase = {
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
 dataVencimento: "asc" as const,
 },
 },
 };

 try {
 const pedidos = await prisma.pedidoVenda.findMany({
 where,
 include: {
 ...includeBase,
 venda: {
 select: {
 pagamentos: {
 select: {
 formaPagamento: true,
 valorBruto: true,
 },
 orderBy: {
 criadoEm: "asc",
 },
 },
 },
 },
 },
 orderBy: {
 dataCriacao: "desc",
 },
 skip,
 take,
 });

 return pedidos.map((pedido) => ({
 ...pedido,
 venda: pedido.venda
 ? {
 pagamentos: pedido.venda.pagamentos.map((pagamento) => ({
 formaPagamento: pagamento.formaPagamento,
 valorBruto: paraMoeda(deDecimal(pagamento.valorBruto)),
 })),
 }
 : null,
 }));
 } catch {
 const pedidosLegado = await prisma.pedidoVenda.findMany({
 where,
 include: includeBase,
 orderBy: {
 dataCriacao: "desc",
 },
 skip,
 take,
 });

 const vendaIds = pedidosLegado
 .map((pedido) => pedido.vendaId)
 .filter((vendaId): vendaId is string => Boolean(vendaId));

 if (vendaIds.length === 0) {
 return pedidosLegado.map((pedido) => ({ ...pedido, venda: null }));
 }

 const pagamentosPorVenda = await prisma.$queryRaw<Array<{
 vendaId: string;
 formaPagamento: string;
 valorBruto: Prisma.Decimal;
 }>>`
 SELECT vp."vendaId" AS "vendaId", vp."formaPagamento"::text AS "formaPagamento", vp."valorBruto" AS "valorBruto"
 FROM "VendaPagamento" vp
 WHERE vp."vendaId" IN (${Prisma.join(vendaIds)})
 ORDER BY vp."criadoEm" ASC
 `;

 const mapaPagamentos = new Map<string, PagamentoHistorico[]>();
 for (const pagamento of pagamentosPorVenda) {
 const atual = mapaPagamentos.get(pagamento.vendaId) ?? [];
 atual.push({
 formaPagamento: pagamento.formaPagamento,
 valorBruto: paraMoeda(deDecimal(pagamento.valorBruto ?? 0)),
 });
 mapaPagamentos.set(pagamento.vendaId, atual);
 }

 return pedidosLegado.map((pedido) => ({
 ...pedido,
 venda: pedido.vendaId
 ? {
 pagamentos: mapaPagamentos.get(pedido.vendaId) ?? [],
 }
 : null,
 }));
 }
}

async function syncLegacyPdvSalesIntoOrderHistory(prisma: PrismaTenant) {
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
 title: "Vendas - Konext ERP",
 description: "Todas as vendas da loja, do balcão ao pedido.",
};

export default async function SalesHistoryPage({ searchParams }: PageProps) {
 const { prisma, fusoHorario } = await exigirContextoTenant();
 await syncLegacyPdvSalesIntoOrderHistory(prisma);

 const params = await searchParams;

 const clientFilter = getSingleParam(params, "cliente")?.trim() ?? "";
 const sellerFilter = getSingleParam(params, "vendedor")?.trim() ?? "";
 const statusFilter = getSingleParam(params, "status")?.trim() ?? "";
 const requestedPage = Number(getSingleParam(params, "page") ?? "1");
 const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

 // Período (Fase 2A-1, `FiltroPeriodo`) — esta tela não tinha filtro de
 // período algum antes (só cliente/vendedor/status/página). Sem inicio/fim
 // válidos na URL, cai no mês corrente — mesmo padrão adotado nas outras
 // telas desta fase.
 const intervaloPadrao = calcularPresetEsteMes(fusoHorario);
 const inicioParam = getSingleParam(params, "inicio");
 const fimParam = getSingleParam(params, "fim");
 const inicioValido = inicioParam ? dataDeCalendario(inicioParam) : null;
 const fimValido = fimParam ? dataDeCalendario(fimParam) : null;
 const periodo =
 inicioValido && fimValido && validarIntervalo(inicioValido, fimValido).valido
 ? { inicio: inicioValido, fim: fimValido }
 : intervaloPadrao;

 const where: Prisma.PedidoVendaWhereInput = {
 // `dataCriacao` é INSTANTE — inicio/fim do FiltroPeriodo são DATA DE
 // CALENDÁRIO, viram fronteira de instante no fuso da loja antes de
 // comparar (inicioDoDia/fimDoDia), nunca comparados direto.
 dataCriacao: {
 gte: inicioDoDia(periodo.inicio, fusoHorario),
 lte: fimDoDia(periodo.fim, fusoHorario),
 },
 };

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

 // O resumo responde "quanto entrou no período", e por isso conta SÓ o que
 // está aprovado — mesmo quando a pessoa filtrou a lista por cancelado.
 // Fazê-lo acompanhar o filtro de status mostraria "vendido R$ 4.200" numa
 // tela de pedidos cancelados, que é dinheiro que não entrou.
 const resumo = await prisma.pedidoVenda.aggregate({
 where: { ...where, status: "APROVADO" },
 _sum: { total: true },
 _count: true,
 });

 const vendidoCentavos = resumo._sum.total ? deDecimal(resumo._sum.total) : 0;
 const vendasAprovadas = resumo._count;
 const ticketMedioCentavos =
 vendasAprovadas > 0 ? Math.round(vendidoCentavos / vendasAprovadas) : 0;

 const totalPages = Math.max(1, Math.ceil(totalOrders / ITEMS_PER_PAGE));
 const currentPage = Math.min(page, totalPages);
 const skip = (currentPage - 1) * ITEMS_PER_PAGE;

 const orders = await carregarPedidosHistorico(prisma, where, skip, ITEMS_PER_PAGE);

 const buildHistoryHref = (nextPage: number) => {
 const query = new URLSearchParams();

 if (clientFilter) query.set("cliente", clientFilter);
 if (sellerFilter) query.set("vendedor", sellerFilter);
 if (statusFilter) query.set("status", statusFilter);
 if (inicioParam) query.set("inicio", inicioParam);
 if (fimParam) query.set("fim", fimParam);
 if (nextPage > 1) query.set("page", String(nextPage));

 const queryString = query.toString();
 return queryString ? `/vendas?${queryString}` : "/vendas";
 };

 return (
 <div className="w-full flex flex-col bg-transparent">
 <div className="px-6 py-6 lg:px-8">
 <div className="mx-auto max-w-7xl space-y-6">
 {/*
 Esta tela era /vendas/historico e não tinha link em lugar nenhum: o
 único jeito de chegar era terminar o formulário de pedido novo e ser
 redirecionado. Na frente dela havia um "Hub de Vendas" com oito
 cartões — cinco apontavam para `#`, dois repetiam o menu lateral, e o
 oitavo pulava direto para o formulário de pedido novo.

 Agora Vendas É a lista de vendas. Toda venda do balcão vira um pedido
 com origem PDV (ver app/actions/pdv.ts), então o que está aqui é o
 movimento inteiro da loja, não um canto dele.
 */}
 <CabecalhoPagina
 titulo="Vendas"
 acoes={
 <Button asChild>
 <Link href="/vendas/pedidos/novo">
 <Plus className="h-4 w-4" />
 Novo pedido
 </Link>
 </Button>
 }
 />

 <dl className="grid gap-4 sm:grid-cols-3">
 {[
 { rotulo: "Vendido no período", valor: formatarReais(vendidoCentavos) },
 {
 rotulo: "Vendas aprovadas",
 valor: String(vendasAprovadas),
 },
 { rotulo: "Ticket médio", valor: formatarReais(ticketMedioCentavos) },
 ].map((indicador) => (
 <div
 key={indicador.rotulo}
 className="rounded-kx-painel border border-kx-painel-borda bg-kx-cartao p-kx-4"
 >
 <dt className="text-xs text-kx-legenda">{indicador.rotulo}</dt>
 <dd className="mt-1 text-2xl font-semibold tabular-nums text-kx-texto">
 {indicador.valor}
 </dd>
 </div>
 ))}
 </dl>
 <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5 shadow-kx-painel">
 <form className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_180px_auto_auto_auto] xl:items-end">
 {/*
 O submit nativo (GET, sem JS) reconstrói a query string SÓ com
 os campos NOMEADOS deste form — sem estes dois hidden, aplicar
 cliente/vendedor/status apagaria inicio/fim que o FiltroPeriodo
 (abaixo, fora deste form) já tinha escrito na URL. O caminho
 inverso (FiltroPeriodo → cliente/vendedor/status) já é seguro:
 ele lê `useSearchParams()` e faz merge, nunca substitui tudo.
 */}
 <input type="hidden" name="inicio" defaultValue={inicioParam ?? ""} />
 <input type="hidden" name="fim" defaultValue={fimParam ?? ""} />

 <div className="space-y-2">
 <label htmlFor="cliente" className="text-sm font-medium text-kx-texto">
 Cliente
 </label>
 <Input
 id="cliente"
 name="cliente"
 defaultValue={clientFilter}
 placeholder="Buscar por cliente..."
 className="border-kx-painel-borda bg-kx-superficie text-kx-texto placeholder:text-kx-legenda"
 />
 </div>

 <div className="space-y-2">
 <label htmlFor="vendedor" className="text-sm font-medium text-kx-texto">
 Vendedor
 </label>
 <Input
 id="vendedor"
 name="vendedor"
 defaultValue={sellerFilter}
 placeholder="Buscar por vendedor..."
 className="border-kx-painel-borda bg-kx-superficie text-kx-texto placeholder:text-kx-legenda"
 />
 </div>

 <div className="space-y-2 xl:mt-1.5">
 <label className="text-sm font-medium text-kx-texto">Status</label>
 <Select name="status" defaultValue={statusFilter || "TODOS"}>
 <SelectTrigger className="h-8 rounded-lg border-kx-painel-borda bg-kx-superficie px-2.5 py-1 text-kx-texto">
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

 {/*
 Antes desta adoção, o gatilho aqui não levava rótulo nenhum
 (só um "Emitido em" solto ao lado, fora do botão) — a única
 das 7 adoções sem isso, inconsistente com as outras 6, que
 sempre mostram o campo dentro do próprio gatilho ("Vencimento:
 dd/mm/aaaa..."). `campos` abaixo corrige isso: o rótulo passa
 a fazer parte do botão, como em toda outra tela.
 */}
 <div className="space-y-2 xl:mt-1.5">
 <FiltroPeriodoPagina
 campos={[{ valor: "emitido-em", rotulo: "Emitido em" }]}
 fusoHorario={fusoHorario}
 />
 </div>

 <Button type="submit" className="bg-kx-primaria text-primary-foreground hover:bg-kx-primaria">
 Aplicar filtros
 </Button>

 <Button asChild type="button" variant="outline" className="border-kx-painel-borda bg-kx-superficie text-kx-texto hover:bg-kx-painel/80">
 <Link href="/vendas">Limpar</Link>
 </Button>
 </form>
 </Card>

 <Card className="overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel shadow-kx-painel">
 <div className="border-b border-kx-painel-borda px-5 py-4">
 <div className="flex items-center justify-between gap-3">
 <div>
 {/* "Pedidos Emitidos" descrevia metade do conteúdo: a coluna Origem
 separa o que foi fechado no balcão (PDV) do que foi digitado como
 pedido, e a maior parte das linhas de uma assistência técnica é a
 primeira. Chamar tudo de pedido faz a pessoa procurar a venda do
 balcão em outro lugar — que não existe. */}
 <h2 className="text-lg font-semibold text-kx-texto">Vendas do período</h2>
 <p className="mt-1 text-sm text-kx-legenda">
 Balcão e pedidos, na mesma lista. A coluna Origem diz de onde veio cada uma.
 </p>
 </div>
 <div className="rounded-full border border-kx-painel-borda bg-kx-cartao px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-kx-texto-2">
 {totalOrders} registros
 </div>
 </div>
 </div>

 <div className="overflow-x-auto">
 <Table>
 <TableHeader className="sticky top-0 z-kx-sticky border-kx-painel-borda bg-kx-fundo">
 <TableRow className="border-kx-painel-borda hover:bg-transparent">
 <TableHead className="text-kx-texto-2">Pedido</TableHead>
 <TableHead className="text-kx-texto-2">Data</TableHead>
 <TableHead className="text-kx-texto-2">Cliente</TableHead>
 <TableHead className="text-kx-texto-2">Vendedor</TableHead>
 <TableHead className="text-kx-texto-2">Origem</TableHead>
 <TableHead className="text-kx-texto-2">Pagamentos</TableHead>
 <TableHead className="text-kx-texto-2">Valor Total</TableHead>
 <TableHead className="text-kx-texto-2">Status</TableHead>
 <TableHead className="text-right text-kx-texto-2">Ações</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {orders.length === 0 ? (
 <TableRow className="border-kx-painel-borda hover:bg-transparent">
 <TableCell colSpan={9} className="py-12 text-center text-kx-legenda">
 Nenhum pedido encontrado para os filtros informados.
 </TableCell>
 </TableRow>
 ) : (
 orders.map((order) => {
 const orderPayments = (order.venda?.pagamentos ?? []).map((payment) => ({
 formaPagamento: payment.formaPagamento,
 valorBruto: payment.valorBruto,
 }));

 const paymentSummaryLabel = orderPayments.length > 0
 ? orderPayments
 .map((payment) => `${formatPaymentMethod(payment.formaPagamento)} ${formatCurrency(payment.valorBruto)}`)
 .join(" + ")
 : formatPaymentMethod(order.formaPagamento);

 return (
 <TableRow key={order.id} className="border-kx-painel-borda hover:bg-kx-painel/[0.03]">
 <TableCell className="font-medium text-kx-texto">#{order.numeroPedido}</TableCell>
 <TableCell className="text-kx-texto-2">{order.dataCriacao.toLocaleDateString("pt-BR")}</TableCell>
 <TableCell className="text-kx-texto-2">
 {order.cliente?.nomeFantasia?.trim() || order.cliente?.nomeRazaoSocial || "Cliente não informado"}
 </TableCell>
 <TableCell className="text-kx-texto-2">{order.vendedor}</TableCell>
 <TableCell>
 <Badge variant="outline" className={originClassNames[order.origem]}>
 {originLabelMap[order.origem]}
 </Badge>
 </TableCell>
 <TableCell className="max-w-[280px] truncate text-kx-texto-2" title={paymentSummaryLabel}>
 {paymentSummaryLabel}
 </TableCell>
 <TableCell className="font-medium text-kx-texto">{formatCurrency(order.total)}</TableCell>
 <TableCell>
 <Badge variant="outline" className={statusClassNames[order.status]}>
 {statusLabelMap[order.status]}
 </Badge>
 </TableCell>
 <TableCell>
 <div className="flex items-center justify-end">
 <SalesHistoryOrderSheet
 trigger={
 <Button type="button" variant="ghost" size="icon-sm" aria-label="Ver detalhes do pedido" className="text-kx-texto-2 hover:bg-kx-cartao hover:text-kx-texto">
 <Eye className="h-4 w-4" />
 </Button>
 }
 order={{
 id: order.id,
 numeroPedido: order.numeroPedido,
 status: order.status,
 origem: order.origem,
 total: paraMoeda(deDecimal(order.total)),
 vendedor: order.vendedor,
 formaPagamento: order.formaPagamento,
 pagamentos: orderPayments,
 clienteNome:
 order.cliente?.nomeFantasia?.trim() ||
 order.cliente?.nomeRazaoSocial ||
 "Cliente não informado",
 itens: order.itens.map((item) => ({
 ...item,
 precoUnitario: paraMoeda(deDecimal(item.precoUnitario)),
 })),
 parcelas: order.parcelas.map((installment) => ({
 ...installment,
 valor: paraMoeda(deDecimal(installment.valor)),
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

 <div className="flex items-center justify-between border-t border-kx-painel-borda px-5 py-4">
 <p className="text-sm text-kx-legenda">
 Página {currentPage} de {totalPages}
 </p>

 <div className="flex items-center gap-2">
 {currentPage > 1 ? (
 <Button asChild variant="outline" className="border-kx-painel-borda bg-kx-superficie text-kx-texto hover:bg-kx-painel/80">
 <Link href={buildHistoryHref(currentPage - 1)}>
 <ChevronLeft className="h-4 w-4" />
 Anterior
 </Link>
 </Button>
 ) : (
 <Button variant="outline" disabled className="border-kx-painel-borda bg-kx-superficie text-kx-texto">
 <ChevronLeft className="h-4 w-4" />
 Anterior
 </Button>
 )}

 {currentPage < totalPages ? (
 <Button asChild variant="outline" className="border-kx-painel-borda bg-kx-superficie text-kx-texto hover:bg-kx-painel/80">
 <Link href={buildHistoryHref(currentPage + 1)}>
 Próxima
 <ChevronRight className="h-4 w-4" />
 </Link>
 </Button>
 ) : (
 <Button variant="outline" disabled className="border-kx-painel-borda bg-kx-superficie text-kx-texto">
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
