"use client";

import Link from "next/link";
import { AlertTriangle, PhoneCall } from "lucide-react";

import type { LinhaProposta as DadosLinhaProposta } from "@/app/actions/propostas";
import { PilulaStatus } from "@/components/ui/pilula-status";
import {
  calcularSituacao,
  type SituacaoCalculada,
} from "@/lib/dominio/propostas/situacao";

import { MenuProposta } from "./menu-proposta";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Data de calendário vinda em ISO: formata em UTC, que é onde ela foi ancorada. */
function formatarData(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/**
 * Uma proposta por LINHA.
 *
 * O que a tela antiga mostrava: código, data, cliente, equipamento, valor e um
 * status que nunca mudava. O que faltava estava gravado no banco e não aparecia
 * em lugar nenhum: a **validade** e o **próximo contato**. Por isso uma proposta
 * que vence amanhã e uma que venceu há um mês eram visualmente idênticas.
 *
 * Agora a linha diz, em palavras, o que fazer com ela: "vence hoje", "venceu há
 * 12 dias", "contato marcado pra hoje".
 */
export function LinhaProposta({
  proposta,
  hojeIso,
  podeEditar,
}: {
  proposta: DadosLinhaProposta;
  /** Hoje no fuso da LOJA, calculado no servidor — o navegador do usuário pode estar em outro. */
  hojeIso: string;
  podeEditar: boolean;
}) {
  const situacao = calcularSituacao({
    status: proposta.status,
    validade: new Date(proposta.validade),
    proximoContato: proposta.proximoContato ? new Date(proposta.proximoContato) : null,
    hoje: new Date(hojeIso),
  });

  return (
    <li className="rounded-kx-botao border border-kx-painel-borda bg-kx-cartao transition-colors hover:border-kx-destaque">
      <div className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
        <div className="min-w-0">
          <Link
            href={`/crm/propostas/${proposta.id}`}
            className="truncate text-sm font-bold text-kx-texto hover:underline"
          >
            {proposta.cliente}
          </Link>
          <p className="mt-0.5 truncate text-xs text-kx-legenda">
            {proposta.equipamento?.trim() || "Equipamento não informado"}
            {" · "}
            {proposta.quantidadeItens === 1 ? "1 item" : `${proposta.quantidadeItens} itens`}
            {" · "}
            {formatarData(proposta.dataEmissao)}
          </p>
        </div>

        <p className="text-sm font-bold tabular-nums text-kx-texto sm:text-right">
          {formatarMoeda(proposta.valorTotal)}
        </p>

        <div className="min-w-0">
          <PilulaDeSituacao situacao={situacao} />
          <p className="mt-1 truncate text-xs text-kx-legenda">{textoDeSituacao(situacao, proposta)}</p>
        </div>

        <div className="justify-self-start sm:justify-self-end">
          <MenuProposta
            propostaId={proposta.id}
            status={proposta.status}
            podeEditar={podeEditar}
            proximoContato={proposta.proximoContato}
          />
        </div>
      </div>
    </li>
  );
}

function PilulaDeSituacao({ situacao }: { situacao: SituacaoCalculada }) {
  switch (situacao.situacao) {
    case "APROVADA":
      return <PilulaStatus variante="sucesso">Aprovada</PilulaStatus>;

    case "REJEITADA":
      return <PilulaStatus variante="neutro">Recusada</PilulaStatus>;

    case "RASCUNHO":
      return (
        <PilulaStatus variante="neutro">
          {situacao.contatoAtrasado && <PhoneCall className="h-3 w-3" aria-hidden />}
          Rascunho
        </PilulaStatus>
      );

    case "VENCIDA":
      return <PilulaStatus variante="erro">Venceu</PilulaStatus>;

    case "VENCENDO":
      return (
        <PilulaStatus variante="alerta">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {situacao.diasParaVencer === 0 ? "Vence hoje" : "Vencendo"}
        </PilulaStatus>
      );

    case "AGUARDANDO":
      return (
        <PilulaStatus variante="conserto">
          {situacao.contatoAtrasado && <PhoneCall className="h-3 w-3" aria-hidden />}
          Aguardando
        </PilulaStatus>
      );
  }
}

/**
 * A frase embaixo da pílula. A pílula diz o estado; a frase diz o prazo, que é
 * o que decide se você liga agora ou na semana que vem.
 */
function textoDeSituacao(situacao: SituacaoCalculada, proposta: DadosLinhaProposta): string {
  if (situacao.situacao === "APROVADA") return "Dá pra gerar a OS a partir dela";
  if (situacao.situacao === "REJEITADA") return "Fechada";

  // O contato atrasado tem precedência na frase: é a única coisa aqui que você
  // combinou com o cliente, e esquecer dela é pior que perder a validade.
  if (situacao.contatoAtrasado && proposta.proximoContato) {
    const dia = formatarData(proposta.proximoContato);
    return situacao.situacao === "RASCUNHO"
      ? `Prometida pra ${dia} e ainda não enviada`
      : `Contato marcado pra ${dia}`;
  }

  if (situacao.situacao === "RASCUNHO") return "Ainda não enviada ao cliente";

  const dias = situacao.diasParaVencer ?? 0;

  if (situacao.situacao === "VENCIDA") {
    const atraso = Math.abs(dias);
    return atraso === 1 ? "Venceu ontem" : `Venceu há ${atraso} dias`;
  }

  if (dias === 0) return `Último dia — validade ${formatarData(proposta.validade)}`;
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
}
