/**
 * Nota de insumo: valores SEM "R$", quantidade fracionária (2,500 kg) e
 * coluna de unidade própria entre a quantidade e a descrição.
 *
 * Revelou que a unidade ia parar no nome do produto ("KG FLUXO DE SOLDA EM
 * PASTA"), que "Mercadorias 302,00" não era reconhecido como subtotal, e que
 * o fornecedor ficava sem nome quando o timbre trazia a data e um número de
 * NF que a lista de marcadores não conhecia.
 */

import type { PalavraPdf } from "../leitura-pdf";

export const LAYOUT_SEM_CIFRAO_COM_UNIDADE: PalavraPdf[] = [
  { texto: "QUIMICA ELETRONICA DO SUL", x: 22.5, y: 812.9 },
  { texto: "| NF 4471 | 01/11/2026", x: 149.3, y: 812.9 },
  { texto: "Qtde", x: 26.2, y: 791.9 },
  { texto: "Un", x: 102.5, y: 791.9 },
  { texto: "Produto", x: 147.7, y: 791.9 },
  { texto: "Preço", x: 470.8, y: 791.9 },
  { texto: "Total", x: 550.9, y: 791.9 },
  { texto: "2,500", x: 26.2, y: 774.6 },
  { texto: "KG", x: 102.5, y: 774.6 },
  { texto: "FLUXO DE SOLDA EM PASTA", x: 147.7, y: 774.6 },
  { texto: "88,00", x: 473.1, y: 774.6 },
  { texto: "220,00", x: 544.8, y: 774.6 },
  { texto: "10,000", x: 26.2, y: 758.1 },
  { texto: "MT", x: 102.5, y: 758.1 },
  { texto: "CABO FLAT 40 VIAS", x: 147.7, y: 758.1 },
  { texto: "4,50", x: 477.7, y: 758.1 },
  { texto: "45,00", x: 549.4, y: 758.1 },
  { texto: "1,000", x: 26.2, y: 741.6 },
  { texto: "LT", x: 102.5, y: 741.6 },
  { texto: "ALCOOL ISOPROPILICO 99%", x: 147.7, y: 741.6 },
  { texto: "37,00", x: 473.1, y: 741.6 },
  { texto: "37,00", x: 549.4, y: 741.6 },
  { texto: "Mercadorias 302,00", x: 22.5, y: 720.6 },
  { texto: "Frete 18,00", x: 102.3, y: 720.6 },
  { texto: "Total da nota 320,00", x: 151.2, y: 720.6 },
];
