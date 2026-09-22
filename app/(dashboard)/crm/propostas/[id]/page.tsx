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
  RASCUNHO: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  ENVIADA: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  APROVADA: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  REJEITADA: "border-rose-500/30 bg-rose-500/10 text-rose-300",
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
    <div className="w-full min-h-full flex flex-col bg-transparent">
      <div className="border-b border-white/10 bg-slate-950/55 px-6 py-6 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button
              asChild
              variant="ghost"
              className="mb-4 pl-0 text-slate-400 hover:bg-transparent hover:text-slate-100"
            >
              <Link href="/crm/propostas">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 lg:text-4xl">
              Detalhes da Proposta #{proposal.id.slice(0, 6).toUpperCase()}
            </h1>
          </div>

          <Badge variant="outline" className={statusClassMap[proposal.status]}>
            {statusLabelMap[proposal.status]}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <h2 className="text-lg font-semibold text-slate-100">Dados do Cliente</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cliente</p>
                  <p className="text-sm text-slate-100">{proposal.cliente}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Aos cuidados de</p>
                  <p className="text-sm text-slate-100">{proposal.aosCuidados?.trim() || "Não informado"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Data de Emissão</p>
                  <p className="text-sm text-slate-100">{formatDate(proposal.dataEmissao)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Validade</p>
                  <p className="text-sm text-slate-100">{formatDate(proposal.validade)}</p>
                </div>
              </div>
            </Card>

            <Card className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <h2 className="text-lg font-semibold text-slate-100">Contexto Técnico</h2>
              <div className="mt-5 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Equipamento</p>
                  <p className="text-sm text-slate-100">{proposal.equipamento?.trim() || "Não informado"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Defeito Relatado</p>
                  <p className="text-sm text-slate-100">{proposal.defeito?.trim() || "Não informado"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Introdução</p>
                  <p className="text-sm text-slate-100">{proposal.introducao?.trim() || "Não informado"}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="rounded-3xl border border-white/10 bg-slate-950/55 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-100">Itens da Proposta</h2>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-white/10 bg-white/[0.03]">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-300">Produto/Serviço</TableHead>
                    <TableHead className="text-slate-300">Qtd</TableHead>
                    <TableHead className="text-slate-300">Preço Un.</TableHead>
                    <TableHead className="text-slate-300">Desc (%)</TableHead>
                    <TableHead className="text-right text-slate-300">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposal.itens.map((item) => (
                    <TableRow key={item.id} className="border-white/10 hover:bg-white/[0.03]">
                      <TableCell className="text-slate-100">{item.descricao}</TableCell>
                      <TableCell className="text-slate-300">{item.quantidade}</TableCell>
                      <TableCell className="text-slate-300">{formatCurrency(item.precoUnitario)}</TableCell>
                      <TableCell className="text-slate-300">{Number(item.descontoPercentual)}%</TableCell>
                      <TableCell className="text-right font-medium text-slate-100">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end border-t border-white/10 px-6 py-5">
              <div className="w-full max-w-sm space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Subtotal Bruto</span>
                  <span className="text-slate-200">{formatCurrency(proposal.subtotalBruto)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Descontos</span>
                  <span className="text-rose-400">- {formatCurrency(proposal.descontoTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="font-semibold text-slate-100">Valor Total</span>
                  <span className="text-lg font-bold text-cyan-300">{formatCurrency(proposal.valorTotal)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-slate-100">Condições</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Condições de Pagamento</p>
                <p className="text-sm text-slate-100">{proposal.condicoesPagamento?.trim() || "Não informado"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Termos de Garantia</p>
                <p className="text-sm text-slate-100">{proposal.termosGarantia?.trim() || "Não informado"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Observações Internas</p>
                <p className="text-sm text-slate-100">{proposal.observacoesInternas?.trim() || "Não informado"}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
