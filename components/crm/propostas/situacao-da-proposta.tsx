import { AlertTriangle, CalendarClock, CalendarX, CheckCircle2, FileEdit, XCircle } from "lucide-react";

import { calcularSituacao, type StatusProposta } from "@/lib/dominio/propostas/situacao";

function formatarData(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function formatarInstante(iso: string, fusoHorario: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fusoHorario,
  }).format(new Date(iso));
}

/**
 * Faixa de situação no topo do detalhe da proposta.
 *
 * Existe porque a página antiga mostrava a validade como mais um campo de texto
 * no meio de outros seis, do mesmo tamanho e da mesma cor — ou seja, uma
 * proposta vencida há um mês parecia idêntica a uma válida. A validade é a
 * única informação desta tela que muda sozinha com o tempo; todo o resto foi
 * digitado uma vez e não muda mais.
 */
export function SituacaoDaProposta({
  status,
  validade,
  proximoContato,
  respondidaEm,
  motivoResposta,
  hojeIso,
  fusoHorario,
}: {
  status: StatusProposta;
  validade: string;
  proximoContato: string | null;
  respondidaEm: string | null;
  motivoResposta: string | null;
  hojeIso: string;
  fusoHorario: string;
}) {
  const situacao = calcularSituacao({
    status,
    validade: new Date(validade),
    proximoContato: proximoContato ? new Date(proximoContato) : null,
    hoje: new Date(hojeIso),
  });

  const aparencia = aparenciaDaSituacao(situacao.situacao);
  const Icone = aparencia.icone;

  return (
    <div className={`rounded-kx-cartao border p-4 ${aparencia.classe}`}>
      <div className="flex items-start gap-3">
        <Icone className={`mt-0.5 h-5 w-5 shrink-0 ${aparencia.classeIcone}`} aria-hidden />

        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold text-kx-texto">
            {tituloDaSituacao(status, situacao.diasParaVencer)}
          </p>

          <p className="text-sm text-kx-texto-2">
            {detalheDaSituacao({
              status,
              validade,
              respondidaEm,
              diasParaVencer: situacao.diasParaVencer,
              fusoHorario,
            })}
          </p>

          {situacao.contatoAtrasado && proximoContato && (
            <p className="text-sm font-semibold text-kx-alerta-texto">
              Contato marcado pra {formatarData(proximoContato)} — e ainda não feito.
            </p>
          )}

          {!situacao.contatoAtrasado && proximoContato && situacao.emAberto && (
            <p className="text-sm text-kx-texto-2">
              Próximo contato: {formatarData(proximoContato)}.
            </p>
          )}

          {motivoResposta?.trim() && (
            <p className="text-sm text-kx-texto-2">
              <span className="font-semibold">O cliente disse:</span> {motivoResposta}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function aparenciaDaSituacao(situacao: ReturnType<typeof calcularSituacao>["situacao"]) {
  switch (situacao) {
    case "APROVADA":
      return {
        icone: CheckCircle2,
        classe: "border-kx-sucesso bg-kx-sucesso-fundo",
        classeIcone: "text-kx-sucesso-icone",
      };
    case "REJEITADA":
      return {
        icone: XCircle,
        classe: "border-kx-painel-borda bg-kx-cartao",
        classeIcone: "text-kx-legenda",
      };
    case "VENCIDA":
      return {
        icone: CalendarX,
        classe: "border-kx-erro-borda bg-kx-erro-fundo",
        classeIcone: "text-kx-erro-icone",
      };
    case "VENCENDO":
      return {
        icone: AlertTriangle,
        classe: "border-kx-alerta bg-kx-alerta-fundo",
        classeIcone: "text-kx-alerta-icone",
      };
    case "RASCUNHO":
      return {
        icone: FileEdit,
        classe: "border-kx-painel-borda bg-kx-cartao",
        classeIcone: "text-kx-legenda",
      };
    case "AGUARDANDO":
      return {
        icone: CalendarClock,
        classe: "border-kx-painel-borda bg-kx-cartao",
        classeIcone: "text-kx-info-icone",
      };
  }
}

function tituloDaSituacao(status: StatusProposta, diasParaVencer: number | null): string {
  if (status === "APROVADA") return "Aprovada pelo cliente";
  if (status === "REJEITADA") return "Recusada pelo cliente";
  if (status === "RASCUNHO") return "Rascunho — ainda não enviada";

  const dias = diasParaVencer ?? 0;

  if (dias < 0) {
    const atraso = Math.abs(dias);
    return atraso === 1 ? "Venceu ontem, sem resposta" : `Venceu há ${atraso} dias, sem resposta`;
  }
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";

  return "Aguardando resposta do cliente";
}

function detalheDaSituacao(parametros: {
  status: StatusProposta;
  validade: string;
  respondidaEm: string | null;
  diasParaVencer: number | null;
  fusoHorario: string;
}): string {
  const { status, validade, respondidaEm, diasParaVencer, fusoHorario } = parametros;

  if (status === "APROVADA" || status === "REJEITADA") {
    return respondidaEm
      ? `Registrado em ${formatarInstante(respondidaEm, fusoHorario)}.`
      : "Resposta registrada.";
  }

  if (status === "RASCUNHO") {
    return `A validade de ${formatarData(validade)} só começa a valer depois de enviar.`;
  }

  const dias = diasParaVencer ?? 0;

  if (dias < 0) {
    return `A validade era ${formatarData(validade)}. Ainda dá pra retomar com uma ligação.`;
  }

  return `Validade até ${formatarData(validade)}${dias > 1 ? ` — ${dias} dias.` : "."}`;
}
