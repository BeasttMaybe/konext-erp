"use client";

import type { DragEvent } from "react";
import { OrdemServico } from "@/types/os";
import { mapStatusColor, mapStatusLabel } from "@/dados/mock-os";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Smartphone, DollarSign, Clock } from "lucide-react";

interface CartaoOSProps {
  os: OrdemServico;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
}

export function CartaoOS({
  os,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
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
      className="p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-all border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 group"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-3">
        {/* Header: Order Number & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {os.numeroOS}
          </h3>
          <Badge 
            className={`${mapStatusColor[os.status]} whitespace-nowrap text-xs font-medium`}
          >
            {mapStatusLabel[os.status]}
          </Badge>
        </div>

        {/* Client */}
        <div className="text-sm border-t border-slate-100 dark:border-slate-700 pt-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Cliente</p>
          <p className="font-medium text-slate-900 dark:text-slate-50 truncate">
            {os.nomeCliente}
          </p>
        </div>

        {/* Equipment */}
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Equipamento</p>
            <p className="font-medium text-slate-900 dark:text-slate-50 truncate">
              {os.equipamento}
            </p>
            {os.marca && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{os.marca}</p>
            )}
          </div>
        </div>

        {/* Budget Value - If Available */}
        {os.totalOrcamento > 0 && (
          <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded border border-emerald-100 dark:border-emerald-800">
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
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700">
          <Clock className="w-3 h-3" />
          <span>{formatarData(os.dataAtualizacao)}</span>
        </div>
      </div>
    </Card>
  );
}
