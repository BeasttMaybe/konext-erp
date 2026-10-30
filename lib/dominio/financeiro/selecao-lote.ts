/**
 * Seleção em lote (Fase 3-2D, Parte 5) — lógica pura, sem Prisma, reusada
 * pelos dois módulos (A receber e A pagar). Duas regras não-negociáveis da
 * especificação vivem aqui: "selecionar todos" pega só o que está
 * FILTRADO na hora (nunca a tabela inteira fora do filtro corrente), e uma
 * entrada já liquidada nunca é selecionável — nem por clique direto, nem
 * pelo "selecionar todos".
 */

import { deDecimal, paraMoeda, somar } from "@/lib/dinheiro";

export interface ItemSelecionavelLote {
  id: string;
  jaLiquidado: boolean;
}

export function alternarSelecaoLinha(
  selecionados: ReadonlySet<string>,
  item: ItemSelecionavelLote
): Set<string> {
  const novo = new Set(selecionados);
  if (item.jaLiquidado) {
    return novo;
  }
  if (novo.has(item.id)) {
    novo.delete(item.id);
  } else {
    novo.add(item.id);
  }
  return novo;
}

/**
 * "Selecionar todos": se todo item selecionável do conjunto FILTRADO já
 * está marcado, desmarca só esse conjunto (deixa qualquer seleção de fora
 * do filtro atual intacta); senão, marca todo o conjunto filtrado.
 */
export function selecionarTodosFiltrados(
  selecionados: ReadonlySet<string>,
  itensFiltrados: readonly ItemSelecionavelLote[]
): Set<string> {
  const selecionaveis = itensFiltrados.filter((item) => !item.jaLiquidado).map((item) => item.id);
  const novo = new Set(selecionados);

  if (selecionaveis.length === 0) {
    return novo;
  }

  const todosJaSelecionados = selecionaveis.every((id) => novo.has(id));

  for (const id of selecionaveis) {
    if (todosJaSelecionados) {
      novo.delete(id);
    } else {
      novo.add(id);
    }
  }

  return novo;
}

export interface ResumoSelecaoLote {
  quantidade: number;
  total: number;
}

/**
 * Conta e soma só os IDs selecionados que ainda existem na lista atual —
 * evita que uma seleção feita antes de trocar o filtro/mês continue
 * contando itens que não estão mais na tela.
 */
export function resumirSelecao<T extends { id: string; valor: number }>(
  selecionados: ReadonlySet<string>,
  itens: readonly T[]
): ResumoSelecaoLote {
  const encontrados = itens.filter((item) => selecionados.has(item.id));

  // `deDecimal`/`somar` em vez da conta a mao que estava aqui. A anterior era
  // `Math.round((item.valor + Number.EPSILON) * 100)`, que com um valor nao
  // numerico produzia NaN em silencio e a tela mostrava "R$ 0,00" com 20 itens
  // selecionados. Agora um valor invalido levanta erro nomeando o valor, em vez
  // de virar zero: total de dinheiro errado em silencio e pior que erro visivel.
  const totalCentavos = encontrados.reduce((acc, item) => somar(acc, deDecimal(item.valor)), 0);

  return { quantidade: encontrados.length, total: paraMoeda(totalCentavos) };
}
