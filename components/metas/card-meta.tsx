"use client";

import Link from "next/link";
import { Calendar, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgeStatusMeta } from "@/components/metas/badge-status-meta";
import { BadgePrioridadeMeta } from "@/components/metas/badge-prioridade-meta";
import { BarraProgressoMeta } from "@/components/metas/barra-progresso-meta";
import type { LinhaMetaLista } from "@/app/actions/metas";

const labelCategoria: Record<string, string> = {
  FINANCEIRA: "Financeira",
  OPERACIONAL: "Operacional",
  COMERCIAL: "Comercial",
  ESTOQUE: "Estoque",
  ESTRUTURAL: "Estrutural",
  EQUIPAMENTO: "Equipamento",
  REFORMA: "Reforma",
  OUTRA: "Outra",
};

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function diasRestantes(iso: string): { dias: number; atrasada: boolean } {
  const prazo = new Date(iso);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  prazo.setHours(0, 0, 0, 0);
  const diff = Math.round((prazo.getTime() - hoje.getTime()) / 86400000);
  return { dias: Math.abs(diff), atrasada: diff < 0 };
}

function labelValor(meta: LinhaMetaLista): string {
  if (meta.tipoValor === "CHECKLIST") {
    return `${meta.itensConcluidos}/${meta.totalItensChecklist} itens`;
  }
  if (meta.tipoValor === "DINHEIRO") {
    return `${formatarMoeda(meta.valorAtual)} / ${meta.valorAlvo ? formatarMoeda(meta.valorAlvo) : "—"}`;
  }
  const unid = meta.unidade ?? (meta.tipoValor === "PERCENTUAL" ? "%" : "");
  return `${meta.valorAtual}${unid} / ${meta.valorAlvo ?? "—"}${unid}`;
}

function formatarMetaMenorMelhor(meta: LinhaMetaLista): string {
  const unid = meta.unidade ?? (meta.tipoValor === "PERCENTUAL" ? "%" : "");
  const alvo = meta.valorAlvo ?? 0;
  const diferenca = meta.diferencaMeta ?? 0;
  if (meta.estaDentroMeta) {
    return `Dentro da meta. Máximo ${alvo}${unid}. Folga ${Math.abs(diferenca)}${unid}.`;
  }

  return `Acima da meta. Máximo ${alvo}${unid}. Excesso ${Math.abs(diferenca)}${unid}.`;
}

export function CardMeta({ meta }: { meta: LinhaMetaLista }) {
  const prazoInfo = meta.dataPrazo ? diasRestantes(meta.dataPrazo) : null;
  const metaMenorMelhor = meta.direcao === "MENOR_MELHOR" && meta.tipoValor !== "CHECKLIST";

  return (
    <Link href={`/metas/${meta.id}`} className="block group">
      <Card className="p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-md transition-all duration-200 group-hover:border-slate-300 dark:group-hover:border-slate-600">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              {labelCategoria[meta.categoria] ?? meta.categoria}
            </p>
            <h3 className="font-semibold text-slate-900 dark:text-slate-50 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {meta.titulo}
            </h3>
          </div>
          <Target className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <BadgeStatusMeta status={meta.status} />
          <BadgePrioridadeMeta prioridade={meta.prioridade} />
          <Badge variant="outline" className="text-xs">
            {meta.origemProgresso === "AUTOMATICA" ? "Automática" : "Manual"}
          </Badge>
        </div>

        {metaMenorMelhor ? (
          <div className="text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2 text-slate-600 dark:text-slate-300">
            {formatarMetaMenorMelhor(meta)}
          </div>
        ) : (
          <BarraProgressoMeta progresso={meta.progresso} status={meta.status} showLabel={true} />
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{labelValor(meta)}</span>
          {prazoInfo && (
            <span className={`flex items-center gap-1 ${prazoInfo.atrasada ? "text-red-500" : ""}`}>
              <Calendar className="h-3 w-3" />
              {prazoInfo.atrasada
                ? `Atrasada há ${prazoInfo.dias}d`
                : prazoInfo.dias === 0
                  ? "Vence hoje"
                  : `${prazoInfo.dias}d restantes`}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
