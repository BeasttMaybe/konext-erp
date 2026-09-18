/**
 * Traducao entre o fluxo novo de 4 etapas (EtapaOS + SituacaoOS) e o
 * `StatusOS` legado — dominio puro, sem Prisma, React ou Next.
 *
 * Fase 1C-3 troca a leitura da aplicacao de `status` (8 valores) para `etapa`
 * (4 valores) + `situacao` (independente da etapa). Enquanto a coluna
 * `status` nao e removida (fase de contrato, ainda nao agendada — ver
 * docs/operacao/migrations.md secao 7), toda escrita que muda a etapa
 * precisa gravar as duas colunas na mesma transacao, e SO esta funcao decide
 * a traducao. Nenhum outro modulo deve reimplementar este mapeamento.
 *
 * A traducao etapa->status e necessariamente "com perda" num ponto: os
 * status legados APROVADO e EM_MANUTENCAO colapsam na mesma etapa CONSERTO
 * (nenhuma `situacao` os distingue — ver Parte 3 do prompt da fase). Ao
 * escrever de volta, CONSERTO sem situacao vira EM_MANUTENCAO (o caso mais
 * comum de "trabalho em andamento"); APROVADO so volta a existir em `status`
 * para linhas antigas que ninguem mais escreve.
 */

import type { StatusOS } from "./maquina-estados";

export type EtapaOS = "ORCAMENTO" | "CONSERTO" | "PRONTO" | "ENTREGUE";
export type SituacaoOS = "AGUARDANDO_APROVACAO" | "AGUARDANDO_PECA";

export type EstagioOS = {
  etapa: EtapaOS;
  situacao: SituacaoOS | null;
};

/** Situacoes validas para cada etapa — usado pra zerar `situacao` fora do lugar certo. */
export const SITUACOES_VALIDAS_POR_ETAPA: Readonly<Record<EtapaOS, readonly SituacaoOS[]>> = {
  ORCAMENTO: ["AGUARDANDO_APROVACAO"],
  CONSERTO: ["AGUARDANDO_PECA"],
  PRONTO: [],
  ENTREGUE: [],
};

/** Garante que a situacao informada e valida para a etapa — fora disso, vira null. */
export function normalizarSituacao(etapa: EtapaOS, situacao: SituacaoOS | null | undefined): SituacaoOS | null {
  if (!situacao) {
    return null;
  }

  return (SITUACOES_VALIDAS_POR_ETAPA[etapa] as readonly SituacaoOS[]).includes(situacao) ? situacao : null;
}

/**
 * Estagio (etapa+situacao) -> status legado, para a escrita dupla.
 * `ehRetornoGarantia` decide entre EM_MANUTENCAO e GARANTIA_RETORNO — nunca a
 * `situacao`, que nao tem valor pra isso.
 */
export function paraStatusLegado(estagio: EstagioOS, ehRetornoGarantia: boolean): StatusOS {
  const situacao = normalizarSituacao(estagio.etapa, estagio.situacao);

  switch (estagio.etapa) {
    case "ORCAMENTO":
      return situacao === "AGUARDANDO_APROVACAO" ? "AGUARDANDO_APROVACAO" : "AGUARDANDO_ORCAMENTO";
    case "CONSERTO":
      if (situacao === "AGUARDANDO_PECA") {
        return "AGUARDANDO_PECA";
      }
      return ehRetornoGarantia ? "GARANTIA_RETORNO" : "EM_MANUTENCAO";
    case "PRONTO":
      return "PRONTO";
    case "ENTREGUE":
      return "ENTREGUE";
  }
}

/**
 * Status legado -> estagio (etapa+situacao). Usado no backfill da migracao
 * (mesma tabela, em SQL) e em qualquer leitura que ainda precise decodificar
 * uma linha antiga. `ehRetornoGarantia` nao entra aqui: a etapa nunca
 * depende dela, so o status legado de saida (na funcao acima) depende.
 */
export function paraEstagio(status: StatusOS): EstagioOS {
  switch (status) {
    case "AGUARDANDO_ORCAMENTO":
      return { etapa: "ORCAMENTO", situacao: null };
    case "AGUARDANDO_APROVACAO":
      return { etapa: "ORCAMENTO", situacao: "AGUARDANDO_APROVACAO" };
    case "APROVADO":
    case "EM_MANUTENCAO":
    case "GARANTIA_RETORNO":
      return { etapa: "CONSERTO", situacao: null };
    case "AGUARDANDO_PECA":
      return { etapa: "CONSERTO", situacao: "AGUARDANDO_PECA" };
    case "PRONTO":
      return { etapa: "PRONTO", situacao: null };
    case "ENTREGUE":
      return { etapa: "ENTREGUE", situacao: null };
  }
}
