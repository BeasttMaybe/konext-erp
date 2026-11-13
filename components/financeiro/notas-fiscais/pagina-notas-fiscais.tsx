"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Link2Off, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { sincronizarNotasDoBling } from "@/app/actions/bling-sincronizar";
import type { NotaFiscalLista } from "@/app/actions/notas-fiscais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PilulaStatus } from "@/components/ui/pilula-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { deDecimal, formatarReais, somar } from "@/lib/dinheiro";
import { casaComBusca, prepararTermoDeBusca } from "@/lib/dominio/financeiro/busca-de-conta";
import { rotuloDaSituacaoDoBling } from "@/lib/dominio/bling/nota-de-saida";

/**
 * Notas fiscais de saída.
 *
 * ESTA TELA É SÓ CONSULTA, e isso é uma decisão, não uma falta.
 *
 * A anterior dedicava metade do espaço a um formulário de "nova nota fiscal"
 * — num sistema que não emite nota. O dono emite no Bling, onde está o motor
 * fiscal e a contabilidade; o que aquele formulário permitia era criar um
 * registro que não corresponde a documento nenhum. Ele saiu.
 *
 * O que ficou é o que ele usa de verdade: quanto emitiu no período, achar
 * uma nota pelo cliente, e levar os arquivos para o contador.
 */

type Props = {
  notasIniciais: NotaFiscalLista[];
  periodo: { inicio: string; fim: string };
  /** Quantas notas existem no total, ignorando o período. */
  totalGeral: number;
};

function rotuloDaSituacao(nota: NotaFiscalLista): string {
  // O rótulo do Bling é mais preciso que os três estados da Konext:
  // "Rejeitada" e "Aguardando recibo" caem ambas em PENDENTE, e saber qual é
  // o que diz se há algo a fazer.
  return nota.situacaoBling !== null ? rotuloDaSituacaoDoBling(nota.situacaoBling) : nota.status;
}

function varianteDaSituacao(nota: NotaFiscalLista): "sucesso" | "erro" | "alerta" | "neutro" {
  if (nota.status === "EMITIDA") return "sucesso";
  if (nota.status === "CANCELADA") return "erro";
  return "alerta";
}

