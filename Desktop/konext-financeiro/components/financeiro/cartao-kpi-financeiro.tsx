"use client";

import { AlertCircle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CartaoKPIFinanceiroProps {
  titulo: string;
  valor: number;
  icone: "relogio" | "alerta" | "x";
  cor: "azul" | "laranja" | "vermelho";
}

/**
 * Componente de Cartão KPI para Seção Financeira
 * Exibe métricas como Total Pendente, Vence Hoje, Atrasado
 */
export function CartaoKPIFinanceiro({
  titulo,
  valor,
  icone,
  cor,
}: CartaoKPIFinanceiroProps) {
  // Formatar valor em moeda brasileira
  const valorFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

  // Mapear ícones
  const icones = {
    relogio: <Clock className="h-8 w-8" />,
    alerta: <AlertCircle className="h-8 w-8" />,
    x: <XCircle className="h-8 w-8" />,
  };

  // Mapear cores
  const cores = {
    azul: {
      bg: "bg-blue-50 dark:bg-blue-950",
      texto: "text-blue-600 dark:text-blue-400",
      icone: "text-blue-500",
    },
    laranja: {
      bg: "bg-amber-50 dark:bg-amber-950",
      texto: "text-amber-600 dark:text-amber-400",
      icone: "text-amber-500",
    },
    vermelho: {
      bg: "bg-red-50 dark:bg-red-950",
      texto: "text-red-600 dark:text-red-400",
      icone: "text-red-500",
    },
  };

  const colorScheme = cores[cor];

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-3",
        colorScheme.bg
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {titulo}
          </p>
          <h3 className={cn("text-2xl font-bold mt-2", colorScheme.texto)}>
            {valorFormatado}
          </h3>
        </div>
        <div className={colorScheme.icone}>{icones[icone]}</div>
      </div>
    </div>
  );
}
