"use client";

import Link from "next/link";
import { Calendar, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgeStatusMeta } from "@/components/metas/badge-status-meta";
import { BadgePrioridadeMeta } from "@/components/metas/badge-prioridade-meta";
import { BarraProgressoMeta } from "@/components/metas/barra-progresso-meta";
import type { LinhaMetaLista } from "@/app/actions/metas";
import { diferencaEntreDatasDeCalendario, FUSO_HORARIO_PADRAO, hojeComoDataDeCalendario } from "@/lib/datas";

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
  // dataPrazo é DATA DE CALENDÁRIO (meia-noite UTC) — comparar via
  // setHours(0) local do NAVEGADOR deslocaria o dia sempre que o navegador
  // não estiver em UTC. Ver lib/datas.ts.
  const prazo = new Date(iso);
  const hoje = hojeComoDataDeCalendario(FUSO_HORARIO_PADRAO);
  const diff = diferencaEntreDatasDeCalendario(hoje, prazo);
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
      <Card className="p-4 border border-kx-painel-borda bg-kx-painel hover:shadow-md transition-all duration-200 group-hover:border-kx-campo-borda dark:group-hover:border-kx-campo-borda">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-kx-legenda mb-1">
              {labelCategoria[meta.categoria] ?? meta.categoria}
            </p>
            <h3 className="font-semibold text-kx-texto truncate group-hover:text-kx-link transition-colors">
              {meta.titulo}
            </h3>
          </div>
          <Target className="h-4 w-4 text-kx-legenda shrink-0 mt-0.5" />
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <BadgeStatusMeta status={meta.status} />
          <BadgePrioridadeMeta prioridade={meta.prioridade} />
          <Badge variant="outline" className="text-xs">
            {meta.origemProgresso === "AUTOMATICA" ? "Automática" : "Manual"}
          </Badge>
        </div>

        {metaMenorMelhor ? (
          <div className="text-xs rounded-md border border-kx-painel-borda bg-kx-superficie/50 p-2 text-kx-texto-2">
            {formatarMetaMenorMelhor(meta)}
          </div>
        ) : (
          <BarraProgressoMeta progresso={meta.progresso} status={meta.status} showLabel={true} />
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-kx-legenda">
          <span>{labelValor(meta)}</span>
          {prazoInfo && (
            <span className={`flex items-center gap-1 ${prazoInfo.atrasada ? "text-kx-erro-texto" : ""}`}>
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
