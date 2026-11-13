import Link from "next/link";
import { Plus } from "lucide-react";

import { CabecalhoCard } from "./cabecalho-card";
import { ESTILO_DO_EVENTO, formatarMoeda, rotuloDoDia } from "@/components/agenda/estilo-do-evento";
import { Button } from "@/components/ui/button";
import { Painel } from "@/components/ui/painel";
import type { EventoDaAgenda } from "@/lib/dominio/agenda/agenda";
import { cn } from "@/lib/utils";

type Props = { hoje: string; eventos: EventoDaAgenda[] };

function quando(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  const amanha = new Date(`${hoje}T00:00:00Z`);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  if (dia === amanha.toISOString().slice(0, 10)) return "Amanhã";
  return rotuloDoDia(dia).replace(/ de [a-zç]+$/, "");
}

/** Mini agenda do Dashboard: o que vem nos proximos 7 dias. */
export function AgendaHome({ hoje, eventos }: Props) {
  return (
    <Painel>
      <CabecalhoCard
        titulo="Próximos 7 dias"
        acao={
          <Link href="/agenda" className="hover:text-kx-texto">
            Abrir agenda ↗
          </Link>
        }
      />
      <div className="flex flex-col gap-1.5 px-kx-4 pb-kx-4 pt-kx-3">
        {eventos.length === 0 ? (
          <div className="flex items-center justify-between gap-3 py-2">
            <p className="text-sm text-kx-legenda">Nada marcado para os próximos dias.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/agenda?novo=1">
                <Plus className="h-3.5 w-3.5" />
                Agendar
              </Link>
            </Button>
          </div>
        ) : (
          eventos.map((evento) => {
            const estilo = ESTILO_DO_EVENTO[evento.tipo];
            const hora = evento.tipo === "COMPROMISSO" && evento.detalhe ? evento.detalhe.split(" · ")[0] : null;
            return (
              <Link
                key={evento.id}
                href={evento.tipo === "COMPROMISSO" ? `/agenda?mes=${evento.dia.slice(0, 7)}&dia=${evento.dia}` : (evento.href ?? "/agenda")}
                className="flex items-center gap-2.5 rounded-kx-botao px-2 py-1.5 hover:bg-kx-superficie"
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", estilo.ponto)} aria-hidden />
                <span className="w-[72px] shrink-0 text-xs font-semibold text-kx-texto-2 first-letter:uppercase">{quando(evento.dia, hoje)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-kx-texto">
                  {evento.titulo}
                  {hora && hora !== "Dia inteiro" ? <span className="text-kx-legenda"> · {hora}</span> : null}
                </span>
                {evento.valor !== null ? (
                  <span className={cn("shrink-0 text-xs font-semibold tabular-nums", evento.tipo === "PAGAR" ? "text-kx-erro-texto" : "text-kx-sucesso-texto")}>
                    {formatarMoeda(evento.valor)}
                  </span>
                ) : null}
              </Link>
            );
          })
        )}
      </div>
    </Painel>
  );
}
