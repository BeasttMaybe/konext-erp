/**
 * Layout sem cabeçalho de tabela nenhum: o timbre, e logo abaixo as linhas
 * de item, alinhadas por posição.
 *
 * Revelou que, sem cabeçalho, a linha anterior ao primeiro item virava
 * "cabeçalho de grupo" — e o nome do fornecedor com a data saía colado na
 * frente de TODO produto: "MEGA PARTS IMPORT — Orçamento 445/26 —
 * 30/10/2026 TELA INCELL IPHONE 11".
 */

import type { PalavraPdf } from "../leitura-pdf";

export const LAYOUT_SEM_CABECALHO_DE_TABELA: PalavraPdf[] = [
  { texto: "MEGA PARTS IMPORT", x: 27.0, y: 808.4 },
  { texto: "— Orçamento 445/26 — 30/10/2026", x: 118.2, y: 808.4 },
  { texto: "2", x: 27.0, y: 788.9 },
  { texto: "TELA INCELL IPHONE 11", x: 57.0, y: 788.9 },
  { texto: "R$ 89,00", x: 479.0, y: 788.9 },
  { texto: "R$ 178,00", x: 534.9, y: 788.9 },
  { texto: "5", x: 27.0, y: 775.4 },
  { texto: "BATERIA IPHONE XR ORIGINAL", x: 57.0, y: 775.4 },
  { texto: "R$ 52,50", x: 479.0, y: 775.4 },
  { texto: "R$ 262,50", x: 534.9, y: 775.4 },
  { texto: "1", x: 27.0, y: 761.9 },
  { texto: "PLACA CARGA SAMSUNG A54", x: 57.0, y: 761.9 },
  { texto: "R$ 34,90", x: 479.0, y: 761.9 },
  { texto: "R$ 34,90", x: 539.0, y: 761.9 },
  { texto: "TOTAL GERAL R$ 475,40", x: 27.0, y: 742.4 },
];
