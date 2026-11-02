/**
 * Ritmo de uma meta: o progresso esperado para HOJE, contra o real.
 *
 * É a informação que faltava. O sistema mostrava "42% concluído", o que não
 * responde a pergunta que importa — vou bater ou não? 42% no dia 5 de um mês
 * é ótimo; 42% no dia 28 é um problema, e os dois apareciam iguais na tela.
 *
 * A conta é proporção linear de tempo decorrido. É a hipótese mais simples e
 * a única honesta sem saber a sazonalidade da loja: supõe que a meta avança
 * de forma pareja entre o início e o prazo. Uma meta de faturamento mensal
 * numa loja que vende mais no fim do mês vai parecer atrasada no dia 20 e não
 * estar — por isso o resultado informa a folga em pontos percentuais, e não
 * só um rótulo, para quem lê poder calibrar.
 */

export type SituacaoRitmo =
  /** Sem prazo ou sem início: não há ritmo a calcular. */
  | "SEM_PRAZO"
  /** O prazo ainda não começou. */
  | "NAO_COMECOU"
  /** Dentro do esperado para hoje (ou adiante). */
  | "NO_RITMO"
  /** Atrás do esperado, mas ainda dá. */
  | "ATRASADO"
  /** O prazo passou e a meta não fechou. */
  | "PRAZO_VENCIDO"
  /** Chegou a 100% antes do prazo. */
  | "CONCLUIDA";

export type Ritmo = {
  situacao: SituacaoRitmo;
  /** Progresso esperado para hoje, 0–100. `null` quando não há ritmo. */
  progressoEsperado: number | null;
  /**
   * Progresso real menos esperado, em pontos percentuais. Negativo = atrás.
   * `null` quando não há ritmo.
   */
  folga: number | null;
  /** Dias até o prazo. Negativo quando já passou. `null` sem prazo. */
  diasRestantes: number | null;
};

/** Tolerância antes de chamar de atrasado, em pontos percentuais. */
const TOLERANCIA_PONTOS = 5;

const MILISSEGUNDOS_POR_DIA = 86_400_000;

/**
 * `agora`, `inicio` e `prazo` são instantes. Quem chama resolve o fuso da
 * loja antes (ver lib/datas.ts) — este módulo não decide que dia é hoje,
 * porque "hoje" depende do fuso e isso não é problema de ritmo.
 */
export function calcularRitmo(parametros: {
  progresso: number;
  inicio: Date | null;
  prazo: Date | null;
  agora: Date;
}): Ritmo {
  const { progresso, inicio, prazo, agora } = parametros;

  if (!prazo) {
    return { situacao: "SEM_PRAZO", progressoEsperado: null, folga: null, diasRestantes: null };
  }

  const diasRestantes = Math.ceil((prazo.getTime() - agora.getTime()) / MILISSEGUNDOS_POR_DIA);

  if (progresso >= 100) {
    return { situacao: "CONCLUIDA", progressoEsperado: 100, folga: 0, diasRestantes };
  }

  // Sem início, o ritmo não é calculável — mas o prazo ainda vale, e dizer
  // "venceu" é mais útil que dizer "sem prazo".
  if (!inicio) {
    return {
      situacao: prazo.getTime() < agora.getTime() ? "PRAZO_VENCIDO" : "SEM_PRAZO",
      progressoEsperado: null,
      folga: null,
      diasRestantes,
    };
  }

  if (agora.getTime() < inicio.getTime()) {
    return { situacao: "NAO_COMECOU", progressoEsperado: 0, folga: 0, diasRestantes };
  }

  if (prazo.getTime() < agora.getTime()) {
    return { situacao: "PRAZO_VENCIDO", progressoEsperado: 100, folga: progresso - 100, diasRestantes };
  }

  const duracao = prazo.getTime() - inicio.getTime();

  // Início e prazo no mesmo instante: a meta é para hoje, e o esperado é tudo.
  if (duracao <= 0) {
    return {
      situacao: progresso >= 100 - TOLERANCIA_PONTOS ? "NO_RITMO" : "ATRASADO",
      progressoEsperado: 100,
      folga: progresso - 100,
      diasRestantes,
    };
  }

  const decorrido = agora.getTime() - inicio.getTime();
  const progressoEsperado = Math.min(100, (decorrido / duracao) * 100);
  const folga = progresso - progressoEsperado;

  return {
    situacao: folga >= -TOLERANCIA_PONTOS ? "NO_RITMO" : "ATRASADO",
    progressoEsperado,
    folga,
    diasRestantes,
  };
}

/**
 * Peso de urgência, para ordenar a lista pelo que precisa de ação hoje.
 *
 * Existe porque a lista ordenada por data de criação não responde "o que eu
 * faço agora". Quanto MENOR o peso, mais no topo.
 */
export function pesoDeUrgencia(parametros: {
  situacao: SituacaoRitmo;
  status: string;
  folga: number | null;
  diasRestantes: number | null;
  temErroSincronizacao: boolean;
}): number {
  const { situacao, status, folga, diasRestantes, temErroSincronizacao } = parametros;

  // Meta encerrada sai do caminho, qualquer que seja o ritmo.
  if (status === "CONCLUIDA") return 900;
  if (status === "CANCELADA") return 950;
  if (status === "PAUSADA") return 800;

  // Sincronização quebrada vem antes de tudo: o número na tela não é
  // confiável, e nenhuma decisão tomada sobre ele vale.
  if (temErroSincronizacao) return 0;

  if (situacao === "PRAZO_VENCIDO") return 10;

  if (situacao === "ATRASADO") {
    // Entre duas atrasadas, a de prazo mais curto primeiro — é onde ainda dá
    // para reagir. Um empate cai no quanto está atrás.
    const dias = diasRestantes ?? 999;
    return 100 + Math.max(0, Math.min(dias, 365)) + (folga !== null ? Math.max(0, 100 + folga) / 1000 : 0);
  }

  if (situacao === "NAO_COMECOU") return 700;
  if (situacao === "CONCLUIDA") return 880;
  if (situacao === "SEM_PRAZO") return 600;

  // No ritmo: ordena por prazo, mas depois de tudo que pede atenção.
  return 500 + Math.max(0, Math.min(diasRestantes ?? 365, 365)) / 1000;
}
