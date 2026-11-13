"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  marcarCompromissoConcluido,
  removerCompromisso,
  type AgendaDoPeriodo,
  type CompromissoDetalhe,
} from "@/app/actions/agenda";
import { Button } from "@/components/ui/button";
import { agruparPorDia, type EventoDaAgenda } from "@/lib/dominio/agenda/agenda";
import { cn } from "@/lib/utils";

import { DialogoCompromisso } from "./dialogo-compromisso";
import { ESTILO_DO_EVENTO, formatarMoeda, rotuloDoDia, rotuloDoMes } from "./estilo-do-evento";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAXIMO_NO_QUADRADO = 3;

type Props = {
  agenda: AgendaDoPeriodo;
  mes: string;
  diaSelecionado: string;
  abrirNovo: boolean;
};

function mesVizinho(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function diasDaGrade(de: string, ate: string): string[] {
  const dias: string[] = [];
  const cursor = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  while (cursor <= fim && dias.length < 42) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

export function PaginaAgenda({ agenda, mes, diaSelecionado, abrirNovo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [dia, setDia] = useState(diaSelecionado);
  const [dialogo, setDialogo] = useState<{ compromisso: CompromissoDetalhe | null } | null>(abrirNovo ? { compromisso: null } : null);
  const [ocupado, iniciar] = useTransition();
  const refDoDia = useRef<HTMLElement>(null);

  const escolherDia = (chave: string) => {
    setDia(chave);
    // No celular a lista do dia fica embaixo do mes: leva ate ela.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => refDoDia.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const porDia = useMemo(() => agruparPorDia(agenda.eventos), [agenda.eventos]);
  const dias = useMemo(() => diasDaGrade(agenda.de, agenda.ate), [agenda.de, agenda.ate]);
  const doDia = porDia.get(dia) ?? [];

  const fecharDialogo = () => {
    setDialogo(null);
    // tira o ?novo=1 para nao reabrir num refresh
    if (abrirNovo) router.replace(`${pathname}?mes=${mes}&dia=${dia}`, { scroll: false });
  };

  const aposSalvar = (data: string) => {
    setDialogo(null);
    toast.success("Compromisso salvo.");
    router.replace(`${pathname}?mes=${data.slice(0, 7)}&dia=${data}`, { scroll: false });
    router.refresh();
  };

  const alternarConcluido = (evento: EventoDaAgenda) =>
    iniciar(async () => {
      const r = await marcarCompromissoConcluido(evento.id, !evento.concluido);
      if (!r.sucesso) toast.error(r.erro);
      router.refresh();
    });

  const remover = (evento: EventoDaAgenda) =>
    iniciar(async () => {
      const r = await removerCompromisso(evento.id);
      if (r.sucesso) toast.success("Compromisso removido.");
      else toast.error(r.erro);
      router.refresh();
    });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-kx-legenda">Compromissos, vencimentos e prazos de meta</span>
          <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Agenda</h1>
        </div>
        <Button type="button" onClick={() => setDialogo({ compromisso: null })}>
          <Plus className="h-4 w-4" />
          Novo compromisso
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
        {/* ── Mes ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-3 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold text-kx-texto">{rotuloDoMes(mes)}</h2>
            <div className="flex items-center gap-1.5">
              <Button asChild variant="outline" size="sm">
                <Link href={`${pathname}?mes=${agenda.hoje.slice(0, 7)}&dia=${agenda.hoje}`} scroll={false}>
                  Hoje
                </Link>
              </Button>
              <Button asChild variant="outline" size="icon" className="h-8 w-8">
                <Link href={`${pathname}?mes=${mesVizinho(mes, -1)}`} scroll={false} aria-label="Mês anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="icon" className="h-8 w-8">
                <Link href={`${pathname}?mes=${mesVizinho(mes, 1)}`} scroll={false} aria-label="Próximo mês">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-kx-legenda">
            {SEMANA.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dias.map((chave) => {
              const eventos = porDia.get(chave) ?? [];
              const foraDoMes = !chave.startsWith(mes);
              const ehHoje = chave === agenda.hoje;
              const escolhido = chave === dia;
              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => escolherDia(chave)}
                  aria-pressed={escolhido}
                  aria-label={`${rotuloDoDia(chave)}${eventos.length ? `, ${eventos.length} ${eventos.length === 1 ? "item" : "itens"}` : ""}`}
                  className={cn(
                    "flex min-h-[54px] flex-col gap-1 rounded-kx-botao border p-1 text-left transition-colors sm:min-h-[96px] sm:p-1.5",
                    escolhido ? "border-kx-primaria bg-kx-superficie" : "border-transparent bg-kx-superficie/60 hover:border-kx-destaque",
                    foraDoMes && "opacity-45"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      ehHoje ? "bg-kx-primaria text-primary-foreground" : "text-kx-texto"
                    )}
                  >
                    {Number(chave.slice(8))}
                  </span>
                  {/* celular: so pontinhos */}
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {eventos.slice(0, 4).map((e) => (
                      <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", ESTILO_DO_EVENTO[e.tipo].ponto)} />
                    ))}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {eventos.slice(0, MAXIMO_NO_QUADRADO).map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          "truncate rounded px-1 py-px text-[11px] font-semibold leading-tight",
                          ESTILO_DO_EVENTO[e.tipo].chip,
                          e.concluido && "line-through opacity-60"
                        )}
                      >
                        {e.titulo}
                      </span>
                    ))}
                    {eventos.length > MAXIMO_NO_QUADRADO && (
                      <span className="px-1 text-[11px] font-semibold text-kx-legenda">+{eventos.length - MAXIMO_NO_QUADRADO}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-kx-legenda">
            {Object.values(ESTILO_DO_EVENTO).map((estilo) => (
              <span key={estilo.rotulo} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", estilo.ponto)} />
                {estilo.rotulo}
              </span>
            ))}
          </div>
        </section>

        {/* ── Dia ─────────────────────────────────────────────── */}
        <section ref={refDoDia} className="flex scroll-mt-4 flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <h2 className="text-[17px] font-bold text-kx-texto first-letter:uppercase">{rotuloDoDia(dia)}</h2>
              {dia === agenda.hoje && <span className="text-xs text-kx-legenda">Hoje</span>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogo({ compromisso: null })}>
              <Plus className="h-3.5 w-3.5" />
              Agendar
            </Button>
          </div>

          {doDia.length === 0 ? (
            <p className="py-10 text-center text-sm text-kx-legenda">Nada marcado para este dia.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {doDia.map((evento) => {
                const estilo = ESTILO_DO_EVENTO[evento.tipo];
                const detalhe = agenda.compromissos[evento.id];
                return (
                  <li key={evento.id} className="flex gap-3 rounded-kx-botao bg-kx-superficie px-3 py-2.5">
                    <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", estilo.ponto)} aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn("text-sm font-bold text-kx-texto", evento.concluido && "text-kx-legenda line-through")}>
                        {evento.titulo}
                      </span>
                      <span className="text-xs text-kx-legenda">
                        {estilo.rotulo}
                        {evento.detalhe ? ` · ${evento.detalhe}` : ""}
                        {evento.valor !== null ? ` · ${formatarMoeda(evento.valor)}` : ""}
                        {evento.atrasado ? " · atrasado" : ""}
                      </span>
                      {detalhe?.descricao && <span className="whitespace-pre-line text-xs text-kx-texto-2">{detalhe.descricao}</span>}
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      {evento.tipo === "COMPROMISSO" && detalhe ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={ocupado}
                            onClick={() => alternarConcluido(evento)}
                            aria-label={evento.concluido ? "Reabrir" : "Marcar como feito"}
                            title={evento.concluido ? "Reabrir" : "Marcar como feito"}
                          >
                            {evento.concluido ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDialogo({ compromisso: detalhe })}
                            aria-label="Editar"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-kx-erro-texto"
                            disabled={ocupado}
                            onClick={() => remover(evento)}
                            aria-label="Remover"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : evento.href ? (
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                          <Link href={evento.href} aria-label={`Abrir ${estilo.rotulo}`} title="Abrir">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {dialogo && (
        <DialogoCompromisso
          compromisso={dialogo.compromisso}
          dataInicial={dia}
          podeVerClientes={agenda.podeVerClientes}
          onFechar={fecharDialogo}
          onSalvo={aposSalvar}
        />
      )}
    </>
  );
}
