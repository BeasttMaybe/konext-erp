/**
 * Layout de fornecedor com as colunas na ordem Qtde | Descrição | Unitário |
 * Total, e o fechamento escrito com o rótulo COLADO no valor — "Subtotal:
 * R$ 333,00", "Frete: R$ 41,50", "Total a pagar: R$ 374,50", cada um numa
 * linha, à direita.
 *
 * Foi o que revelou que valor grudado no rótulo não era reconhecido: a nota
 * entrava com os itens certos e FRETE ZERO, e o custo de cada produto saía
 * mais barato do que foi.
 */

import type { PalavraPdf } from "../leitura-pdf";

export const LAYOUT_COLUNAS_SEM_CODIGO: PalavraPdf[] = [
  { texto: "DISTRIBUIDORA SUL ACESSORIOS LTDA", x: 22.5, y: 810.6 },
  { texto: "CNPJ: 11.222.333/0001-44", x: 22.5, y: 792.6 },
  { texto: "Pedido 8891", x: 128.8, y: 792.6 },
  { texto: "28/10/2026", x: 182.0, y: 792.6 },
  { texto: "Qtde", x: 27.0, y: 772.4 },
  { texto: "Descrição", x: 82.5, y: 772.4 },
  { texto: "Vl. Unit", x: 446.8, y: 772.4 },
  { texto: "Vl. Total", x: 537.8, y: 772.4 },
  { texto: "12", x: 27.0, y: 756.6 },
  { texto: "PELICULA HIDROGEL UNIVERSAL", x: 82.5, y: 756.6 },
  { texto: "R$ 2,30", x: 446.3, y: 756.6 },
  { texto: "R$ 27,60", x: 535.8, y: 756.6 },
  { texto: "6", x: 27.0, y: 740.9 },
  { texto: "CABO LIGHTNING 2M REFORCADO", x: 82.5, y: 740.9 },
  { texto: "R$ 11,90", x: 442.3, y: 740.9 },
  { texto: "R$ 71,40", x: 535.8, y: 740.9 },
  { texto: "3", x: 27.0, y: 725.1 },
  { texto: "FONTE 33W GAN DUPLA", x: 82.5, y: 725.1 },
  { texto: "R$ 48,00", x: 441.7, y: 725.1 },
  { texto: "R$ 144,00", x: 531.2, y: 725.1 },
  { texto: "24", x: 27.0, y: 709.4 },
  { texto: "CAPA ANTI IMPACTO TRANSPARENTE", x: 82.5, y: 709.4 },
  { texto: "R$ 3,75", x: 446.3, y: 709.4 },
  { texto: "R$ 90,00", x: 535.8, y: 709.4 },
  { texto: "Subtotal: R$ 333,00", x: 500.8, y: 688.4 },
  { texto: "Frete: R$ 41,50", x: 516.4, y: 679.4 },
  { texto: "Total a pagar: R$ 374,50", x: 483.4, y: 670.4 },
];
