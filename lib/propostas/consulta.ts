/**
 * As consultas SQL da lista de propostas, separadas da server action.
 *
 * Estão aqui, e não dentro da action, por um motivo prático: a action exige
 * contexto de tenant (sessão, permissões, conexão), então não dá pra executá-la
 * num teste. Estes construtores são funções puras que devolvem SQL — o que
 * permite rodar o SQL de verdade contra um Postgres descartável e conferir que
 * a ordem que o banco produz é a mesma que `lib/dominio/propostas/situacao.ts`
 * calcula em TypeScript. Ver `verificacao/consultas-propostas.spec.ts`.
 *
 * Por que a ordenação é SQL e não JavaScript: a tela é paginada. Ordenar a
 * página já carregada ordenaria 20 de 300 propostas, e a mais urgente poderia
 * estar na página 3 — exatamente o problema que a ordenação existe pra
 * resolver.
 */

import { Prisma } from "@prisma/client";

import {
  AJUSTE_CONTATO_ATRASADO,
  DIAS_PARA_ALERTA_DE_VALIDADE,
  FAIXAS_DE_URGENCIA,
  TETO_DE_DIAS_NA_FAIXA,
} from "@/lib/dominio/propostas/situacao";

export type FiltroSituacaoProposta =
  | "ATENCAO"
  | "EM_ABERTO"
  | "RASCUNHO"
  | "AGUARDANDO"
  | "APROVADA"
  | "REJEITADA"
  | "TODAS";

export type OrdemProposta = "urgencia" | "recentes" | "maior_valor";

/**
 * Ordem de urgência, em SQL.
 *
 * A regra é a de `lib/dominio/propostas/situacao.ts` e as constantes vêm de lá,
 * não repetidas aqui — duas cópias dos números divergiriam na primeira
 * mudança. O cálculo roda no banco porque a tela é paginada: ordenar em
 * memória ordenaria apenas a página já carregada, e a proposta mais urgente
 * poderia estar na página 3.
 */
export function expressaoDeUrgencia(hojeIso: string): Prisma.Sql {
  const diasVencida = Prisma.sql`("PropostaComercial"."validade"::date - ${hojeIso}::date) * -1`;
  const diasAteVencer = Prisma.sql`("PropostaComercial"."validade"::date - ${hojeIso}::date)`;

  const faixa = Prisma.sql`
    CASE
      WHEN "PropostaComercial"."status" = 'APROVADA' THEN ${FAIXAS_DE_URGENCIA.APROVADA}::numeric
      WHEN "PropostaComercial"."status" = 'REJEITADA' THEN ${FAIXAS_DE_URGENCIA.REJEITADA}::numeric
      WHEN "PropostaComercial"."status" = 'RASCUNHO' THEN ${FAIXAS_DE_URGENCIA.RASCUNHO}::numeric
      WHEN ${diasAteVencer} < 0
        THEN ${FAIXAS_DE_URGENCIA.VENCIDA}::numeric + LEAST(${diasVencida}, ${TETO_DE_DIAS_NA_FAIXA})
      WHEN ${diasAteVencer} <= ${DIAS_PARA_ALERTA_DE_VALIDADE}
        THEN ${FAIXAS_DE_URGENCIA.VENCENDO}::numeric + ${diasAteVencer}
      ELSE ${FAIXAS_DE_URGENCIA.AGUARDANDO}::numeric
           + LEAST(${diasAteVencer}, ${TETO_DE_DIAS_NA_FAIXA})::numeric / 1000
    END`;

  // O contato atrasado puxa pra cima DENTRO da faixa; nunca entre faixas. Só
  // vale pra proposta em aberto — cobrar follow-up de proposta fechada é ruído.
  const ajusteContato = Prisma.sql`
    CASE
      WHEN "PropostaComercial"."status" IN ('RASCUNHO', 'ENVIADA')
       AND "PropostaComercial"."proximoContato" IS NOT NULL
       AND "PropostaComercial"."proximoContato"::date <= ${hojeIso}::date
      THEN ${AJUSTE_CONTATO_ATRASADO}::numeric
      ELSE 0::numeric
    END`;

  return Prisma.sql`(${faixa}) - (${ajusteContato})`;
}

/** Filtro em SQL, pros casos que dependem da data de hoje. */
export function filtroDeSituacao(situacao: FiltroSituacaoProposta, hojeIso: string): Prisma.Sql {
  const emAberto = Prisma.sql`"PropostaComercial"."status" IN ('RASCUNHO', 'ENVIADA')`;

  switch (situacao) {
    case "TODAS":
      return Prisma.sql`TRUE`;

    case "EM_ABERTO":
      return emAberto;

    case "RASCUNHO":
      return Prisma.sql`"PropostaComercial"."status" = 'RASCUNHO'`;

    case "APROVADA":
      return Prisma.sql`"PropostaComercial"."status" = 'APROVADA'`;

    case "REJEITADA":
      return Prisma.sql`"PropostaComercial"."status" = 'REJEITADA'`;

    // Enviada, dentro da validade e com folga — nada a fazer hoje.
    case "AGUARDANDO":
      return Prisma.sql`
        "PropostaComercial"."status" = 'ENVIADA'
        AND ("PropostaComercial"."validade"::date - ${hojeIso}::date) > ${DIAS_PARA_ALERTA_DE_VALIDADE}
        AND (
          "PropostaComercial"."proximoContato" IS NULL
          OR "PropostaComercial"."proximoContato"::date > ${hojeIso}::date
        )`;

    // O que pede ação hoje: a validade está perto ou passou, ou o follow-up
    // marcado já chegou. Um rascunho com contato atrasado entra também — é uma
    // proposta que você prometeu mandar e não mandou.
    case "ATENCAO":
      return Prisma.sql`
        ${emAberto}
        AND (
          (
            "PropostaComercial"."status" = 'ENVIADA'
            AND ("PropostaComercial"."validade"::date - ${hojeIso}::date) <= ${DIAS_PARA_ALERTA_DE_VALIDADE}
          )
          OR (
            "PropostaComercial"."proximoContato" IS NOT NULL
            AND "PropostaComercial"."proximoContato"::date <= ${hojeIso}::date
          )
        )`;
  }
}

export function filtroDeBusca(busca: string | undefined): Prisma.Sql {
  const termo = busca?.trim();
  if (!termo) return Prisma.sql`TRUE`;

  const padrao = `%${termo}%`;
  return Prisma.sql`(
    "PropostaComercial"."cliente" ILIKE ${padrao}
    OR "PropostaComercial"."equipamento" ILIKE ${padrao}
    OR "PropostaComercial"."defeito" ILIKE ${padrao}
    OR "PropostaComercial"."id"::text ILIKE ${padrao}
  )`;
}

export function ordenacao(ordem: OrdemProposta, hojeIso: string): Prisma.Sql {
  if (ordem === "recentes") {
    return Prisma.sql`"PropostaComercial"."criadoEm" DESC`;
  }
  if (ordem === "maior_valor") {
    return Prisma.sql`"PropostaComercial"."valorTotal" DESC`;
  }
  // Empate dentro da mesma urgência: a mais recente primeiro.
  return Prisma.sql`${expressaoDeUrgencia(hojeIso)} ASC, "PropostaComercial"."criadoEm" DESC`;
}
