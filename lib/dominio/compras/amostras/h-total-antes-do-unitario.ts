/**
 * Nota com as colunas de dinheiro INVERTIDAS: "Valor total" antes de
 * "Vl. unitário".
 *
 * Revelou que a posição das colunas não pode decidir sozinha o que é preço
 * de compra: os dois valores saíam trocados, e um cabo de R$ 9,00 entrava
 * no estoque custando R$ 54,00.
 *
 * É o caso que a conta resolve por completo — depois do conserto, a nota
 * inteira fecha.
 */

import type { PalavraPdf } from "../leitura-pdf";

export const LAYOUT_TOTAL_ANTES_DO_UNITARIO: PalavraPdf[] = [
  { texto: "SUPRI MOBILE LTDA", x: 22.5, y: 812.9 },
  { texto: "Orcamento 77", x: 112.6, y: 812.9 },
  { texto: "03/11/2026", x: 171.8, y: 812.9 },
  { texto: "Qtd", x: 26.2, y: 791.9 },
  { texto: "Item", x: 83.1, y: 791.9 },
  { texto: "Valor total", x: 398.9, y: 791.9 },
  { texto: "Vl. unitário", x: 527.4, y: 791.9 },
  { texto: "6", x: 26.2, y: 774.6 },
  { texto: "CABO TIPO C 1,5M", x: 83.1, y: 774.6 },
  { texto: "R$ 54,00", x: 405.3, y: 774.6 },
  { texto: "R$ 9,00", x: 541.1, y: 774.6 },
  { texto: "3", x: 26.2, y: 758.1 },
  { texto: "FONTE 20W BRANCA", x: 83.1, y: 758.1 },
  { texto: "R$ 45,00", x: 405.3, y: 758.1 },
  { texto: "R$ 15,00", x: 536.5, y: 758.1 },
  { texto: "TOTAL GERAL R$ 99,00", x: 22.5, y: 737.1 },
];
