/**
 * As cores que o sistema declara FORA do CSS: no manifesto do app
 * instalavel (app/manifest.ts) e nas metatags do iPhone (app/layout.tsx).
 *
 * Ali nao existe `var(--kx-...)` — o navegador e o iOS leem o valor literal
 * antes de qualquer CSS carregar. Por isso, e so por isso, os hex moram
 * aqui. Sao copias de tokens de app/tokens-konext.css, e
 * cores-do-app.test.ts falha se divergirem: trocar o tema sem trocar aqui
 * faria o app abrir com um fundo e mudar para outro um instante depois.
 */
/* eslint-disable konext/sem-hex-hardcoded -- valores literais exigidos pelo manifesto; guardados por teste contra os tokens */
export const CORES_DO_APP = {
  /** `--kx-fundo` do tema escuro: o fundo entre tocar no icone e a primeira tela. */
  fundoEscuro: "#0c1424",
  /** `--kx-fundo` do tema claro. */
  fundoClaro: "#e4e9f1",
} as const;
/* eslint-enable konext/sem-hex-hardcoded */
