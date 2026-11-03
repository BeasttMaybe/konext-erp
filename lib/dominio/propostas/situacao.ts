/**
 * Situação real de uma proposta comercial.
 *
 * O `status` gravado no banco (RASCUNHO/ENVIADA/APROVADA/REJEITADA) só conta
 * metade da história: diz o que foi REGISTRADO, não o que está acontecendo.
 * Uma proposta "ENVIADA" com validade vencida há três semanas e uma enviada
 * ontem têm o mesmo status e exigem coisas opostas — e a tela mostrava as duas
 * iguais, porque `validade` era gravada e nunca lida.
 *
 * Este módulo cruza status + validade + próximo contato e devolve a situação
 * que decide o que fazer hoje. Mesmo papel que `lib/dominio/metas/ritmo.ts`
 * faz para metas: o número cru não responde a pergunta, a comparação com a
 * data de hoje responde.
 *
 * Todas as datas aqui são DATAS DE CALENDÁRIO (meia-noite UTC — ver
 * `lib/datas.ts`). Validade é um dia, não um instante: "vence dia 10" não
 * depende da hora, e comparar instante com instante faria a mesma proposta
 * vencer em dias diferentes conforme o fuso de quem olha.
 */

import { diferencaEntreDatasDeCalendario } from "@/lib/datas";

/** Espelha `StatusPropostaComercial` do schema. */
export type StatusProposta = "RASCUNHO" | "ENVIADA" | "APROVADA" | "REJEITADA";

export type SituacaoProposta =
  /** Nunca foi enviada ao cliente. Pendência sua, não dele. */
  | "RASCUNHO"
  /** Enviada, dentro da validade, com folga. */
  | "AGUARDANDO"
  /** Enviada e a validade acaba hoje ou nos próximos dias. */
  | "VENCENDO"
  /** A validade passou e o cliente nunca respondeu. */
  | "VENCIDA"
  /** O cliente aceitou. */
  | "APROVADA"
  /** O cliente recusou. */
  | "REJEITADA";

/**
 * A partir de quantos dias para o fim da validade a proposta entra em
 * "vencendo". Três dias é o que dá para ligar para o cliente antes de perder
 * o orçamento — menos que isso o aviso chega tarde, mais que isso tudo fica
 * marcado como urgente e o aviso perde sentido.
 */
export const DIAS_PARA_ALERTA_DE_VALIDADE = 3;

export type SituacaoCalculada = {
  situacao: SituacaoProposta;
  /**
   * Dias de calendário até a validade. Negativo quando já passou, 0 quando
   * vence hoje. `null` para proposta já respondida (a validade deixou de
   * importar) ou rascunho.
   */
  diasParaVencer: number | null;
  /** O próximo contato está marcado para hoje ou para uma data já passada. */
  contatoAtrasado: boolean;
  /** Ainda depende de uma resposta do cliente — ou seja, ainda é dinheiro em jogo. */
  emAberto: boolean;
};

export function calcularSituacao(parametros: {
  status: StatusProposta;
  /** Data de calendário (meia-noite UTC). */
  validade: Date;
  /** Data de calendário, ou `null` quando não há follow-up marcado. */
  proximoContato: Date | null;
  /** Hoje, como data de calendário no fuso da loja. */
  hoje: Date;
}): SituacaoCalculada {
  const { status, validade, proximoContato, hoje } = parametros;

  // Respondida: a validade não quer dizer mais nada, e cobrar contato de uma
  // proposta fechada seria ruído.
  if (status === "APROVADA" || status === "REJEITADA") {
    return { situacao: status, diasParaVencer: null, contatoAtrasado: false, emAberto: false };
  }

  const contatoAtrasado =
    proximoContato !== null && diferencaEntreDatasDeCalendario(hoje, proximoContato) <= 0;

  // Rascunho não vence: a proposta nem saiu daqui. O que falta é mandar.
  if (status === "RASCUNHO") {
    return { situacao: "RASCUNHO", diasParaVencer: null, contatoAtrasado, emAberto: true };
  }

  const diasParaVencer = diferencaEntreDatasDeCalendario(hoje, validade);

  if (diasParaVencer < 0) {
    return { situacao: "VENCIDA", diasParaVencer, contatoAtrasado, emAberto: true };
  }

  return {
    situacao: diasParaVencer <= DIAS_PARA_ALERTA_DE_VALIDADE ? "VENCENDO" : "AGUARDANDO",
    diasParaVencer,
    contatoAtrasado,
    emAberto: true,
  };
}

