import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProposalActionsCell } from "@/components/crm/proposal-actions-cell";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
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
  RASCUNHO: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  ENVIADA: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  APROVADA: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  REJEITADA: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

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
      <div className="border-b border-white/10 bg-slate-950/55 px-6 py-6 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
              CRM Comercial
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 lg:text-4xl">
              Propostas Comerciais
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400 lg:text-base">
              Gerencie seus orçamentos e negociações.
            </p>
          </div>

          <Button
            asChild
            size="lg"
            className="bg-cyan-400 text-slate-950 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.9)] hover:bg-cyan-300"
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
            <Card className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">Propostas Cadastradas</h2>
                    <p className="mt-1 text-sm text-slate-400">Acompanhe status, valores e andamento das propostas comerciais.</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                    {propostas.length} registros
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="border-white/10 bg-white/[0.03]">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-slate-300">Proposta</TableHead>
                      <TableHead className="text-slate-300">Data</TableHead>
                      <TableHead className="text-slate-300">Cliente</TableHead>
                      <TableHead className="text-slate-300">Equipamento</TableHead>
                      <TableHead className="text-slate-300">Valor</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-right text-slate-300">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propostas.map((proposta) => (
                      <TableRow key={proposta.id} className="border-white/10 hover:bg-white/[0.03]">
                        <TableCell className="font-medium text-slate-100">{formatProposalCode(proposta.id)}</TableCell>
                        <TableCell className="text-slate-300">{formatDate(proposta.dataEmissao)}</TableCell>
                        <TableCell className="text-slate-300">{proposta.cliente}</TableCell>
                        <TableCell className="text-slate-300">{proposta.equipamento?.trim() || "Não informado"}</TableCell>
                        <TableCell className="font-medium text-slate-100">{formatCurrency(proposta.valorTotal)}</TableCell>
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
            <Card className="flex min-h-[50vh] flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-950/55 p-12 text-center shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl">

              <div className="mb-6 flex items-center justify-center rounded-full bg-white/5 p-5 ring-1 ring-white/10">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>

              <h2 className="mb-2 text-xl font-semibold text-slate-100">
                Nenhuma proposta ainda
              </h2>
              <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-500">
                Crie sua primeira proposta comercial e comece a fechar negócios de forma profissional.
              </p>

              <Button
                asChild
                size="lg"
                className="bg-cyan-400 text-slate-950 shadow-[0_12px_32px_-12px_rgba(34,211,238,0.7)] hover:bg-cyan-300"
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
