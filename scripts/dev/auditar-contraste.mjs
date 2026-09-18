// node scripts/dev/auditar-contraste.mjs '[["rotulo","#corTexto","#corFundo"], ...]'
//
// Calcula o contraste WCAG (formula de luminancia relativa, sRGB) de cada
// par texto/fundo informado. "AA" e o limiar de texto normal (>=4.5:1);
// "AA-large" e o limiar de texto grande/componente nao-textual (>=3:1,
// WCAG 1.4.11). Sem dependencia nenhuma — so matematica pura, pra poder
// rodar contra qualquer par de cores hex ao ajustar um token em
// app/tokens-konext.css. Usado pra montar a auditoria de contraste da
// Fase 3-1 (ver docs/design/sistema-visual.md).
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function linearize(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

const pairs = JSON.parse(process.argv[2]);
for (const [label, fg, bg] of pairs) {
  const ratio = contrast(fg, bg);
  const passAA = ratio >= 4.5;
  const passAALarge = ratio >= 3;
  console.log(`${ratio.toFixed(2).padStart(6)}  AA:${passAA ? "OK" : "FALHA"}  AA-large:${passAALarge ? "OK" : "FALHA"}  ${label} (${fg} on ${bg})`);
}
