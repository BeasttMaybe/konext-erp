"use client";

import { OrdemServico, StatusOS } from "@/types/os";
import { ColunaKanban } from "./coluna-kanban";

interface TabuleiroKanbanProps {
  ordensServico: OrdemServico[];
  onCartaoClick?: (os: OrdemServico) => void;
  onMoverOS?: (osId: string, novoStatus: StatusOS) => void;
}

const STATUS_SEQUENCIA = [
  "AGUARDANDO_ORCAMENTO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
  "PRONTO",
  "ENTREGUE",
] as const;

export function TabuleiroKanban({
  ordensServico,
  onCartaoClick,
  onMoverOS,
}: TabuleiroKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_SEQUENCIA.map((status) => (
        <ColunaKanban
          key={status}
          status={status}
          ordensServico={ordensServico}
          onCartaoClick={onCartaoClick}
          onMoverOS={onMoverOS}
        />
      ))}
    </div>
  );
}
