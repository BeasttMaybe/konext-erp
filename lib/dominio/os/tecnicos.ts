/**
 * Tecnicos de uma OS — dominio puro (Fase 1D-2), sem Prisma, React ou Next.
 *
 * Uma OS pode ter mais de um tecnico, cada um com uma participacao (%), e
 * exatamente um deles e o principal quando ha pelo menos um. Este modulo e
 * a UNICA fonte de verdade de como essas duas regras se resolvem — a action
 * (app/actions/os.ts) so persiste o que sai daqui, nunca recalcula por
 * conta propria.
 */

const TOLERANCIA_SOMA_PERCENTUAL = 0.01;
const CASAS_DECIMAIS = 2;

export type TecnicoEntrada = {
  usuarioId: string;
  /** Ausente = participacao automatica (divisao igual). Informada = manual, precisa somar 100% entre todos. */
  participacaoPercentual?: number;
  principal?: boolean;
};

export type TecnicoResolvido = {
  usuarioId: string;
  participacaoPercentual: number;
  principal: boolean;
};

export type ResultadoResolucaoTecnicos =
  | { sucesso: true; tecnicos: TecnicoResolvido[] }
  | { sucesso: false; erro: string };

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Divide 100% em `quantidade` partes iguais que somam EXATAMENTE 100 (o
 * resto do arredondamento vai pra ultima parte) — nunca 99.99 ou 100.01 por
 * causa de dizima periodica (ex.: 3 tecnicos -> 33.33/33.33/33.34).
 */
export function dividirIgualmente(quantidade: number): number[] {
  if (quantidade <= 0) {
    return [];
  }

  const base = Math.floor((100 / quantidade) * 10 ** CASAS_DECIMAIS) / 10 ** CASAS_DECIMAIS;
  const partes = new Array<number>(quantidade).fill(base);
  const somaBase = arredondar(base * quantidade);
  const resto = arredondar(100 - somaBase);

  partes[quantidade - 1] = arredondar(partes[quantidade - 1] + resto);

  return partes;
}

/**
 * Resolve a lista de tecnicos desejada pra uma OS: decide as participacoes
 * (automatica ou valida a manual) e garante exatamente um principal.
 *
 * - Se NENHUM tecnico da lista informar `participacaoPercentual`, divide
 *   100% igualmente entre todos.
 * - Se TODOS informarem, valida que a soma bate com 100% (tolerancia de
 *   0.01 ponto percentual, mesma usada no PDV — ver
 *   lib/dominio/pdv/calcular-venda.ts) e usa os valores informados.
 * - Uma mistura (alguns informam, outros nao) e invalida — ou e automatico
 *   pra todos, ou manual pra todos.
 * - Principal: se exatamente um veio marcado, usa esse. Se nenhum veio
 *   marcado (inclusive quando o principal antigo foi removido da lista —
 *   a chamada nao inclui mais ele), o primeiro da lista vira principal
 *   automaticamente. Mais de um marcado e erro.
 * - Lista vazia e valida (remove todos os tecnicos da OS).
 */
export function resolverTecnicos(entrada: readonly TecnicoEntrada[]): ResultadoResolucaoTecnicos {
  if (entrada.length === 0) {
    return { sucesso: true, tecnicos: [] };
  }

  const idsUnicos = new Set(entrada.map((tecnico) => tecnico.usuarioId));
  if (idsUnicos.size !== entrada.length) {
    return { sucesso: false, erro: "Um técnico não pode aparecer mais de uma vez na mesma OS." };
  }

  const quantidadeInformada = entrada.filter((tecnico) => typeof tecnico.participacaoPercentual === "number").length;

  let participacoes: number[];

  if (quantidadeInformada === 0) {
    participacoes = dividirIgualmente(entrada.length);
  } else if (quantidadeInformada === entrada.length) {
    const soma = arredondar(entrada.reduce((total, tecnico) => total + (tecnico.participacaoPercentual ?? 0), 0));

    if (Math.abs(soma - 100) > TOLERANCIA_SOMA_PERCENTUAL) {
      return {
        sucesso: false,
        erro: `A soma das participações precisa ser 100% — está em ${soma.toFixed(CASAS_DECIMAIS)}%.`,
      };
    }

    participacoes = entrada.map((tecnico) => arredondar(tecnico.participacaoPercentual ?? 0));
  } else {
    return {
      sucesso: false,
      erro: "Informe a participação de todos os técnicos, ou de nenhum (divisão automática).",
    };
  }

  const marcadosPrincipal = entrada.filter((tecnico) => tecnico.principal === true);

  if (marcadosPrincipal.length > 1) {
    return { sucesso: false, erro: "Só pode haver um técnico principal na OS." };
  }

  const indicePrincipal =
    marcadosPrincipal.length === 1 ? entrada.findIndex((tecnico) => tecnico.principal === true) : 0;

  const tecnicos: TecnicoResolvido[] = entrada.map((tecnico, indice) => ({
    usuarioId: tecnico.usuarioId,
    participacaoPercentual: participacoes[indice],
    principal: indice === indicePrincipal,
  }));

  return { sucesso: true, tecnicos };
}
