/**
 * Nota de DUAS páginas, com a tabela recomeçando na segunda — e, com ela, a
 * linha de cabeçalho "Qtd | Descrição | Unitário | Total".
 *
 * Revelou que o cabeçalho REPETIDO virava nome de grupo: os dois produtos da
 * página 2 saíam como "Qtd Descrição Unitário Total COLA B7000 50ML".
 */

import type { PalavraPdf } from "../leitura-pdf";

export const LAYOUT_DUAS_PAGINAS: PalavraPdf[] = [
  { texto: "ATACADO TECH PECAS", x: 22.5, y: 812.9 },
  { texto: "Pedido 7120", x: 124.9, y: 812.9 },
  { texto: "31/10/2026", x: 178.1, y: 812.9 },
  { texto: "Qtd", x: 27.0, y: 791.9 },
  { texto: "Descrição", x: 77.8, y: 791.9 },
  { texto: "Unitário", x: 445.0, y: 791.9 },
  { texto: "Total", x: 550.1, y: 791.9 },
  { texto: "8", x: 27.0, y: 774.6 },
  { texto: "CONECTOR DE CARGA MOTO G54", x: 77.8, y: 774.6 },
  { texto: "R$ 9,00", x: 447.3, y: 774.6 },
  { texto: "R$ 72,00", x: 535.8, y: 774.6 },
  { texto: "4", x: 27.0, y: 757.4 },
  { texto: "ALTO FALANTE XIAOMI REDMI 12", x: 77.8, y: 757.4 },
  { texto: "R$ 7,50", x: 447.3, y: 757.4 },
  { texto: "R$ 30,00", x: 535.8, y: 757.4 },
  { texto: "15", x: 27.0, y: 740.1 },
  { texto: "PARAFUSO PENTALOBE KIT 50UN", x: 77.8, y: 740.1 },
  { texto: "R$ 2,00", x: 447.3, y: 740.1 },
  { texto: "R$ 30,00", x: 535.8, y: 740.1 },
  { texto: "Qtd", x: 27.0, y: -99168.4 },
  { texto: "Descrição", x: 79.8, y: -99168.4 },
  { texto: "Unitário", x: 431.1, y: -99168.4 },
  { texto: "Total", x: 550.1, y: -99168.4 },
  { texto: "6", x: 27.0, y: -99185.6 },
  { texto: "COLA B7000 50ML", x: 79.8, y: -99185.6 },
  { texto: "R$ 12,00", x: 428.7, y: -99185.6 },
  { texto: "R$ 72,00", x: 535.8, y: -99185.6 },
  { texto: "2", x: 27.0, y: -99202.9 },
  { texto: "ESTACAO DE SOLDA DIGITAL", x: 79.8, y: -99202.9 },
  { texto: "R$ 180,00", x: 424.2, y: -99202.9 },
  { texto: "R$ 360,00", x: 531.2, y: -99202.9 },
  { texto: "SUBTOTAL R$ 564,00", x: 490.9, y: -99224.6 },
  { texto: "FRETE R$ 36,00", x: 510.9, y: -99233.6 },
  { texto: "TOTAL GERAL R$ 600,00", x: 477.9, y: -99242.6 },
];
