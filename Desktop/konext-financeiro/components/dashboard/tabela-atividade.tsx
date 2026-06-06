import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TransacaoRecente } from "@/types/indice";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Wrench,
  ShoppingCart,
} from "lucide-react";

interface TabelaAtividadeProps {
  transacoes: TransacaoRecente[];
}

/**
 * Mapa de cores e ícones para tipos de transação
 */
const tiposTransacao = {
  entrada: { icone: ArrowUpRight, cor: "text-emerald-600", fundo: "bg-emerald-100 dark:bg-emerald-900/30" },
  saida: { icone: ArrowDownLeft, cor: "text-red-600", fundo: "bg-red-100 dark:bg-red-900/30" },
  os: { icone: Wrench, cor: "text-blue-600", fundo: "bg-blue-100 dark:bg-blue-900/30" },
  pdv: { icone: ShoppingCart, cor: "text-violet-600", fundo: "bg-violet-100 dark:bg-violet-900/30" },
};

/**
 * Mapa de status
 */
const statusBadge = {
  completo: { label: "Completo", variante: "default" as const },
  pendente: { label: "Pendente", variante: "outline" as const },
  cancelado: { label: "Cancelado", variante: "destructive" as const },
};

/**
 * Componente de Tabela de Atividades Recentes
 */
export function TabelaAtividade({ transacoes }: TabelaAtividadeProps) {
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
            const status = statusBadge[transacao.status];

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
                      {transacao.tipo === "saida" ? "-" : "+"}
                      {transacao.valor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
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
