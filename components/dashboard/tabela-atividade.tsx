import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Wrench,
} from "lucide-react";

export interface AtividadeDashboard {
  id: string;
  tipo: "VENDA" | "DESPESA" | "OS";
  descricao: string;
  valor: number;
  data: Date;
  status: string;
  cliente?: string;
}

interface TabelaAtividadeProps {
  transacoes: AtividadeDashboard[];
}

/**
 * Mapa de cores e ícones para tipos de transação
 */
const tiposTransacao = {
  VENDA: { icone: ArrowUpRight, cor: "text-emerald-600", fundo: "bg-emerald-100 dark:bg-emerald-900/30" },
  DESPESA: { icone: ArrowDownLeft, cor: "text-red-600", fundo: "bg-red-100 dark:bg-red-900/30" },
  OS: { icone: Wrench, cor: "text-blue-600", fundo: "bg-blue-100 dark:bg-blue-900/30" },
};

/**
 * Mapa de status
 */
const statusBadge = (status: string) => {
  const normalizado = status.toUpperCase();

  if (["RECEBIDO", "PAGO", "ENTREGUE", "CONCLUIDA", "CONCLUÍDA", "PRONTO"].includes(normalizado)) {
    return { label: "Concluído", variante: "default" as const };
  }

  if (["CANCELADO", "CANCELADA"].includes(normalizado)) {
    return { label: "Cancelado", variante: "destructive" as const };
  }

  return { label: "Pendente", variante: "outline" as const };
};

/**
 * Componente de Tabela de Atividades Recentes
 */
export function TabelaAtividade({ transacoes }: TabelaAtividadeProps) {
  const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Atividades Recentes
        </h2>

        <div className="space-y-2">
          {transacoes.slice(0, 5).map((transacao) => {
            const tipo = tiposTransacao[transacao.tipo];
            const Icone = tipo.icone;
            const status = statusBadge(transacao.status);
            const sinal = transacao.tipo === "DESPESA" ? "-" : "+";

            return (
              <div
                key={transacao.id}
                className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {/* Ícone e Descrição */}
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${tipo.fundo}`}>
                    <Icone className={`h-4 w-4 ${tipo.cor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {transacao.descricao}
                    </p>
                    {transacao.cliente && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {transacao.cliente}
                      </p>
                    )}
                  </div>
                </div>

                {/* Valor, Data e Status */}
                <div className="flex items-center gap-4 text-right">
                  <div className="hidden md:block">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {sinal}
                      {formatadorMoeda.format(transacao.valor)}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {transacao.data.toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={status.variante} className="ml-2">
                    {status.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
