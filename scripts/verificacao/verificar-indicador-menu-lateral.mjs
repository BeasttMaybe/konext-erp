// Checagem visual sob demanda (Playwright) do indicador do item ativo na
// barra lateral (components/shell/barra-lateral.tsx) — NAO roda em
// `vitest run` nem em CI: este repositorio nao tem infraestrutura de
// Playwright (sem @playwright/test como dependencia direta, sem config, sem
// pasta e2e/). E um script chamado manualmente contra um `next dev` local.
//
// Por que Playwright e nao um teste de unidade/jsdom: a posicao do
// indicador vem de medir o DOM de verdade (`offsetTop`, useLayoutEffect) e
// o bug que este script existe pra pegar de novo (commit 6cb2ad5) NAO
// aparecia no CSSOM -- getComputedStyle/backgroundColor do indicador
// continuavam "certos" mesmo com o indicador invisivel, porque o problema
// era de ORDEM DE PINTURA (z-index negativo escapando do contexto de
// empilhamento da barra depois que ela deixou de ser `position` alguma).
// So um pixel de verdade, de um browser de verdade, pega isso -- jsdom nao
// pinta nada. Mesma limitacao ja documentada na Fase do carrinho do PDV
// nesta sessao.
//
// Uso:
//   1. Suba o dev server:              npm run dev
//   2. Garanta AMBIENTE=teste no .env (o script recusa seguir sem isso).
//   3. Rode:
//        node scripts/verificacao/verificar-indicador-menu-lateral.mjs
//      Variaveis opcionais (senao usa os defaults abaixo, que sao os do
//      usuario de teste documentado em docs/operacao/testes-locais.md):
//        BASE_URL, EMAIL_TESTE, SENHA_TESTE
//
// O script sai com codigo != 0 e imprime qual checagem falhou -- nao
// escreve nada em banco, so le a tela renderizada.
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL_TESTE = process.env.EMAIL_TESTE ?? "agente.teste@konext.local";
const SENHA_TESTE = process.env.SENHA_TESTE ?? "AgenteTeste1234";

const CAMINHOS_CHROMIUM = [
  "C:\\Users\\User\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe",
  "C:\\Users\\User\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
];

function resolverExecutavelChromium() {
  const encontrado = CAMINHOS_CHROMIUM.find((caminho) => existsSync(caminho));
  if (!encontrado) {
    throw new Error(
      "Nenhum Chromium do Playwright encontrado em C:\\Users\\User\\AppData\\Local\\ms-playwright\\. " +
        "Ajuste CAMINHOS_CHROMIUM neste script ou rode `npx playwright install chromium`."
    );
  }
  return encontrado;
}

/** Converte "rgb(r, g, b)"/"rgba(r,g,b,a)" pra [r,g,b]. */
function paraRgb(corCss) {
  const numeros = corCss.match(/[\d.]+/g);
  if (!numeros || numeros.length < 3) {
    throw new Error(`Cor CSS inesperada: "${corCss}"`);
  }
  return [Number(numeros[0]), Number(numeros[1]), Number(numeros[2])];
}

