/**
 * Paleta de PAPEL em TypeScript, para o PDF.
 *
 * Os documentos em HTML (recibo, termo de garantia, OS em A4) usam os tokens
 * `--kx-papel-*` de `app/tokens-konext.css` direto. A proposta em PDF não
 * pode: ela é montada com `@react-pdf/renderer`, que desenha o PDF por conta
 * própria e **não resolve variável CSS** — `var(--kx-papel)` chegaria lá como
 * texto sem significado.
 *
 * Então estes valores são literais por necessidade, não por descuido. E
 * porque valor literal duplicado é valor que vai divergir com o tempo,
 * `papel.test.ts` lê o CSS de verdade e falha se os dois deixarem de bater.
 * É a mesma ideia de `contraste-feedback.test.ts` e `camadas-z.test.ts`: a
 * regra de design vive num lugar só, e o teste garante que continue assim.
 */
export const PALETA_PAPEL = {
  /** Folha. */
  papel: "#ffffff",
  /** Faixa alternada de tabela, cabeçalho de coluna. */
  alternado: "#f4f4f5",
  /** Texto principal. 17.72:1 sobre a folha. */
  texto: "#18181b",
  /** Texto secundário. 7.73:1 sobre a folha. */
  texto2: "#52525b",
  /** Legenda, rótulo pequeno. 4.83:1 sobre a folha. */
  legenda: "#71717a",
  /** Divisor comum. */
  borda: "#d4d4d8",
  /** Divisor de destaque (linha de total, moldura). */
  bordaForte: "#a1a1aa",
} as const;

export type NomeCorPapel = keyof typeof PALETA_PAPEL;
