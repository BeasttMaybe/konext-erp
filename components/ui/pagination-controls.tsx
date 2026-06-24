"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  /** Página atual (base-1). */
  currentPage: number;
  /** Total de páginas disponíveis. */
  totalPages: number;
  /** Callback chamado ao clicar em uma página específica. */
  onPageChange: (page: number) => void;
  /** Desabilita os botões (ex.: durante carregamento). */
  disabled?: boolean;
}

/**
 * Controles de paginação reutilizáveis.
 * Exibe "Anterior", "Página X de Y" e "Próximo".
 */
export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationControlsProps) {
  // Sem dados suficientes para paginar, não renderiza nada
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Anterior
      </Button>

      <span className="text-sm text-muted-foreground tabular-nums">
        Página <span className="font-semibold text-foreground">{currentPage}</span> de{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage >= totalPages}
      >
        Próximo
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