export function PaginaNotasFiscais({ notasIniciais, periodo, totalGeral }: Props) {
  const router = useRouter();
  const podeSincronizar = useTemPermissao("financeiro.editar");

  const [busca, setBusca] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [recarregando, iniciarRecarga] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const notas = useMemo(() => {
    const palavras = prepararTermoDeBusca(busca);

    return notasIniciais.filter((nota) =>
      casaComBusca(palavras, [
        nota.numero,
        nota.serie,
        nota.chaveAcesso,
        nota.clienteNome,
        nota.descricaoItens,
      ])
    );
  }, [notasIniciais, busca]);

  const resumo = useMemo(() => {
    // Nota cancelada não entra no total emitido: ela não produziu receita, e
    // somá-la inflaria o número que o dono usa para conferir o mês.
    const valendo = notas.filter((nota) => nota.status !== "CANCELADA");

    return {
      // Em CENTAVOS INTEIROS, somados por `somar`. A action entrega reais
      // como número, e somar reais com `+` é somar ponto flutuante — o erro
      // que `lib/dinheiro` existe para não deixar acontecer. Trinta notas de
      // R$ 0,10 somadas assim não dão R$ 3,00.
      totalCentavos: somar(
        ...valendo.map((nota) => (nota.valorTotal === null ? 0 : deDecimal(nota.valorTotal)))
      ),
      quantidade: notas.length,
      canceladas: notas.filter((nota) => nota.status === "CANCELADA").length,
      semValor: notas.filter((nota) => nota.valorTotal === null).length,
      semVinculo: notas.filter((nota) => nota.doBling && nota.numeroPedido === null).length,
    };
  }, [notas]);

  async function sincronizar() {
    setSincronizando(true);
    setAviso(null);
    try {
      const resultado = await sincronizarNotasDoBling();

      if (resultado.sucesso) {
        toast.success(resultado.mensagem);
        router.refresh();
      } else {
        toast.error(resultado.mensagem);
        // O detalhe cru só aparece quando falha, e é o que permite
        // diagnosticar sem precisar do log do servidor.
        setAviso(resultado.detalhe ?? resultado.mensagem);
      }
    } finally {
      setSincronizando(false);
    }
  }

  const linkDoPacote = `/api/financeiro/notas-fiscais/xml?inicio=${periodo.inicio}&fim=${periodo.fim}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-kx-legenda">Emitidas no Bling</p>
          <h1 className="text-2xl font-bold text-kx-texto">Notas Fiscais</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <a href={linkDoPacote} download>
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Baixar XML do período
            </a>
          </Button>

          {podeSincronizar && (
            <Button onClick={sincronizar} disabled={sincronizando}>
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${sincronizando ? "animate-spin" : ""}`}
                aria-hidden
              />
              {sincronizando ? "Buscando no Bling…" : "Sincronizar"}
            </Button>
          )}
        </div>
      </div>

      {aviso && (
        <p className="whitespace-pre-line rounded-kx-painel border border-kx-erro-borda bg-kx-erro-fundo px-3 py-2 text-xs text-kx-erro-texto">
          {aviso}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4">
          <p className="text-xs text-kx-legenda">Emitido no período</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-kx-texto">
            {formatarReais(resumo.totalCentavos)}
          </p>
          {resumo.semValor > 0 && (
            <p className="mt-0.5 text-xs text-kx-alerta">
              {resumo.semValor} sem valor lido — sincronize de novo
            </p>
          )}
        </div>

        <div className="rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4">
          <p className="text-xs text-kx-legenda">Notas</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-kx-texto">
            {resumo.quantidade}
          </p>
        </div>

        <div className="rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4">
          <p className="text-xs text-kx-legenda">Canceladas</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-kx-texto">
            {resumo.canceladas}
          </p>
          <p className="mt-0.5 text-xs text-kx-legenda">fora do total</p>
        </div>

        <div className="rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4">
          <p className="text-xs text-kx-legenda">Sem venda vinculada</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-kx-texto">
            {resumo.semVinculo}
          </p>
        </div>
      </div>

      {/* Sem esta linha, quem acabou de sincronizar vê as notas do mês numa
          tela que filtra pelo mês e conclui que a importação falhou. Foi
          exatamente o que aconteceu. */}
      {totalGeral > notasIniciais.length && (
        <p className="text-xs text-kx-legenda">
          {totalGeral} notas no TechOS no total — a lista mostra as{" "}
          {notasIniciais.length} do período escolhido. Amplie o período acima para ver as
          outras.
        </p>
      )}

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda"
          aria-hidden
        />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por cliente, número, chave ou item"
          className="h-10 pl-9"
          aria-label="Buscar nota fiscal"
        />
      </div>

      <div className="overflow-x-auto rounded-kx-painel border border-kx-painel-borda bg-kx-painel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nota</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Venda</TableHead>
              <TableHead className="text-right">Arquivos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-kx-legenda">
                  {notasIniciais.length === 0
                    ? "Nenhuma nota no período. Clique em Sincronizar para buscar no Bling."
                    : "Nenhuma nota com esse texto. Limpe a busca para ver todas."}
                </TableCell>
              </TableRow>
            )}

            {notas.map((nota) => (
              <TableRow key={nota.id}>
                <TableCell className="font-semibold tabular-nums text-kx-texto">
                  {nota.serie ? `${nota.serie}/` : ""}
                  {nota.numero}
                </TableCell>

                <TableCell className="max-w-[18rem]">
                  <span className="block truncate text-kx-texto">{nota.clienteNome ?? "—"}</span>
                  {nota.descricaoItens && (
                    <span className="block truncate text-xs text-kx-legenda">
                      {nota.descricaoItens}
                    </span>
                  )}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {/* Travessão, nunca R$ 0,00: o valor não vem na listagem do
                      Bling e chega na sincronização seguinte. Zero somaria
                      errado no total sem ninguém desconfiar. */}
                  {nota.valorTotal === null ? (
                    <span className="text-kx-legenda" title="Valor ainda não lido do Bling">
                      —
                    </span>
                  ) : (
                    formatarReais(deDecimal(nota.valorTotal))
                  )}
                </TableCell>

                <TableCell>
                  <PilulaStatus variante={varianteDaSituacao(nota)} className="w-fit">
                    {rotuloDaSituacao(nota)}
                  </PilulaStatus>
                </TableCell>

                <TableCell className="tabular-nums text-kx-texto-2">
                  {nota.dataEmissao
                    ? new Date(nota.dataEmissao).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                    : "—"}
                </TableCell>

                <TableCell>
                  {nota.numeroPedido !== null ? (
                    <a className="underline" href={`/vendas?pedido=${nota.numeroPedido}`}>
                      Pedido {nota.numeroPedido}
                    </a>
                  ) : nota.motivoSemVinculo ? (
                    <span
                      className="flex items-center gap-1 text-xs text-kx-legenda"
                      title={nota.motivoSemVinculo}
                    >
                      <Link2Off className="h-3.5 w-3.5" aria-hidden />
                      sem vínculo
                    </span>
                  ) : (
                    <span className="text-kx-legenda">—</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-2 text-xs">
                    {nota.linkDanfe && (
                      <a
                        className="inline-flex items-center gap-1 underline"
                        href={nota.linkDanfe}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        DANFE
                      </a>
                    )}
                    {nota.linkXml && (
                      <a
                        className="inline-flex items-center gap-1 underline"
                        href={nota.linkXml}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        XML
                      </a>
                    )}
                    {!nota.linkDanfe && !nota.linkXml && (
                      <span className="text-kx-legenda">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {recarregando && <p className="text-xs text-kx-legenda">Atualizando…</p>}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => iniciarRecarga(() => router.refresh())}
        disabled={recarregando}
      >
        Atualizar lista
      </Button>
    </div>
  );
}
