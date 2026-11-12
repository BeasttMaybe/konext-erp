// Testa o leitor da camera de ponta a ponta, com uma "camera falsa" que
// transmite um video (.y4m) de um codigo de barras ou QR gerado pelo sistema.
//
// Uso:
//   node testar-camera.cjs <video.y4m> <pdv|qr> <sessao.json> [saida.png]
//
// pdv: abre o PDV, toca no botao da camera e confere que o produto entrou.
// qr:  toca no leitor de QR da barra de cima e confere que a OS abriu.
const { chromium, devices } = require("playwright");

const [video, modo, sessao, foto] = process.argv.slice(2);
const BASE = "http://localhost:3100";

(async () => {
  const navegador = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${video}`,
    ],
  });
  const contexto = await navegador.newContext({ ...devices["iPhone 14"], storageState: sessao, permissions: ["camera"] });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on("pageerror", (e) => erros.push(String(e).slice(0, 160)));

  let ok = false;
  let detalhe = "";

  if (modo === "pdv") {
    await pagina.goto(`${BASE}/pdv`, { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: "Ler etiqueta com a câmera" }).click();
    const aviso = pagina.locator("[data-sonner-toast]").first();
    await aviso.waitFor({ timeout: 20000 });
    detalhe = (await aviso.innerText()).trim();
    ok = /adicionado/.test(detalhe);
  } else {
    await pagina.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: "Ler QR code da OS" }).click();
    await pagina.waitForURL(/\/os\/[0-9a-f-]{36}$/, { timeout: 20000 });
    detalhe = new URL(pagina.url()).pathname;
    ok = true;
  }

  if (foto) await pagina.screenshot({ path: foto });
  console.log(`${ok ? "ok   " : "FALHA"} [${modo}] ${detalhe}${erros.length ? " | erros: " + erros.join(" ; ") : ""}`);
  await navegador.close();
  process.exit(ok ? 0 : 1);
})().catch((erro) => {
  console.log("FALHA", String(erro).slice(0, 300));
  process.exit(1);
});
