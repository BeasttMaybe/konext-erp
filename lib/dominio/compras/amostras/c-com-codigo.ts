/**
 * Layout com coluna de CÓDIGO antes da quantidade (Cód | Qt | Produto | …) e
 * o fechamento inteiro numa linha só: "MERCADORIAS R$ 258,00 DESCONTO
 * R$ 8,00 FRETE R$ 20,00 VALOR TOTAL R$ 270,00".
 *
 * Revelou dois defeitos de uma vez. A nota era lida com ZERO itens, porque a
 * quantidade era exigida no primeiro campo da linha. E o frete saía
 * R$ 270,00 — o último valor da linha —, porque bastava a palavra "FRETE"
 * aparecer em algum lugar dela.
 */

import type { PalavraPdf } from "../leitura-pdf";

export const LAYOUT_COM_CODIGO_DO_FORNECEDOR: PalavraPdf[] = [
  { texto: "NORTE", x: 21.0, y: 815.9 },
  { texto: "CELL", x: 48.0, y: 815.9 },
  { texto: "COMERCIO", x: 70.5, y: 815.9 },
  { texto: "—", x: 111.0, y: 815.9 },
  { texto: "CNPJ", x: 120.0, y: 815.9 },
  { texto: "55.444.333/0001-22", x: 142.5, y: 815.9 },
  { texto: "—", x: 228.0, y: 815.9 },
  { texto: "NOTA", x: 237.0, y: 815.9 },
  { texto: "12345", x: 259.5, y: 815.9 },
  { texto: "—", x: 286.5, y: 815.9 },
  { texto: "29/10/2026", x: 295.5, y: 815.9 },
  { texto: "Cód", x: 24.7, y: 797.9 },
  { texto: "Qt", x: 97.6, y: 797.9 },
  { texto: "Produto", x: 132.4, y: 797.9 },
  { texto: "Unitário", x: 443.6, y: 797.9 },
  { texto: "Total", x: 549.0, y: 797.9 },
  { texto: "A-1001", x: 24.7, y: 783.6 },
  { texto: "10", x: 97.6, y: 783.6 },
  { texto: "SUPORTE", x: 132.4, y: 783.6 },
  { texto: "VEICULAR", x: 168.5, y: 783.6 },
  { texto: "MAGNETICO", x: 209.0, y: 783.6 },
  { texto: "R$", x: 448.1, y: 783.6 },
  { texto: "8,20", x: 461.6, y: 783.6 },
  { texto: "R$", x: 535.5, y: 783.6 },
  { texto: "82,00", x: 549.0, y: 783.6 },
  { texto: "A-1002", x: 24.7, y: 770.9 },
  { texto: "4", x: 97.6, y: 770.9 },
  { texto: "CARREGADOR", x: 132.4, y: 770.9 },
  { texto: "VEICULAR", x: 182.0, y: 770.9 },
  { texto: "45W", x: 222.5, y: 770.9 },
  { texto: "R$", x: 443.6, y: 770.9 },
  { texto: "19,50", x: 457.1, y: 770.9 },
  { texto: "R$", x: 535.5, y: 770.9 },
  { texto: "78,00", x: 549.0, y: 770.9 },
  { texto: "B-2010", x: 24.7, y: 758.1 },
  { texto: "7", x: 97.6, y: 758.1 },
  { texto: "FONE", x: 132.4, y: 758.1 },
  { texto: "BLUETOOTH", x: 154.9, y: 758.1 },
  { texto: "TWS", x: 200.0, y: 758.1 },
  { texto: "i12", x: 218.0, y: 758.1 },
  { texto: "R$", x: 443.6, y: 758.1 },
  { texto: "14,00", x: 457.1, y: 758.1 },
  { texto: "R$", x: 535.5, y: 758.1 },
  { texto: "98,00", x: 549.0, y: 758.1 },
  { texto: "MERCADORIAS", x: 21.0, y: 740.1 },
  { texto: "R$", x: 75.0, y: 740.1 },
  { texto: "258,00", x: 88.5, y: 740.1 },
  { texto: "DESCONTO", x: 133.5, y: 740.1 },
  { texto: "R$", x: 174.0, y: 740.1 },
  { texto: "8,00", x: 187.5, y: 740.1 },
  { texto: "FRETE", x: 223.5, y: 740.1 },
  { texto: "R$", x: 250.5, y: 740.1 },
  { texto: "20,00", x: 264.0, y: 740.1 },
  { texto: "VALOR", x: 304.5, y: 740.1 },
  { texto: "TOTAL", x: 331.6, y: 740.1 },
  { texto: "R$", x: 358.6, y: 740.1 },
  { texto: "270,00", x: 372.1, y: 740.1 },
];
