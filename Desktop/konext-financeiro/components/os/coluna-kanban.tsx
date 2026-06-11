"use client";

import type { DragEvent } from "react";
import { OrdemServico, StatusOS } from "@/types/os";
import { CartaoOS } from "./cartao-os";
import { mapStatusLabel, mapStatusColor } from "@/dados/mock-os";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColunaKanbanProps {
  status: StatusOS;
  ordensServico: OrdemServico[];
  onCartaoClick?: (os: OrdemServico) => void;
  onMoverOS?: (osId: string, novoStatus: StatusOS) => void;
}

export function ColunaKanban({
  status,
  ordensServico,
  onCartaoClick,
  onMoverOS,
}: ColunaKanbanProps) {
  const ordensFiltradas = ordensServico.filter((os) => os.status === status);
  const statusLabel = mapStatusLabel[status];

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const osId = event.dataTransfer.getData("text/os-id");
    if (!osId) return;
    onMoverOS?.(osId, status);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="flex-1 flex flex-col min-w-[320px] bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-sm transition-shadow">
      {/* Column Header */}
      <div className="px-4 py-4 bg-white dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
        <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm mb-1">
          {statusLabel}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {ordensFiltradas.length} {ordensFiltradas.length === 1 ? "OS" : "OSs"}
        </p>
      </div>

      {/* Scrollable Cards Area */}
      <ScrollArea className="flex-1">
        <div
          className="p-4 space-y-3 min-h-[220px]"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {ordensFiltradas.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-xs text-center px-2">
              <p>Nenhuma ordem de serviço</p>
            </div>
          ) : (
            ordensFiltradas.map((os) => (
              <div
                key={os.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/os-id", os.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
              >
                <CartaoOS
                  os={os}
                  onClick={() => onCartaoClick?.(os)}
                />
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
