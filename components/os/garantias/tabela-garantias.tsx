"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PilulaStatus, type PropsPilulaStatus } from "@/components/ui/pilula-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TabelaVazia } from "@/components/ui/table";
import type { LinhaGarantiaOS, StatusGarantia } from "@/app/actions/garantias";
import { ModalRegistrarRetorno } from "@/components/os/garantias/modal-registrar-retorno";
import { HistoricoConsertosCliente } from "@/components/os/garantias/historico-consertos-cliente";

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
  if (diasRestantes > 0) return `Vence em ${diasRestantes} dia(s)`;
  return `Vencida há ${Math.abs(diasRestantes)} dia(s)`;
}

export function TabelaGarantias({ linhas, onAtualizar }: TabelaGarantiasProps) {
  const [termoSelecionado, setTermoSelecionado] = useState<string | null>(null);
  const [osHistorico, setOsHistorico] = useState<string | null>(null);

  const linhasOrdenadas = useMemo(() => {
    return [...linhas].sort((a, b) => new Date(a.dataFimGarantia).getTime() - new Date(b.dataFimGarantia).getTime());
  }, [linhas]);

  const COLUNAS = 19;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-cartao">
        <Table className="min-w-[1600px]">
          <TableHeader className="sticky top-0 z-kx-sticky bg-kx-cartao">
            <TableRow className="hover:bg-transparent">
              <TableHead>Nº OS</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Marca/Modelo</TableHead>
              <TableHead>IMEI/Série</TableHead>
              <TableHead>Serviço realizado</TableHead>
              <TableHead>Peças/Serviços</TableHead>
              <TableHead className="text-right">Valor cobrado</TableHead>
              <TableHead>Finalização</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Data final</TableHead>
              <TableHead>Dias restantes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Retornos</TableHead>
              <TableHead>Último retorno</TableHead>
              <TableHead>OS de retorno</TableHead>
              <TableHead>Motivo do retorno</TableHead>
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
                  <TableCell className="font-semibold">{linha.numeroOS}</TableCell>
                  <TableCell>{linha.clienteNome}</TableCell>
                  <TableCell>{linha.clienteTelefone ?? "-"}</TableCell>
                  <TableCell>{linha.equipamento}</TableCell>
                  <TableCell>{linha.marcaModelo ?? "-"}</TableCell>
                  <TableCell>{linha.imeiOuSerial ?? "-"}</TableCell>
                  <TableCell className="max-w-[240px] truncate" title={linha.servicosExecutados.join("; ")}>
                    {linha.servicosExecutados.join(", ") || "-"}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate" title={linha.pecasOuServicos.join("; ")}>
                    {linha.pecasOuServicos.join(", ") || "-"}
                  </TableCell>
                  <TableCell numerico>{formatarMoeda(linha.valorCobrado)}</TableCell>
                  <TableCell>{formatarData(linha.dataFinalizacao)}</TableCell>
                  <TableCell>{linha.prazoGarantiaDias} dias</TableCell>
                  <TableCell>{formatarData(linha.dataFimGarantia)}</TableCell>
                  <TableCell>{descricaoDias(linha.diasRestantes)}</TableCell>
                  <TableCell>
                    <PilulaStatus variante={statusVariante[linha.statusGarantia]}>
                      {statusLabel[linha.statusGarantia]}
                    </PilulaStatus>
                  </TableCell>
                  <TableCell numerico>{linha.quantidadeRetornos}</TableCell>
                  <TableCell>{linha.ultimoRetornoEm ? formatarData(linha.ultimoRetornoEm) : "-"}</TableCell>
                  <TableCell>
                    {linha.osRetornoId && linha.numeroOSRetorno ? (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/os/${linha.osRetornoId}`}>{linha.numeroOSRetorno}</Link>
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate" title={linha.ultimoMotivoRetorno ?? ""}>
                    {linha.ultimoMotivoRetorno ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/os/${linha.osId}`}>Ver OS</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/os/${linha.osId}/garantia`} target="_blank" rel="noopener noreferrer">
                          Imprimir termo
                        </a>
                      </Button>
                      <Button size="sm" onClick={() => setTermoSelecionado(linha.termoGarantiaId)}>
                        Registrar retorno
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOsHistorico(linha.osId)}>
                        Ver histórico
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