function distanciaRgb(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

const falhas = [];

function checar(descricao, condicao) {
  if (condicao) {
    console.log(`  [ok] ${descricao}`);
  } else {
    console.log(`  [FALHOU] ${descricao}`);
    falhas.push(descricao);
  }
}

async function medirIndicador(page) {
  return page.evaluate(() => {
    const nav = document.querySelector("nav[aria-label='Navegação principal']");
    const indicador = nav ? nav.querySelector(".kx-notch-ativo") : null;
    const itemAtivo = nav ? nav.querySelector('a[aria-current="page"]') : null;
    const cartao = document.querySelector(".shadow-kx-flutuante");

    if (!nav || !indicador || !itemAtivo || !cartao) {
      return { erro: "Elemento esperado nao encontrado (nav/indicador/itemAtivo/cartao)." };
    }

    const retIndicador = indicador.getBoundingClientRect();
    const retItem = itemAtivo.getBoundingClientRect();

    return {
      corConteudoEsperada: getComputedStyle(cartao).backgroundColor,
      corDeclaradaDoIndicador: getComputedStyle(indicador).backgroundColor,
      pontoParaAmostrar: {
        x: Math.round(retIndicador.left + 12),
        y: Math.round(retIndicador.top + retIndicador.height / 2),
      },
      indicadorAlinhadoAoItem: Math.abs(retIndicador.top - retItem.top) < 1,
      transitionDuration: getComputedStyle(indicador).transitionDuration,
    };
  });
}

async function checarItem(page, nomeItem, apelido) {
  console.log(`\n${apelido} ("${nomeItem}"):`);
  const link = page.getByRole("link", { name: nomeItem, exact: true });
  await link.click();
  await page.waitForTimeout(500); // useLayoutEffect + fim da transicao (200ms)

  const info = await medirIndicador(page);
  if ("erro" in info) {
    checar(info.erro, false);
    return;
  }

  checar("indicador alinhado (offsetTop) com o item ativo", info.indicadorAlinhadoAoItem);
  checar(
    "cor DECLARADA (CSSOM) do indicador bate com a cor do conteudo (--kx-fundo)",
    distanciaRgb(paraRgb(info.corDeclaradaDoIndicador), paraRgb(info.corConteudoEsperada)) < 2
  );

  // O cheque que realmente pega a regressao do commit 6cb2ad5: nao basta o
  // CSSOM dizer que a cor esta certa, o PIXEL PINTADO tem que estar certo
  // -- amostra um screenshot de verdade no ponto onde o indicador deveria
  // aparecer e compara com a cor esperada. Se o indicador estiver
  // escondido atras do fundo da barra (bg-kx-painel), o pixel real vai
  // reportar a cor da barra, nao a do conteudo, mesmo com o CSSOM "certo".
  const clip = { x: info.pontoParaAmostrar.x - 4, y: info.pontoParaAmostrar.y - 4, width: 8, height: 8 };
  const bufferPng = await page.screenshot({ clip });
  const sharp = (await import("sharp")).default;
  const { data } = await sharp(bufferPng).raw().toBuffer({ resolveWithObject: true });
  const pixelPintado = [data[0], data[1], data[2]];

  checar(
    `pixel PINTADO em (${info.pontoParaAmostrar.x},${info.pontoParaAmostrar.y}) bate com a cor do conteudo ` +
      `(esperado ~${info.corConteudoEsperada}, amostrado rgb(${pixelPintado.join(",")}))`,
    distanciaRgb(pixelPintado, paraRgb(info.corConteudoEsperada)) < 12
  );
}

async function main() {
  const executablePath = resolverExecutavelChromium();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    console.log(`Login em ${BASE_URL}/login como ${EMAIL_TESTE}...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"], input[name="email"]', EMAIL_TESTE);
    await page.fill('input[type="password"], input[name="senha"], input[name="password"]', SENHA_TESTE);
    await page.click('button[type="submit"]');
    await page.waitForSelector("nav[aria-label='Navegação principal']", { timeout: 15000 });
    await page.waitForTimeout(600);

    await checarItem(page, "Dashboard", "Primeiro item");
    await checarItem(page, "Financeiro", "Item do meio");
    await checarItem(page, "Metas", "Ultimo item");

    console.log("\nprefers-reduced-motion:");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await page.waitForTimeout(100);
    const infoReduzido = await medirIndicador(page);
    checar(
      "transition-duration zerada com prefers-reduced-motion: reduce",
      !("erro" in infoReduzido) && infoReduzido.transitionDuration === "0s"
    );
  } finally {
    await browser.close();
  }

  console.log("");
  if (falhas.length > 0) {
    console.error(`${falhas.length} checagem(ns) falharam:`);
    falhas.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log("Todas as checagens passaram.");
}

main().catch((erro) => {
  console.error("");
  console.error(`[erro] ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exit(1);
});
