// Fotografa telas nos dois temas e mede, no navegador, o contraste de todo
// texto visivel contra o fundo efetivo dele.
// Uso: node fotografar.cjs <pasta-saida> <tema: claro|escuro|ambos> <rota,rota,...>
const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");

const BASE = "http://localhost:3100";
const [saida, temaArg, rotasArg] = process.argv.slice(2);
const ROTAS = rotasArg.split(",");
const TEMAS = temaArg === "ambos" ? ["escuro", "claro"] : [temaArg];
fs.mkdirSync(saida, { recursive: true });

const MEDIR = () => {
  // fundo efetivo: sobe ate achar background nao transparente
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const misturar = (topo, base) => ({
    r: topo.r * topo.a + base.r * (1 - topo.a),
    g: topo.g * topo.a + base.g * (1 - topo.a),
    b: topo.b * topo.a + base.b * (1 - topo.a),
    a: 1,
  });
  const fundoDe = (el) => {
    const camadas = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        camadas.push(c);
        if (c.a >= 1) break;
      }
    }
    let cor = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = camadas.length - 1; i >= 0; i--) cor = misturar(camadas[i], cor);
    return cor;
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const razao = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const ruins = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const texto = t.textContent.trim();
    if (!texto) continue;
    const el = t.parentElement;
    if (!el || vistos.has(el)) continue;
    vistos.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
    const ret = el.getBoundingClientRect();
    if (ret.width === 0 || ret.height === 0) continue;
    if (el.closest("[aria-hidden=true],.sr-only")) continue;
    const cor = parse(cs.color);
    if (!cor) continue;
    // opacidade acumulada
    let op = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity);
    const fundo = fundoDe(el);
    const efetiva = misturar({ ...cor, a: cor.a * op }, fundo);
    const r = razao(efetiva, fundo);
    const tam = parseFloat(cs.fontSize);
    const grande = tam >= 24 || (tam >= 18.66 && parseInt(cs.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    const desabilitado = el.closest("[disabled],[aria-disabled=true]");
    if (r < minimo && !desabilitado) ruins.push({ texto: texto.slice(0, 40), razao: Math.round(r * 100) / 100, cor: cs.color, classe: (el.className || "").toString().slice(0, 90) });
  }
  return ruins;
};

(async () => {
  const navegador = await chromium.launch();
  const resumo = [];
  for (const tema of TEMAS) {
    const contexto = await navegador.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      storageState: path.join(__dirname, "sessao.json"),
    });
    await contexto.addInitScript((t) => {
      try { localStorage.setItem("konext-theme", t); } catch {}
    }, tema === "claro" ? "light" : "dark");
    const pagina = await contexto.newPage();
    for (const rota of ROTAS) {
      await pagina.goto(BASE + rota, { waitUntil: "networkidle", timeout: 30000 });
      await pagina.waitForTimeout(400);
      const nome = `${tema}${rota.replace(/\//g, "_") || "_inicio"}`;
      await pagina.screenshot({ path: path.join(saida, nome + ".png"), fullPage: false });
      const ruins = await pagina.evaluate(MEDIR);
      resumo.push({ tema, rota, ruins });
    }
    await contexto.close();
  }
  await navegador.close();
  for (const { tema, rota, ruins } of resumo) {
    console.log(`\n[${tema}] ${rota}: ${ruins.length} texto(s) abaixo do minimo`);
    for (const r of ruins.slice(0, 8)) console.log(`   ${String(r.razao).padEnd(5)} "${r.texto}"  ${r.classe}`);
  }
  fs.writeFileSync(path.join(saida, "contraste.json"), JSON.stringify(resumo, null, 1));
})();
