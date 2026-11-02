import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProposalActionsCell } from "@/components/crm/proposal-actions-cell";
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

type ProposalListItem = {
 id: string;
 dataEmissao: Date;
 cliente: string;
 equipamento: string | null;
 defeito: string | null;
 valorTotal: number;
 status: ProposalStatus;
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

const formatCurrency = (value: EntradaDecimal) => formatarReais(deDecimal(value));

const formatDate = (value: Date) =>
 new Intl.DateTimeFormat("pt-BR", {
 day: "2-digit",
 month: "2-digit",
 year: "numeric",
 }).format(value);

const formatProposalCode = (id: string) => `#PRO-${id.slice(0, 6).toUpperCase()}`;

export const metadata = {
 title: "Propostas Comerciais | Konext ERP",
 description: "Gerencie seus orçamentos e negociações.",
};

export default async function PropostasPage() {
 const contextoTenant = await exigirContextoTenant();
 const proposalDelegate = contextoTenant.prisma.propostaComercial;

 const propostas = await proposalDelegate.findMany({
 orderBy: {
 criadoEm: "desc",
 },
 select: {
 id: true,
 dataEmissao: true,
 cliente: true,
 equipamento: true,
 defeito: true,
 valorTotal: true,
 status: true,
 },
 });

 const hasPropostas = propostas.length > 0;

 return (
 <div className="w-full flex flex-col bg-transparent">

 {/* ── Page Header ── */}
 <div className="border-b border-kx-painel-borda bg-kx-painel px-6 py-6 lg:px-8">
 <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
 <div>
 <div className="inline-flex items-center rounded-full border border-kx-primaria bg-kx-info-fundo px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-kx-link">
 CRM Comercial
 </div>
 <h1 className="mt-4 text-3xl font-semibold tracking-tight text-kx-texto lg:text-4xl">
 Propostas Comerciais
 </h1>
 <p className="mt-2 text-sm leading-6 text-kx-legenda lg:text-base">
 Gerencie seus orçamentos e negociações.
 </p>
 </div>

 <Button
 asChild
 size="lg"
 className="bg-kx-primaria text-primary-foreground shadow-kx-flutuante hover:bg-kx-primaria"
 >
 <Link href="/crm/propostas/nova">
 <Plus className="h-4 w-4" />
 Nova Proposta
 </Link>
 </Button>
 </div>
 </div>

 {/* ── Content ── */}
 <div className="px-6 py-8 lg:px-8">
 <div className="mx-auto max-w-7xl">
 {hasPropostas ? (
 <Card className="overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel shadow-kx-painel">
 <div className="border-b border-kx-painel-borda px-5 py-4">
 <div className="flex items-center justify-between gap-3">
 <div>
 <h2 className="text-lg font-semibold text-kx-texto">Propostas Cadastradas</h2>
 <p className="mt-1 text-sm text-kx-legenda">Acompanhe status, valores e andamento das propostas comerciais.</p>
 </div>
 <div className="rounded-full border border-kx-painel-borda bg-kx-cartao px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-kx-texto-2">
 {propostas.length} registros
 </div>
 </div>
 </div>

 <div className="overflow-x-auto">
 <Table>
 <TableHeader className="border-kx-painel-borda bg-kx-painel/[0.03]">
 <TableRow className="border-kx-painel-borda hover:bg-transparent">
 <TableHead className="text-kx-texto-2">Proposta</TableHead>
 <TableHead className="text-kx-texto-2">Data</TableHead>
 <TableHead className="text-kx-texto-2">Cliente</TableHead>
 <TableHead className="text-kx-texto-2">Equipamento</TableHead>
 <TableHead className="text-kx-texto-2">Valor</TableHead>
 <TableHead className="text-kx-texto-2">Status</TableHead>
 <TableHead className="text-right text-kx-texto-2">Ações</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {propostas.map((proposta) => (
 <TableRow key={proposta.id} className="border-kx-painel-borda hover:bg-kx-painel/[0.03]">
 <TableCell className="font-medium text-kx-texto">{formatProposalCode(proposta.id)}</TableCell>
 <TableCell className="text-kx-texto-2">{formatDate(proposta.dataEmissao)}</TableCell>
 <TableCell className="text-kx-texto-2">{proposta.cliente}</TableCell>
 <TableCell className="text-kx-texto-2">{proposta.equipamento?.trim() || "Não informado"}</TableCell>
 <TableCell className="font-medium text-kx-texto">{formatCurrency(proposta.valorTotal)}</TableCell>
 <TableCell>
 <Badge variant="outline" className={statusClassMap[proposta.status]}>
 {statusLabelMap[proposta.status]}
 </Badge>
 </TableCell>
 <TableCell>
 <ProposalActionsCell proposalId={proposta.id} />
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </Card>
 ) : (
 <Card className="flex min-h-[50vh] flex-col items-center justify-center rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-12 text-center shadow-kx-painel">

 <div className="mb-6 flex items-center justify-center rounded-full bg-kx-cartao p-5 ring-1 ring-kx-painel-borda">
 <FileText className="h-8 w-8 text-kx-legenda" />
 </div>

 <h2 className="mb-2 text-xl font-semibold text-kx-texto">
 Nenhuma proposta ainda
 </h2>
 <p className="mb-8 max-w-sm text-sm leading-relaxed text-kx-legenda">
 Crie sua primeira proposta comercial e comece a fechar negócios de forma profissional.
 </p>

 <Button
 asChild
 size="lg"
 className="bg-kx-primaria text-primary-foreground shadow-kx-flutuante hover:bg-kx-primaria"
 >
 <Link href="/crm/propostas/nova">
 <Plus className="h-4 w-4" />
 Criar Primeira Proposta
 </Link>
 </Button>

 </Card>
 )}
 </div>
 </div>
 </div>
 );
}
