/**
 * A unidade da nota traduzida pra unidade do cadastro.
 *
 * O fornecedor escreve o que quiser em `uCom`: "PC", "PÇ", "UND", "MT",
 * "LT", "DZ". O cadastro de produto tem uma lista fixa e curta. Sem tradução,
 * o valor da nota chega num `Select` que não tem essa opção — e um `Select`
 * com valor que não está entre as opções aparece VAZIO, sem erro nenhum, e a
 * pessoa só descobre quando o produto é criado com a unidade errada.
 *
 * O que não dá pra traduzir vira "UN", que é o certo: unidade é a suposição
 * segura, e trocar depois é um clique. Inventar uma opção nova pra cada
 * abreviação de fornecedor transformaria uma lista de oito itens em lixo.
 */

import { ehUnidadeValida, UNIDADE_PADRAO } from "@/lib/dominio/estoque/preco";

/** Como cada abreviação de nota é lida. A chave já vem normalizada. */
const SINONIMOS: Record<string, string> = {
  // Unidade avulsa — de longe a mais comum, e a mais escrita de formas
  // diferentes: peça, unidade, each.
  PC: "UN",
  PCS: "UN",
  PECA: "UN",
  UND: "UN",
  UNID: "UN",
  UNIDADE: "UN",
  EA: "UN",

  CAIXA: "CX",
  CJ: "CX",

  PAC: "PCT",
  PACOTE: "PCT",

  DUZIA: "PAR",

  MT: "M",
  METRO: "M",

  KGS: "KG",
  QUILO: "KG",

  LT: "L",
  LITRO: "L",
};

/**
 * Normaliza a unidade: maiúsculas, sem acento, sem pontuação.
 *
 * "PÇ" e "PC" têm que chegar no mesmo lugar — é a mesma abreviação escrita
 * por dois emissores diferentes.
 */
function normalizar(unidade: string): string {
  return unidade
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

export function unidadeDoCadastro(unidadeDaNota: string | null | undefined): string {
  if (!unidadeDaNota) return UNIDADE_PADRAO;

  const normalizada = normalizar(unidadeDaNota);
  if (normalizada === "") return UNIDADE_PADRAO;

  const traduzida = SINONIMOS[normalizada] ?? normalizada;

  return ehUnidadeValida(traduzida) ? traduzida : UNIDADE_PADRAO;
}
