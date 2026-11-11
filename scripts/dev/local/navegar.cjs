// Login pelo formulario real e visita a todas as telas, registrando o que
// quebra: tela de erro, resposta 5xx, erro no console do navegador.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = "http://localhost:3100";
const SENHA = process.env.SENHA_DE_TESTE || "";
const ROTAS = (process.argv[2] || "").split(",").filter(Boolean);
const PASTA = process.argv[3] || __dirname;

(async () => {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const pagina = await contexto.newPage();

  const errosDeConsole = [];
  const respostasRuins = [];
  pagina.on("console", (m) => m.type() === "error" && errosDeConsole.push(m.text().slice(0, 200)));
  pagina.on("pageerror", (e) => errosDeConsole.push("pageerror: " + String(e).slice(0, 200)));
  pagina.on("response", (r) => r.status() >= 500 && respostasRuins.push(`${r.status()} ${r.url().replace(BASE, "")}`));

  await pagina.goto(BASE + "/login");
  await pagina.fill('input[name="email"]', "admin@teste.local");
  await pagina.fill('input[name="senha"]', SENHA);
  await Promise.all([pagina.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), pagina.click('button[type="submit"]')]);
  console.log("login ok ->", new URL(pagina.url()).pathname);

  let falhas = 0;
  for (const rota of ROTAS) {
    errosDeConsole.length = 0;
    respostasRuins.length = 0;
    let status = 0;
    try {
      const resposta = await pagina.goto(BASE + rota, { waitUntil: "networkidle", timeout: 30000 });
      status = resposta ? resposta.status() : 0;
    } catch (erro) {
      status = -1;
      errosDeConsole.push("navegacao: " + String(erro).slice(0, 120));
    }
    const texto = await pagina.evaluate(() => document.body.innerText).catch(() => "");
    const telaDeErro = /Algo deu errado|Application error|Internal Server Error/i.test(texto);
    const acessoNegado = /Acesso negado|não tem permissão/i.test(texto);
    const ok = status === 200 && !telaDeErro && respostasRuins.length === 0;
    if (!ok) falhas += 1;
    const obs = [
      telaDeErro ? "TELA DE ERRO" : "",
      acessoNegado ? "acesso negado" : "",
      respostasRuins.length ? "5xx: " + respostasRuins.slice(0, 2).join(" | ") : "",
      errosDeConsole.length ? "console: " + errosDeConsole[0] : "",
    ].filter(Boolean).join("  ·  ");
    console.log(`${ok ? "ok   " : "FALHA"} ${String(status).padEnd(4)} ${rota.padEnd(28)} ${obs}`);
    if (!ok || rota === "/" || rota === "/configuracoes") {
      await pagina.screenshot({ path: path.join(PASTA, "tela" + rota.replace(/\//g, "_") + ".png"), fullPage: true });
    }
  }

  console.log(falhas === 0 ? "\nTODAS AS TELAS ABRIRAM" : `\n${falhas} tela(s) com problema`);
  await contexto.storageState({ path: path.join(PASTA, "sessao.json") });
  await navegador.close();
  process.exit(falhas === 0 ? 0 : 1);
})();
