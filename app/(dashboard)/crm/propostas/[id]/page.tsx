import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { MenuProposta } from "@/components/crm/propostas/menu-proposta";
import { SituacaoDaProposta } from "@/components/crm/propostas/situacao-da-proposta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deDecimal, type EntradaDecimal, formatarReais } from "@/lib/dinheiro";
import { FUSO_HORARIO_PADRAO, hojeComoDataDeCalendario } from "@/lib/datas";
import { temPermissao } from "@/lib/auth/permissoes";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import type { StatusProposta } from "@/lib/dominio/propostas/situacao";

type ProposalDetailsPageProps = {
  params: Promise<{ id: string }>;
};

// Formatação de dinheiro delega pra lib/dinheiro.ts (Fase 2A-2) — aceita
// tanto `number` (reais) quanto `Prisma.Decimal` direto da query, sem
// nenhum `.toNumber()`/`Number()` solto fora do módulo autorizado.
const formatarDinheiro = (valor: EntradaDecimal) => formatarReais(deDecimal(valor));

/** Datas de calendário são ancoradas em meia-noite UTC: formatar em UTC. */
const formatarData = (valor: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(valor);

const formatarInstante = (valor: Date, fusoHorario: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fusoHorario,
  }).format(valor);

export default async function ProposalDetailsPage({ params }: ProposalDetailsPageProps) {
  const { id } = await params;
  const contexto = await exigirContextoTenant();
  const podeEditar = temPermissao(contexto, "propostas.editar");

  const proposta = await contexto.prisma.propostaComercial.findUnique({
    where: { id },
    include: { itens: true },
  });

  if (!proposta) {
    notFound();
  }

  // `fusoHorario` é opcional no tipo do contexto (ver types/tenant.ts): quem lê
  // resolve com o padrão, que é o mesmo default do schema.
  const fusoHorario = contexto.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const hojeIso = hojeComoDataDeCalendario(fusoHorario).toISOString();
  const status = proposta.status as StatusProposta;

  return (
    <div className="flex min-h-full w-full flex-col bg-transparent">
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-6 py-6 backdrop-blur-sm lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-3 pl-0 text-kx-legenda hover:bg-transparent hover:text-kx-texto"
          >
            <Link href="/crm/propostas">
              <ArrowLeft className="h-4 w-4" />
              Propostas
            </Link>
          </Button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-bold text-foreground">{proposta.cliente}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {proposta.equipamento?.trim() || "Equipamento não informado"}
                {" · "}
                Orçamento de {formatarDinheiro(proposta.valorTotal)}
                {" · "}
                emitido em {formatarData(proposta.dataEmissao)}
              </p>
            </div>

            <MenuProposta
              propostaId={proposta.id}
              status={status}
              podeEditar={podeEditar}
              proximoContato={proposta.proximoContato?.toISOString() ?? null}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          {/* A situação vem primeiro porque é a única informação da página que
              muda sozinha com o passar dos dias: todo o resto é o que foi
              digitado uma vez. */}
          <SituacaoDaProposta
            status={status}
            validade={proposta.validade.toISOString()}
            proximoContato={proposta.proximoContato?.toISOString() ?? null}
            respondidaEm={proposta.respondidaEm?.toISOString() ?? null}
            motivoResposta={proposta.motivoResposta}
            hojeIso={hojeIso}
            fusoHorario={fusoHorario}
          />

          <Card className="overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel">
            <div className="flex items-center justify-between gap-3 border-b border-kx-painel-borda px-5 py-4">
              <h2 className="text-base font-semibold text-kx-texto">
                {proposta.itens.length === 1 ? "1 item" : `${proposta.itens.length} itens`}
              </h2>
              <Button asChild variant="outline" size="sm">
                {/* Abre em outra aba para não perder a proposta aberta. */}
                <Link href={`/propostas/${proposta.id}/imprimir`} target="_blank" rel="noopener noreferrer">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Link>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-kx-painel-borda hover:bg-transparent">
                    <TableHead className="text-kx-texto-2">Produto / serviço</TableHead>
                    <TableHead className="text-kx-texto-2">Qtd</TableHead>
                    <TableHead className="text-kx-texto-2">Preço un.</TableHead>
                    <TableHead className="text-kx-texto-2">Desc.</TableHead>
                    <TableHead className="text-right text-kx-texto-2">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposta.itens.map((item) => (
                    <TableRow key={item.id} className="border-kx-painel-borda">
                      <TableCell className="text-kx-texto">{item.descricao}</TableCell>
                      <TableCell className="tabular-nums text-kx-texto-2">{item.quantidade}</TableCell>
                      <TableCell className="tabular-nums text-kx-texto-2">
                        {formatarDinheiro(item.precoUnitario)}
                      </TableCell>
                      <TableCell className="tabular-nums text-kx-texto-2">
                        {Number(item.descontoPercentual) === 0
                          ? "—"
                          : `${Number(item.descontoPercentual)}%`}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-kx-texto">
                        {formatarDinheiro(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end border-t border-kx-painel-borda px-5 py-4">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-kx-legenda">Subtotal</span>
                  <span className="tabular-nums text-kx-texto">
                    {formatarDinheiro(proposta.subtotalBruto)}
                  </span>
                </div>
                {deDecimal(proposta.descontoTotal) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-kx-legenda">Desconto</span>
                    <span className="tabular-nums text-kx-erro-texto">
                      − {formatarDinheiro(proposta.descontoTotal)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-kx-painel-borda pt-2">
                  <span className="font-semibold text-kx-texto">Total</span>
                  <span className="text-lg font-bold tabular-nums text-kx-texto">
                    {formatarDinheiro(proposta.valorTotal)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Campos
              titulo="Cliente e equipamento"
              campos={[
                ["Cliente", proposta.cliente],
                ["Aos cuidados de", proposta.aosCuidados],
                ["Equipamento", proposta.equipamento],
                ["Defeito relatado", proposta.defeito],
              ]}
            />

            <Campos
              titulo="Condições"
              campos={[
                ["Validade", formatarData(proposta.validade)],
                ["Pagamento", proposta.condicoesPagamento],
                ["Garantia", proposta.termosGarantia],
                [
                  "Enviada em",
                  proposta.enviadaEm ? formatarInstante(proposta.enviadaEm, fusoHorario) : null,
                ],
              ]}
            />
          </div>

          {(proposta.introducao?.trim() || proposta.observacoesInternas?.trim()) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {proposta.introducao?.trim() && (
                <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
                  <h2 className="text-base font-semibold text-kx-texto">Introdução</h2>
                  <p className="mt-3 whitespace-pre-line text-sm text-kx-texto-2">
                    {proposta.introducao}
                  </p>
                </Card>
              )}

              {proposta.observacoesInternas?.trim() && (
                <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
                  <h2 className="text-base font-semibold text-kx-texto">
                    Observações internas
                  </h2>
                  <p className="mt-1 text-xs text-kx-legenda">Não sai na proposta impressa.</p>
                  <p className="mt-3 whitespace-pre-line text-sm text-kx-texto-2">
                    {proposta.observacoesInternas}
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Campo em branco mostra "—" e não "Não informado".
 *
 * A tela anterior repetia "Não informado" em até sete campos de uma vez, o que
 * enchia a página de texto sobre o que NÃO existe e empurrava pra baixo o que
 * existe.
 */
function Campos({
  titulo,
  campos,
}: {
  titulo: string;
  campos: Array<[string, string | null | undefined]>;
}) {
  return (
    <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
      <h2 className="text-base font-semibold text-kx-texto">{titulo}</h2>
      <dl className="mt-4 space-y-3">
        {campos.map(([rotulo, valor]) => (
          <div key={rotulo} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
            <dt className="text-xs uppercase tracking-wide text-kx-legenda">{rotulo}</dt>
            <dd className="text-sm text-kx-texto">{valor?.trim() ? valor : "—"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
