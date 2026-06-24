import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CartaoKPIProps {
  titulo: string;
  valor: string | number;
  variacao: number;
  cor: "verde" | "azul" | "violeta" | "laranja";
  icone?: React.ReactNode;
  descricao?: string;
}

/**
 * Componente de Card KPI para exibir indicadores chave de desempenho
 */
export function CartaoKPI({
  titulo,
  valor,
  variacao,
  cor,
  icone,
  descricao,
}: CartaoKPIProps) {
  const coresMap = {
    verde: "from-emerald-500/20 to-emerald-500/5 border-emerald-200 dark:border-emerald-900/30",
    azul: "from-blue-500/20 to-blue-500/5 border-blue-200 dark:border-blue-900/30",
    violeta: "from-violet-500/20 to-violet-500/5 border-violet-200 dark:border-violet-900/30",
    laranja:
      "from-orange-500/20 to-orange-500/5 border-orange-200 dark:border-orange-900/30",
  };

  const coreTextoVariacao = {
    verde: "text-emerald-600 dark:text-emerald-400",
    azul: "text-blue-600 dark:text-blue-400",
    violeta: "text-violet-600 dark:text-violet-400",
    laranja: "text-orange-600 dark:text-orange-400",
  };

  return (
    <Card
      className={cn(
        "bg-gradient-to-br p-6 border",
        coresMap[cor]
      )}
    >
      <div className="space-y-4">
        {/* Cabeçalho com Título e Ícone */}
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {titulo}
          </h3>
          {icone && (
            <div className="text-zinc-600 dark:text-zinc-400">{icone}</div>
          )}
        </div>

        {/* Valor Principal */}
        <div className="space-y-1">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {valor}
          </div>
          {descricao && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {descricao}
            </p>
          )}
        </div>

        {/* Variação */}
        <div className="flex items-center gap-1">
          {variacao >= 0 ? (
            <>
              <TrendingUp className={cn("h-4 w-4", coreTextoVariacao[cor])} />
              <span className={cn("text-sm font-medium", coreTextoVariacao[cor])}>
                +{variacao.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <TrendingDown className={cn("h-4 w-4", "text-red-600 dark:text-red-400")} />
              <span className={cn("text-sm font-medium", "text-red-600 dark:text-red-400")}>
                {variacao.toFixed(1)}%
              </span>
            </>
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-500 ml-1">
            vs. mês anterior
          </span>
        </div>
      </div>
    </Card>
  );
}
