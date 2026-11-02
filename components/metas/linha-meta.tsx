"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, WifiOff } from "lucide-react";

import type { LinhaMetaLista } from "@/app/actions/metas";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { calcularRitmo, type Ritmo } from "@/lib/dominio/metas/ritmo";

/**
 * Uma meta por LINHA, não por cartão.
 *
 * O cartão mostrava três metas por tela e gastava a maior parte do espaço em
 * moldura, categoria e prioridade. Numa lista de metas o que se faz é
 * comparar — quais estão mal, qual vence primeiro — e comparar exige ver
 * várias de uma vez. A linha mostra dez.
 *
 * A linha carrega o RITMO, que o cartão não tinha: a barra mostra o progresso
 * real e marca onde ele deveria estar hoje. "42%" sozinho não responde se vai
 * bater; "42%, devia estar em 70%" responde.
 */
export function LinhaMeta({ meta, agora }: { meta: LinhaMetaLista; agora: Date }) {
  const ritmo = calcularRitmo({
    progresso: meta.progresso,
    inicio: meta.dataInicio ? new Date(meta.dataInicio) : null,
    prazo: meta.dataPrazo ? new Date(meta.dataPrazo) : null,
    agora,
  });

  const encerrada = meta.status === "CONCLUIDA" || meta.status === "CANCELADA";

  return (
    <li>
      <Link
        href={`/metas/${meta.id}`}
        className="grid grid-cols-1 items-center gap-3 rounded-kx-botao border border-kx-painel-borda bg-kx-cartao px-4 py-3 transition-colors hover:border-kx-destaque sm:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_auto_auto]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-kx-texto">{meta.titulo}</p>
            {meta.erroSincronizacao && (
              <WifiOff
                className="h-3.5 w-3.5 shrink-0 text-kx-erro-icone"
                aria-label="Falha na última atualização automática"
              />
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-kx-legenda">
            {textoDeValor(meta)}
          </p>
        </div>

        <div className="min-w-0">
          <BarraComRitmo progresso={meta.progresso} ritmo={ritmo} encerrada={encerrada} />
          <p className="mt-1 text-xs text-kx-legenda">{textoDeRitmo(ritmo, encerrada)}</p>
        </div>

        <div className="justify-self-start sm:justify-self-end">
          {pilulaDeSituacao(ritmo, meta.status)}
        </div>

        <ChevronRight className="hidden h-4 w-4 shrink-0 text-kx-legenda sm:block" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * Barra de progresso com um traço marcando o esperado para hoje.
 *
 * O traço é o ponto todo: sem ele, duas metas em 42% parecem iguais, e uma
 * pode estar adiantada e a outra a ponto de estourar o prazo.
 */
function BarraComRitmo({
  progresso,
  ritmo,
  encerrada,
}: {
  progresso: number;
  ritmo: Ritmo;
  encerrada: boolean;
}) {
  const atrasado = !encerrada && (ritmo.situacao === "ATRASADO" || ritmo.situacao === "PRAZO_VENCIDO");

  const corBarra = encerrada
    ? "bg-kx-legenda"
    : progresso >= 100
      ? "bg-kx-sucesso"
      : atrasado
        ? "bg-kx-alerta"
        : "bg-kx-info";

  return (
    <div
      className="relative h-2.5 overflow-hidden rounded-kx-pilula bg-kx-superficie"
      role="progressbar"
      aria-valuenow={Math.round(progresso)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-kx-pilula ${corBarra}`}
        style={{ width: `${Math.min(100, Math.max(0, progresso))}%` }}
      />

      {ritmo.progressoEsperado !== null && !encerrada && ritmo.progressoEsperado < 100 && (
        <span
          aria-hidden
          title="Onde deveria estar hoje"
          className="absolute top-0 h-full w-0.5 bg-kx-texto"
          style={{ left: `${Math.min(100, Math.max(0, ritmo.progressoEsperado))}%` }}
        />
      )}
    </div>
  );
}

function textoDeValor(meta: LinhaMetaLista): string {
  if (meta.tipoValor === "CHECKLIST") {
    return `${meta.itensConcluidos} de ${meta.totalItensChecklist} itens`;
  }

  const atual = formatarValor(meta.valorAtual, meta.tipoValor, meta.unidade);

  if (meta.valorAlvo === null) return atual;

  return `${atual} de ${formatarValor(meta.valorAlvo, meta.tipoValor, meta.unidade)}`;
}

function formatarValor(valor: number, tipoValor: string, unidade: string | null): string {
  if (tipoValor === "DINHEIRO") {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  if (tipoValor === "PERCENTUAL") {
    return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }

  const numero = valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unidade ? `${numero} ${unidade}` : numero;
}

function textoDeRitmo(ritmo: Ritmo, encerrada: boolean): string {
  if (encerrada) return "Encerrada";

  switch (ritmo.situacao) {
    case "CONCLUIDA":
      return "Alvo alcançado";
    case "PRAZO_VENCIDO":
      return `Prazo venceu há ${Math.abs(ritmo.diasRestantes ?? 0)} dia(s)`;
    case "NAO_COMECOU":
      return "Ainda não começou";
    case "SEM_PRAZO":
      return "Sem prazo definido";
    case "ATRASADO":
      return `Devia estar em ${Math.round(ritmo.progressoEsperado ?? 0)}% · ${ritmo.diasRestantes} dia(s) restantes`;
    case "NO_RITMO":
      return ritmo.diasRestantes !== null
        ? `No ritmo · ${ritmo.diasRestantes} dia(s) restantes`
        : "No ritmo";
  }
}

function pilulaDeSituacao(ritmo: Ritmo, status: string) {
  if (status === "CONCLUIDA") return <PilulaStatus variante="sucesso">Concluída</PilulaStatus>;
  if (status === "CANCELADA") return <PilulaStatus variante="neutro">Cancelada</PilulaStatus>;
  if (status === "PAUSADA") return <PilulaStatus variante="neutro">Pausada</PilulaStatus>;

  if (ritmo.situacao === "PRAZO_VENCIDO") {
    return <PilulaStatus variante="erro">Prazo vencido</PilulaStatus>;
  }

  if (ritmo.situacao === "ATRASADO") {
    return (
      <PilulaStatus variante="alerta">
        <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
        Fora do ritmo
      </PilulaStatus>
    );
  }

  if (ritmo.situacao === "CONCLUIDA") return <PilulaStatus variante="sucesso">Alvo batido</PilulaStatus>;
  if (ritmo.situacao === "NAO_COMECOU") return <PilulaStatus variante="neutro">A começar</PilulaStatus>;

  return <PilulaStatus variante="conserto">No ritmo</PilulaStatus>;
}