/**
 * Base de cada faixa de urgência. Exportado porque a ordenação da lista roda
 * NO BANCO (a tela é paginada, então ordenar em memória ordenaria só a página
 * visível) e a consulta monta o mesmo cálculo em SQL a partir destas
 * constantes. Duas implementações da regra passariam a divergir em silêncio;
 * dois usos das mesmas constantes, não.
 *
 * O limite de 365 em `VENCIDA` e `AGUARDANDO` é o que impede uma faixa de
 * invadir a de baixo: sem ele, uma proposta vencida há dois anos passaria a
 * valer mais que um rascunho.
 */
export const FAIXAS_DE_URGENCIA = {
  VENCENDO: 100,
  VENCIDA: 200,
  AGUARDANDO: 600,
  RASCUNHO: 700,
  APROVADA: 900,
  REJEITADA: 950,
} as const;

/** Quanto um follow-up atrasado puxa a proposta pra cima dentro da faixa. */
export const AJUSTE_CONTATO_ATRASADO = 0.5;

/** Teto de dias somado dentro de uma faixa, pra nunca invadir a seguinte. */
export const TETO_DE_DIAS_NA_FAIXA = 365;

/**
 * Peso de urgência, para ordenar a lista pelo que pede ação hoje em vez de por
 * data de criação. Quanto MENOR, mais no topo.
 *
 * A ordem responde "o que eu faço agora": primeiro o que ainda dá para salvar
 * (vence hoje), depois o que já passou mas ainda é recuperável com uma ligação,
 * depois o que só precisa sair daqui (rascunho), e por último o que está
 * resolvido.
 */
export function pesoDeUrgencia(calculada: SituacaoCalculada): number {
  const { situacao, diasParaVencer, contatoAtrasado } = calculada;

  // O contato atrasado puxa pra cima dentro da mesma faixa, nunca entre
  // faixas: um follow-up esquecido numa proposta com 20 dias de validade não
  // é mais urgente que uma que vence hoje.
  const ajusteContato = contatoAtrasado ? -AJUSTE_CONTATO_ATRASADO : 0;

  switch (situacao) {
    case "VENCENDO":
      // Entre duas que vencem, a de prazo mais curto primeiro.
      return FAIXAS_DE_URGENCIA.VENCENDO + Math.max(0, diasParaVencer ?? 0) + ajusteContato;

    case "VENCIDA": {
      // Vencida ontem ainda se resolve com um telefonema; vencida há três
      // meses é arquivo. Quanto mais antiga, mais pra baixo.
      const diasVencida = Math.abs(diasParaVencer ?? 0);
      return (
        FAIXAS_DE_URGENCIA.VENCIDA + Math.min(diasVencida, TETO_DE_DIAS_NA_FAIXA) + ajusteContato
      );
    }

    case "AGUARDANDO":
      return (
        FAIXAS_DE_URGENCIA.AGUARDANDO +
        Math.max(0, Math.min(diasParaVencer ?? TETO_DE_DIAS_NA_FAIXA, TETO_DE_DIAS_NA_FAIXA)) /
          1000 +
        ajusteContato
      );

    case "RASCUNHO":
      return FAIXAS_DE_URGENCIA.RASCUNHO + ajusteContato;

    case "APROVADA":
      return FAIXAS_DE_URGENCIA.APROVADA;

    case "REJEITADA":
      return FAIXAS_DE_URGENCIA.REJEITADA;
  }
}

/**
 * Uma proposta já respondida não volta atrás por aqui. Reabrir um orçamento
 * fechado é decisão com consequência (some do histórico de conversão, volta a
 * cobrar follow-up) e precisa de uma ação própria, não de um clique no mesmo
 * menu que registra a resposta.
 */
export function podeRegistrarResposta(status: StatusProposta): boolean {
  return status === "RASCUNHO" || status === "ENVIADA";
}

/** Rascunho é o único estado de onde "marcar como enviada" faz sentido. */
export function podeMarcarComoEnviada(status: StatusProposta): boolean {
  return status === "RASCUNHO";
}

/**
 * Taxa de conversão: aprovadas sobre o total de propostas já RESPONDIDAS.
 *
 * O denominador exclui o que ainda está em aberto de propósito. Dividir pelo
 * total faria a taxa cair sozinha a cada orçamento novo que você emite — a
 * tela diria que você está piorando justamente nos meses em que mais vendeu.
 * `null` quando ninguém respondeu nada ainda: não existe taxa de zero
 * respostas, e mostrar "0%" nesse caso seria mentira.
 */
export function calcularTaxaDeConversao(parametros: {
  aprovadas: number;
  rejeitadas: number;
}): number | null {
  const respondidas = parametros.aprovadas + parametros.rejeitadas;
  if (respondidas <= 0) return null;
  return (parametros.aprovadas / respondidas) * 100;
}
