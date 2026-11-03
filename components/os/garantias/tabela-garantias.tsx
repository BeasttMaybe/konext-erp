"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MoreHorizontal, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PilulaStatus, type PropsPilulaStatus } from "@/components/ui/pilula-status";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TabelaVazia,
} from "@/components/ui/table";
import type { LinhaGarantiaOS, StatusGarantia } from "@/app/actions/garantias";
import { ModalRegistrarRetorno } from "@/components/os/garantias/modal-registrar-retorno";
import { HistoricoConsertosCliente } from "@/components/os/garantias/historico-consertos-cliente";

/**
 * Tabela das garantias.
 *
 * Tinha DEZENOVE colunas e `min-w-[1600px]`. Numa tela de notebook isso quer
 * dizer que tudo exige rolagem lateral — inclusive a coluna de ações, que
 * ficava na ponta direita: para registrar um retorno era preciso rolar a
 * tabela inteira para o lado. Era a parte mais pesada do "fica muito difícil
 * localizar dados".
 *
 * Ficaram sete colunas, as que se percorre com o olho procurando uma garantia:
 * número da OS, cliente, aparelho, quando acaba, situação, retornos e ações. As
 * outras doze não sumiram — foram para o painel de detalhe, que abre na linha.
 * A diferença é que agora é preciso PEDIR por elas, em vez de atravessá-las
 * para chegar ao que se procura.
 */

type TabelaGarantiasProps = {
  linhas: LinhaGarantiaOS[];
  onAtualizar: () => void;
};

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatarData(dataIso: string): string {
  return new Date(dataIso).toLocaleDateString("pt-BR");
}

const statusLabel: Record<StatusGarantia, string> = {
  ATIVA: "Ativa",
  PERTO_DO_VENCIMENTO: "Perto do vencimento",
  VENCIDA: "Vencida",
  RETORNO_EM_ANDAMENTO: "Retorno em andamento",
  RETORNO_FINALIZADO: "Retorno finalizado",
  SEM_COBERTURA: "Sem cobertura",
  CANCELADA: "Cancelada",
};

const statusVariante: Record<StatusGarantia, NonNullable<PropsPilulaStatus["variante"]>> = {
  ATIVA: "sucesso",
  PERTO_DO_VENCIMENTO: "alerta",
  VENCIDA: "erro",
  RETORNO_EM_ANDAMENTO: "conserto",
  RETORNO_FINALIZADO: "entregue",
  SEM_COBERTURA: "erro",
  CANCELADA: "neutro",
};

function descricaoDias(diasRestantes: number): string {
  if (diasRestantes === 0) return "Vence hoje";
  if (diasRestantes === 1) return "Vence amanhã";
  if (diasRestantes > 0) return `Faltam ${diasRestantes} dias`;
  if (diasRestantes === -1) return "Venceu ontem";
  return `Venceu há ${Math.abs(diasRestantes)} dias`;
}

const COLUNAS = 7;

