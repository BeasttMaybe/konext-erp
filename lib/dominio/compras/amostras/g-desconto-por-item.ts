/**
 * Nota com coluna de DESCONTO entre o unitário e o total
 * ("10,00 | 5,00 | 95,00").
 *
 * Revelou que a regra "o último valor é o total, o anterior é o unitário"
 * fazia o desconto virar o preço de compra: o produto entrava no cadastro
 * custando R$ 5,00 em vez de R$ 10,00 — metade.
 *
 * É também a amostra que mostra o limite honesto do parser. A linha com
 * desconto NÃO fecha a conta (10 × R$ 10,00 = R$ 100,00 contra R$ 95,00
 * declarados), porque o desconto por item não é um campo que a leitura
 * modele. O certo aqui é ler o preço de verdade e MARCAR a linha, que é o
 * que acontece.
 */

import type { PalavraPdf } from "../leitura-pdf";

export const LAYOUT_COM_DESCONTO_POR_ITEM: PalavraPdf[] = [
  { texto: "CENTRAL DE PECAS BRASIL", x: 22.5, y: 812.9 },
  { texto: "Pedido 3301", x: 146.1, y: 812.9 },
  { texto: "03/11/2026", x: 199.3, y: 812.9 },
  { texto: "Qtd", x: 26.2, y: 791.9 },
  { texto: "Produto", x: 70.4, y: 791.9 },
  { texto: "Unitário", x: 390.0, y: 791.9 },
  { texto: "Desconto", x: 475.2, y: 791.9 },
  { texto: "Total", x: 550.9, y: 791.9 },
  { texto: "10", x: 26.2, y: 774.6 },
  { texto: "CAPA SILICONE IPHONE 14", x: 70.4, y: 774.6 },
  { texto: "10,00", x: 400.5, y: 774.6 },
  { texto: "5,00", x: 496.7, y: 774.6 },
  { texto: "95,00", x: 549.4, y: 774.6 },
  { texto: "4", x: 26.2, y: 758.1 },
  { texto: "PELICULA CERAMICA IPHONE 14", x: 70.4, y: 758.1 },
  { texto: "7,50", x: 405.1, y: 758.1 },
  { texto: "0,00", x: 496.7, y: 758.1 },
  { texto: "30,00", x: 549.4, y: 758.1 },
  { texto: "Total dos produtos 125,00", x: 22.5, y: 737.1 },
  { texto: "Frete 15,00", x: 124.3, y: 737.1 },
  { texto: "Total geral 140,00", x: 173.2, y: 737.1 },
];
