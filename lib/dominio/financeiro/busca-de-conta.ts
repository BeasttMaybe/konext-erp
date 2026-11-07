/**
 * Busca por texto nas listas do financeiro.
 *
 * O dono reportou que a lista "polui muito" com as peças de OS: numa loja que
 * roda dezenas de ordens de serviço por mês, cada uma vira linha no
 * financeiro, e achar o boleto da internet no meio disso é rolar a tela até
 * encontrar. Filtro por período não resolve — o que ele precisa é procurar
 * pelo nome.
 *
 * A normalização é a mesma de `normalizarNome`, reaproveitada de propósito:
 * em loja, o mesmo fornecedor é digitado "Vivo", "VIVO " e "vívo", e uma
 * busca que não normaliza encontra um terço do que deveria.
 *
 * A comparação é PALAVRA POR PALAVRA, com E entre elas. "silva joão" acha
 * "João da Silva", que uma busca por substring não acharia — e é assim que a
 * pessoa digita quando lembra o sobrenome primeiro. Cada palavra casa por
 * pedaço, pra que "intern" ache "internet".
 */

import { normalizarNome } from "@/lib/dominio/texto/chave-de-nome";

/**
 * O termo digitado, pronto pra comparar: palavras normalizadas, sem vazias.
 *
 * Separado de `casaComBusca` porque numa lista de centenas de linhas o termo
 * é o mesmo pra todas — normalizá-lo uma vez por linha seria desperdício
 * dentro de um `filter`.
 */
export function prepararTermoDeBusca(termo: string): string[] {
  return normalizarNome(termo).split(" ").filter((palavra) => palavra.length > 0);
}

/**
 * A linha casa com o termo?
 *
 * Campos nulos são ignorados em vez de virarem "null" — sem isso, buscar por
 * "nul" acharia toda conta sem cliente.
 *
 * Termo vazio casa com tudo: é o estado inicial do campo, e nele a busca não
 * deve esconder nada.
 */
export function casaComBusca(
  palavrasDoTermo: string[],
  campos: ReadonlyArray<string | null | undefined>
): boolean {
  if (palavrasDoTermo.length === 0) return true;

  const alvo = normalizarNome(
    campos.filter((campo): campo is string => typeof campo === "string" && campo !== "").join(" ")
  );

  return palavrasDoTermo.every((palavra) => alvo.includes(palavra));
}