export function TabelaGarantias({ linhas, onAtualizar }: TabelaGarantiasProps) {
  const [termoSelecionado, setTermoSelecionado] = useState<string | null>(null);
  const [osHistorico, setOsHistorico] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<LinhaGarantiaOS | null>(null);

  const linhasOrdenadas = useMemo(
    () =>
      [...linhas].sort(
        (a, b) => new Date(a.dataFimGarantia).getTime() - new Date(b.dataFimGarantia).getTime()
      ),
    [linhas]
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-cartao">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="sticky top-0 z-kx-sticky bg-kx-cartao">
              <TableRow className="hover:bg-transparent">
                <TableHead>Nº OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Aparelho</TableHead>
                <TableHead>Garantia até</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Retornos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody zebra>
              {linhasOrdenadas.length === 0 ? (
                <TabelaVazia
                  colSpan={COLUNAS}
                  titulo="Nenhuma garantia encontrada"
                  icone={<ShieldOff className="h-8 w-8" aria-hidden="true" />}
                />
              ) : (
                linhasOrdenadas.map((linha) => (
                  <TableRow key={linha.termoGarantiaId}>
                    <TableCell className="font-semibold">
                      <Link href={`/os/${linha.osId}`} className="hover:underline">
                        {linha.numeroOS}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-kx-texto">{linha.clienteNome}</p>
                        {linha.clienteTelefone && (
                          <p className="truncate text-xs tabular-nums text-kx-legenda">
                            {linha.clienteTelefone}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-0 max-w-[220px]">
                        <p className="truncate text-kx-texto">{linha.equipamento}</p>
                        {linha.marcaModelo && (
                          <p className="truncate text-xs text-kx-legenda">{linha.marcaModelo}</p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="tabular-nums text-kx-texto">
                          {formatarData(linha.dataFimGarantia)}
                        </p>
                        <p
                          className={`text-xs ${
                            linha.diasRestantes < 0
                              ? "font-semibold text-kx-erro-texto"
                              : linha.diasRestantes <= 7
                                ? "font-semibold text-kx-alerta-texto"
                                : "text-kx-legenda"
                          }`}
                        >
                          {descricaoDias(linha.diasRestantes)}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <PilulaStatus variante={statusVariante[linha.statusGarantia]}>
                        {statusLabel[linha.statusGarantia]}
                      </PilulaStatus>
                    </TableCell>

                    <TableCell numerico>{linha.quantidadeRetornos}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* As duas ações do dia a dia ficam à vista; o resto
                            entra no menu. Antes eram quatro botões lado a lado
                            na ponta de uma tabela de 1600px, fora da tela. */}
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={`/os/${linha.osId}/garantia`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Imprimir termo
                          </a>
                        </Button>

                        <Button size="sm" onClick={() => setTermoSelecionado(linha.termoGarantiaId)}>
                          Registrar retorno
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => setDetalhe(linha)}>
                              Ver todos os dados
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/os/${linha.osId}`}>Abrir a OS</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setOsHistorico(linha.osId)}>
                              Histórico do cliente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Sheet open={detalhe !== null} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {detalhe ? `${detalhe.numeroOS} · ${detalhe.clienteNome}` : "Garantia"}
            </SheetTitle>
          </SheetHeader>

          {detalhe && (
            <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
              <Bloco titulo="Aparelho">
                <Campo rotulo="Equipamento" valor={detalhe.equipamento} />
                <Campo rotulo="Marca / modelo" valor={detalhe.marcaModelo} />
                <Campo rotulo="IMEI / série" valor={detalhe.imeiOuSerial} />
              </Bloco>

              <Bloco titulo="Cliente">
                <Campo rotulo="Nome" valor={detalhe.clienteNome} />
                <Campo rotulo="Telefone" valor={detalhe.clienteTelefone} />
                <Campo rotulo="Documento" valor={detalhe.clienteDocumento} />
              </Bloco>

              <Bloco titulo="Serviço">
                <Campo
                  rotulo="Serviço realizado"
                  valor={detalhe.servicosExecutados.join(", ") || null}
                />
                <Campo
                  rotulo="Peças / serviços"
                  valor={detalhe.pecasOuServicos.join(", ") || null}
                />
                <Campo rotulo="Valor cobrado" valor={formatarMoeda(detalhe.valorCobrado)} />
              </Bloco>

              <Bloco titulo="Garantia">
                <Campo rotulo="Finalizada em" valor={formatarData(detalhe.dataFinalizacao)} />
                <Campo rotulo="Prazo" valor={`${detalhe.prazoGarantiaDias} dias`} />
                <Campo rotulo="Vale até" valor={formatarData(detalhe.dataFimGarantia)} />
                <Campo rotulo="Situação" valor={statusLabel[detalhe.statusGarantia]} />
              </Bloco>

              {detalhe.quantidadeRetornos > 0 && (
                <Bloco titulo="Retornos">
                  <Campo rotulo="Quantidade" valor={String(detalhe.quantidadeRetornos)} />
                  <Campo
                    rotulo="Último retorno"
                    valor={detalhe.ultimoRetornoEm ? formatarData(detalhe.ultimoRetornoEm) : null}
                  />
                  <Campo rotulo="Motivo" valor={detalhe.ultimoMotivoRetorno} />
                  {detalhe.osRetornoId && detalhe.numeroOSRetorno && (
                    <div className="pt-1">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/os/${detalhe.osRetornoId}`}>
                          Abrir {detalhe.numeroOSRetorno}
                        </Link>
                      </Button>
                    </div>
                  )}
                </Bloco>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {osHistorico && <HistoricoConsertosCliente osId={osHistorico} />}

      <ModalRegistrarRetorno
        aberto={Boolean(termoSelecionado)}
        termoGarantiaId={termoSelecionado}
        aoFechar={() => setTermoSelecionado(null)}
        aoConcluir={() => {
          setTermoSelecionado(null);
          onAtualizar();
        }}
      />
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-kx-legenda">
        {titulo}
      </h3>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

/** Campo vazio mostra "—", e não "Não informado" repetido em doze linhas. */
function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_1fr] gap-3">
      <dt className="text-xs text-kx-legenda">{rotulo}</dt>
      <dd className="text-sm text-kx-texto">{valor?.trim() ? valor : "—"}</dd>
    </div>
  );
}
