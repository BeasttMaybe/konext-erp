import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { deDecimal, type EntradaDecimal, formatarReais } from "@/lib/dinheiro";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";

type ProposalStatus = "RASCUNHO" | "ENVIADA" | "APROVADA" | "REJEITADA";

type ProposalItem = {
 id: string;
 descricao: string;
 quantidade: number;
 precoUnitario: number;
 descontoPercentual: number;
 subtotal: number;
};

type ProposalDetails = {
 id: string;
 cliente: string;
 aosCuidados: string | null;
 dataEmissao: Date;
 validade: Date;
 equipamento: string | null;
 defeito: string | null;
 introducao: string | null;
 subtotalBruto: number;
 descontoTotal: number;
 valorTotal: number;
 condicoesPagamento: string | null;
 termosGarantia: string | null;
 observacoesInternas: string | null;
 status: ProposalStatus;
 itens: ProposalItem[];
};

type ProposalDetailsPageProps = {
 params: Promise<{
 id: string;
 }>;
};

const statusLabelMap: Record<ProposalStatus, string> = {
 RASCUNHO: "Rascunho",
 ENVIADA: "Enviada",
 APROVADA: "Aprovada",
 REJEITADA: "Rejeitada",
};

const statusClassMap: Record<ProposalStatus, string> = {
 RASCUNHO: "border-kx-painel-borda bg-kx-superficie text-kx-texto-2",
 ENVIADA: "border-kx-info bg-kx-info-fundo text-kx-info-texto",
 APROVADA: "border-kx-sucesso bg-kx-sucesso-fundo text-kx-sucesso-texto",
 REJEITADA: "border-kx-erro-borda bg-kx-erro-fundo text-kx-erro-texto",
};

// Formatação de dinheiro delega pra lib/dinheiro.ts (Fase 2A-2) — aceita
// tanto `number` (reais) quanto `Prisma.Decimal` direto da query, sem
// nenhum `.toNumber()`/`Number()` solto fora do módulo autorizado.
const formatCurrency = (value: EntradaDecimal) => formatarReais(deDecimal(value));

const formatDate = (value: Date) =>
 new Intl.DateTimeFormat("pt-BR", {
 day: "2-digit",
 month: "2-digit",
 year: "numeric",
 }).format(value);

