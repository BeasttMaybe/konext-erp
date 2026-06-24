"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const statusClass: Record<StatusGarantia, string> = {
  ATIVA: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  PERTO_DO_VENCIMENTO: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  VENCIDA: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  RETORNO_EM_ANDAMENTO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  RETORNO_FINALIZADO: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  SEM_COBERTURA: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  CANCELADA: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
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

  if (linhasOrdenadas.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">Nenhuma garantia encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full min-w-[1600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
              <th className="py-3 px-3">Nº OS</th>
              <th className="py-3 px-3">Cliente</th>
              <th className="py-3 px-3">Telefone</th>
              <th className="py-3 px-3">Equipamento</th>
              <th className="py-3 px-3">Marca/Modelo</th>
              <th className="py-3 px-3">IMEI/Série</th>
              <th className="py-3 px-3">Serviço realizado</th>
              <th className="py-3 px-3">Peças/Serviços</th>
              <th className="py-3 px-3">Valor cobrado</th>
              <th className="py-3 px-3">Finalização</th>
              <th className="py-3 px-3">Prazo</th>
              <th className="py-3 px-3">Data final</th>
              <th className="py-3 px-3">Dias restantes</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Retornos</th>
              <th className="py-3 px-3">Último retorno</th>
              <th className="py-3 px-3">OS de retorno</th>
              <th className="py-3 px-3">Motivo do retorno</th>
              <th className="py-3 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((linha) => (
              <tr key={linha.termoGarantiaId} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-3 px-3 font-semibold">{linha.numeroOS}</td>
                <td className="py-3 px-3">{linha.clienteNome}</td>
                <td className="py-3 px-3">{linha.clienteTelefone ?? "-"}</td>
                <td className="py-3 px-3">{linha.equipamento}</td>
                <td className="py-3 px-3">{linha.marcaModelo ?? "-"}</td>
                <td className="py-3 px-3">{linha.imeiOuSerial ?? "-"}</td>
                <td className="py-3 px-3 max-w-[240px] truncate" title={linha.servicosExecutados.join("; ")}>
                  {linha.servicosExecutados.join(", ") || "-"}
                </td>
                <td className="py-3 px-3 max-w-[220px] truncate" title={linha.pecasOuServicos.join("; ")}>
                  {linha.pecasOuServicos.join(", ") || "-"}
                </td>
                <td className="py-3 px-3">{formatarMoeda(linha.valorCobrado)}</td>
                <td className="py-3 px-3">{formatarData(linha.dataFinalizacao)}</td>
                <td className="py-3 px-3">{linha.prazoGarantiaDias} dias</td>
                <td className="py-3 px-3">{formatarData(linha.dataFimGarantia)}</td>
                <td className="py-3 px-3">{descricaoDias(linha.diasRestantes)}</td>
                <td className="py-3 px-3">
                  <Badge className={statusClass[linha.statusGarantia]}>{statusLabel[linha.statusGarantia]}</Badge>
                </td>
                <td className="py-3 px-3">{linha.quantidadeRetornos}</td>
                <td className="py-3 px-3">{linha.ultimoRetornoEm ? formatarData(linha.ultimoRetornoEm) : "-"}</td>
                <td className="py-3 px-3">
                  {linha.osRetornoId && linha.numeroOSRetorno ? (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/os/${linha.osRetornoId}`}>{linha.numeroOSRetorno}</Link>
                    </Button>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="py-3 px-3 max-w-[220px] truncate" title={linha.ultimoMotivoRetorno ?? ""}>
                  {linha.ultimoMotivoRetorno ?? "-"}
                </td>
                <td className="py-3 px-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/os/${linha.osId}`}>Ver OS</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/os/${linha.osId}/garantia`} target="_blank" rel="noopener noreferrer">Imprimir termo</a>
                    </Button>
                    <Button size="sm" onClick={() => setTermoSelecionado(linha.termoGarantiaId)}>
                      Registrar retorno
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOsHistorico(linha.osId)}>
                      Ver histórico
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
