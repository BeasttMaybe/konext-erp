"use client";

import { AlertCircle, Clock, XCircle } from"lucide-react";
import { cn } from"@/lib/utils";

interface CartaoKPIFinanceiroProps {
  titulo: string;
  valor: number;
  icone:"relogio" |"alerta" |"x";
  cor:"azul" |"laranja" |"vermelho";
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
    style:"currency",
    currency:"BRL",
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
      bg:"bg-kx-superficie",
      texto:"text-kx-link",
      icone:"text-kx-link",
    },
    laranja: {
      bg:"bg-kx-alerta-fundo",
      texto:"text-kx-alerta-icone",
      icone:"text-kx-alerta-icone",
    },
    vermelho: {
      bg:"bg-kx-erro-fundo",
      texto:"text-kx-erro-texto",
      icone:"text-kx-erro-texto",
    },
  };

  const colorScheme = cores[cor];

  return (
    <div
      className={cn("rounded-lg border border-kx-painel-borda p-6 space-y-3",
        colorScheme.bg
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-kx-texto-2">
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