export default async function ProposalDetailsPage({ params }: ProposalDetailsPageProps) {
 const { id } = await params;
 const contextoTenant = await exigirContextoTenant();
 const proposalDelegate = contextoTenant.prisma.propostaComercial;

 const proposal = await proposalDelegate.findUnique({
 where: {
 id,
 },
 include: {
 itens: true,
 },
 });

 if (!proposal) {
 notFound();
 }

 return (
 <div className= "w-full min-h-full flex flex-col bg-transparent">
 <div className= "border-b border-kx-painel-borda bg-kx-painel px-6 py-6 lg:px-8">
 <div className= "mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
 <div>
 <Button
 asChild
 variant= "ghost"
 className= "mb-4 pl-0 text-kx-legenda hover:bg-transparent hover:text-kx-texto"
 >
 <Link href= "/crm/propostas">
 <ArrowLeft className= "h-4 w-4" />
 Voltar
 </Link>
 </Button>
 <h1 className= "text-3xl font-semibold tracking-tight text-kx-texto lg:text-4xl">
 Detalhes da Proposta #{proposal.id.slice(0, 6).toUpperCase()}
 </h1>
 </div>

 <Badge variant= "outline" className={statusClassMap[proposal.status]}>
 {statusLabelMap[proposal.status]}
 </Badge>
 </div>
 </div>

 <div className= "flex-1 overflow-y-auto px-6 py-8 lg:px-8">
 <div className= "mx-auto max-w-7xl space-y-6">
 <div className= "grid gap-6 lg:grid-cols-2">
 <Card className= "rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6 shadow-kx-painel">
 <h2 className= "text-lg font-semibold text-kx-texto">Dados do Cliente</h2>
 <div className= "mt-5 grid gap-4 sm:grid-cols-2">
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Cliente</p>
 <p className= "text-sm text-kx-texto">{proposal.cliente}</p>
 </div>
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Aos cuidados de</p>
 <p className= "text-sm text-kx-texto">{proposal.aosCuidados?.trim() || "Não informado"}</p>
 </div>
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Data de Emissão</p>
 <p className= "text-sm text-kx-texto">{formatDate(proposal.dataEmissao)}</p>
 </div>
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Validade</p>
 <p className= "text-sm text-kx-texto">{formatDate(proposal.validade)}</p>
 </div>
 </div>
 </Card>

 <Card className= "rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6 shadow-kx-painel">
 <h2 className= "text-lg font-semibold text-kx-texto">Contexto Técnico</h2>
 <div className= "mt-5 space-y-4">
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Equipamento</p>
 <p className= "text-sm text-kx-texto">{proposal.equipamento?.trim() || "Não informado"}</p>
 </div>
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Defeito Relatado</p>
 <p className= "text-sm text-kx-texto">{proposal.defeito?.trim() || "Não informado"}</p>
 </div>
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Introdução</p>
 <p className= "text-sm text-kx-texto">{proposal.introducao?.trim() || "Não informado"}</p>
 </div>
 </div>
 </Card>
 </div>

 <Card className= "rounded-kx-painel border border-kx-painel-borda bg-kx-painel shadow-kx-painel">
 <div className= "border-b border-kx-painel-borda px-6 py-5">
 <h2 className= "text-lg font-semibold text-kx-texto">Itens da Proposta</h2>
 </div>

 <div className= "overflow-x-auto">
 <Table>
 <TableHeader className= "border-kx-painel-borda bg-kx-painel/[0.03]">
 <TableRow className= "border-kx-painel-borda hover:bg-transparent">
 <TableHead className= "text-kx-texto-2">Produto/Serviço</TableHead>
 <TableHead className= "text-kx-texto-2">Qtd</TableHead>
 <TableHead className= "text-kx-texto-2">Preço Un.</TableHead>
 <TableHead className= "text-kx-texto-2">Desc (%)</TableHead>
 <TableHead className= "text-right text-kx-texto-2">Subtotal</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {proposal.itens.map((item) => (
 <TableRow key={item.id} className= "border-kx-painel-borda hover:bg-kx-painel/[0.03]">
 <TableCell className= "text-kx-texto">{item.descricao}</TableCell>
 <TableCell className= "text-kx-texto-2">{item.quantidade}</TableCell>
 <TableCell className= "text-kx-texto-2">{formatCurrency(item.precoUnitario)}</TableCell>
 <TableCell className= "text-kx-texto-2">{Number(item.descontoPercentual)}%</TableCell>
 <TableCell className= "text-right font-medium text-kx-texto">{formatCurrency(item.subtotal)}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>

 <div className= "flex justify-end border-t border-kx-painel-borda px-6 py-5">
 <div className= "w-full max-w-sm space-y-2">
 <div className= "flex items-center justify-between text-sm text-kx-legenda">
 <span>Subtotal Bruto</span>
 <span className= "text-kx-texto">{formatCurrency(proposal.subtotalBruto)}</span>
 </div>
 <div className= "flex items-center justify-between text-sm text-kx-legenda">
 <span>Descontos</span>
 <span className= "text-kx-erro-texto">- {formatCurrency(proposal.descontoTotal)}</span>
 </div>
 <div className= "flex items-center justify-between border-t border-kx-painel-borda pt-2">
 <span className= "font-semibold text-kx-texto">Valor Total</span>
 <span className= "text-lg font-bold text-kx-link">{formatCurrency(proposal.valorTotal)}</span>
 </div>
 </div>
 </div>
 </Card>

 <Card className= "rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6 shadow-kx-painel">
 <h2 className= "text-lg font-semibold text-kx-texto">Condições</h2>
 <div className= "mt-5 grid gap-4 lg:grid-cols-3">
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Condições de Pagamento</p>
 <p className= "text-sm text-kx-texto">{proposal.condicoesPagamento?.trim() || "Não informado"}</p>
 </div>
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Termos de Garantia</p>
 <p className= "text-sm text-kx-texto">{proposal.termosGarantia?.trim() || "Não informado"}</p>
 </div>
 <div className= "space-y-1">
 <p className= "text-xs uppercase tracking-[0.18em] text-kx-legenda">Observações Internas</p>
 <p className= "text-sm text-kx-texto">{proposal.observacoesInternas?.trim() || "Não informado"}</p>
 </div>
 </div>
 </Card>
 </div>
 </div>
 </div>
 );
}
