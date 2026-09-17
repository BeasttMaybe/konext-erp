"use client";

import { OrdemServico, StatusOS } from "@/types/os";
import { mapStatusColor, mapStatusLabel } from "@/dados/mock-os";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Smartphone,
  DollarSign,
  Clock,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CartaoOSProps {
  os: OrdemServico;
  onClick?: () => void;
  isDragging?: boolean;
  statusChipClass?: string;
  /** Status da coluna onde o card está. O chip some quando apenas repetiria a coluna. */
  statusDaColuna?: StatusOS;
  onMoverAnterior?: () => void;
  onMoverProxima?: () => void;
  onFinalizar?: () => void;
  podeFinalizar?: boolean;
  textoBotaoFinalizar?: string;
  desabilitarMoverAnterior?: boolean;
  desabilitarMoverProxima?: boolean;
  /** Abre o dialogo de entrega (finalizacao). Ausente em OS ja entregue. */
  onEntregar?: () => void;
  /** Abre o dialogo de reabertura. Presente so em OS entregue e para ADMIN/GESTOR. */
  onReabrir?: () => void;
}

export function CartaoOS({
  os,
  onClick,
  isDragging = false,
  statusChipClass,
  statusDaColuna,
  onMoverAnterior,
  onMoverProxima,
  onFinalizar,
  podeFinalizar = false,
  textoBotaoFinalizar = "Finalizar OS",
  desabilitarMoverAnterior = false,
  desabilitarMoverProxima = false,
  onEntregar,
  onReabrir,
}: CartaoOSProps) {
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const formatarData = (dataISO: string) => {
    return new Date(dataISO).toLocaleDateString("pt-BR", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card
      className={`group p-4 cursor-pointer transition-all duration-200 border border-border bg-background/90 ${
        isDragging
          ? "rotate-1 scale-[1.01] shadow-2xl ring-2 ring-primary/30"
          : "hover:shadow-md hover:-translate-y-0.5"
      }`}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header: Order Number & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {os.numeroOS}
            </h3>
          </div>
          {/* Repetir o status da própria coluna não informa nada. Num retorno de
              garantia dentro de outra coluna, informa. */}
          {statusDaColuna !== os.status ? (
            <Badge className={`${statusChipClass ?? mapStatusColor[os.status]} whitespace-nowrap text-xs font-medium`}>
              {mapStatusLabel[os.status]}
            </Badge>
          ) : null}
        </div>

        {/* Client */}
        <div className="text-sm border-t border-border/60 pt-2">
          <p className="text-xs text-muted-foreground font-medium mb-1">Cliente</p>
          <p className="font-medium text-foreground truncate">
            {os.nomeCliente}
          </p>
          {os.ehRetornoGarantia && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                Garantia
              </Badge>
              {os.retornoGarantiaFinalizadoEm && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Retorno finalizado
                </Badge>
              )}
              {os.numeroOSOrigemGarantia && (
                <span className="text-xs text-muted-foreground">Origem: {os.numeroOSOrigemGarantia}</span>
              )}
            </div>
          )}
        </div>

        {/* Equipment */}
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Equipamento</p>
            <p className="font-medium text-foreground truncate">
              {os.equipamento}
            </p>
            {os.marca && (
              <p className="text-xs text-muted-foreground truncate">{os.marca}</p>
            )}
            {os.ehRetornoGarantia && os.observacoesInternas && (
              <p className="text-xs text-muted-foreground truncate" title={os.observacoesInternas}>
                {os.observacoesInternas}
              </p>
            )}
          </div>
        </div>

        {/* Budget Value - If Available */}
        {os.totalOrcamento > 0 && (
          <div className="flex items-center justify-between p-2 rounded border border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Orçamento</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatarMoeda(os.totalOrcamento)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer: Creation Date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/60">
          <Clock className="w-3 h-3" />
          <span>{formatarData(os.dataAtualizacao)}</span>
        </div>

        {/* Ações rápidas de movimentação */}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(event) => {
              event.stopPropagation();
              onMoverAnterior?.();
            }}
            disabled={desabilitarMoverAnterior}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(event) => {
              event.stopPropagation();
              if (podeFinalizar) {
                onFinalizar?.();
                return;
              }

              onMoverProxima?.();
            }}
            disabled={podeFinalizar ? !onFinalizar : desabilitarMoverProxima}
            hidden={!podeFinalizar && desabilitarMoverProxima}
          >
            {podeFinalizar ? textoBotaoFinalizar : "Proxima"}
            {!podeFinalizar && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>

        {onEntregar ? (
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onEntregar();
            }}
          >
            <PackageCheck className="mr-2 h-4 w-4" />
            Entregar e finalizar
          </Button>
        ) : null}

        {onReabrir ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              onReabrir();
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reabrir OS
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
