/**
 * Descrição longa demais pra uma linha, quebrada em duas pelo emissor.
 *
 * É a amostra mais importante das seis, porque revelou o único defeito que
 * a conferência aritmética NÃO pegaria: quantidade e valores saíam certos,
 * e só os nomes vinham trocados. O item de cima perdia o fim do nome e o de
 * baixo ganhava esse fim na frente do seu — "VEDACAO ORIGINAL BATERIA
 * XIAOMI POCO X5 PRO". A conta fechava, a tela não tinha o que marcar, e o
 * nome errado ia direto pro cadastro do produto.
 */

import type { PalavraPdf } from "../leitura-pdf";

export const LAYOUT_DESCRICAO_EM_DUAS_LINHAS: PalavraPdf[] = [
  { texto: "IMPORT PHONE PARTS", x: 22.5, y: 812.9 },
  { texto: "Nota 9033", x: 122.7, y: 812.9 },
  { texto: "02/11/2026", x: 167.7, y: 812.9 },
  { texto: "Qtd", x: 27.0, y: 791.9 },
  { texto: "Descrição", x: 101.6, y: 791.9 },
  { texto: "Unit", x: 401.9, y: 791.9 },
  { texto: "Total", x: 550.1, y: 791.9 },
  { texto: "3", x: 27.0, y: 774.6 },
  { texto: "TELA OLED SAMSUNG GALAXY S21", x: 101.6, y: 774.6 },
  { texto: "ULTRA COM ARO E ADESIVO DE", x: 101.6, y: 765.6 },
  { texto: "VEDACAO ORIGINAL", x: 101.6, y: 756.6 },
  { texto: "R$ 320,00", x: 379.9, y: 774.6 },
  { texto: "R$ 960,00", x: 531.2, y: 774.6 },
  { texto: "5", x: 27.0, y: 739.4 },
  { texto: "BATERIA XIAOMI POCO X5 PRO ALTA", x: 101.6, y: 739.4 },
  { texto: "CAPACIDADE SELO HOLOGRAFICO", x: 101.6, y: 730.4 },
  { texto: "R$ 45,00", x: 384.4, y: 739.4 },
  { texto: "R$ 225,00", x: 531.2, y: 739.4 },
  { texto: "TOTAL GERAL R$ 1.185,00", x: 22.5, y: 708.6 },
];
