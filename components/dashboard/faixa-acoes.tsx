"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { AcaoDashboard } from "@/app/actions/dashboard";
import { cn } from "@/lib/utils";
import { formatarMoeda } from "@/components/ui/pagina";

type FaixaAcoesProps = {
  acoes: readonly AcaoDashboard[];
};

export function FaixaAcoes({ acoes }: FaixaAcoesProps) {
  const [expandida, setExpandida] = useState(false);

  if (acoes.length === 0) {
    return null;
  }

  const resumo =
    acoes.length === 1 ? "1 pendência" : `${acoes.length} pendências`;

  return (
    <section
      className="rounded-lg border border-border bg-card"
      aria-label="Pendências"
    >
      <div className="flex h-11 items-center gap-2 px-3 text-sm">
        <AlertTriangle
          aria-hidden="true"
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--status-critico)" }}
        />
        <span className="shrink-0 font-medium text-foreground">{resumo}</span>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {acoes.map((acao) => (
            <span key={acao.chave} className="flex shrink-0 items-center gap-2 text-muted-foreground">
              <span aria-hidden="true">·</span>
              <Link href={acao.href} className="truncate hover:text-foreground hover:underline">
                {acao.texto}
                {acao.valor === null ? "" : ` ${formatarMoeda(acao.valor)}`}
              </Link>
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setExpandida((atual) => !atual)}
          aria-expanded={expandida}
          aria-label={expandida ? "Recolher pendências" : "Expandir pendências"}
          className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 transition-transform", expandida && "rotate-180")}
          />
        </button>
      </div>

      {expandida ? (
        <ul className="divide-y divide-border border-t border-border">
          {acoes.map((acao) => {
            const critico = acao.severidade === "CRITICO";

            return (
              <li key={acao.chave}>
                <Link
                  href={acao.href}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: critico ? "var(--status-critico)" : "var(--status-atencao)" }}
                    />
                    <span className="text-foreground">
                      {critico ? "Crítico" : "Atenção"} — {acao.texto}
                    </span>
                  </span>
                  {acao.valor === null ? null : (
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatarMoeda(acao.valor)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
