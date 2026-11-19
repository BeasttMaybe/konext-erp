import { describe, expect, it } from "vitest";

import { extrairSinaisSeo, problemasDeSeo } from "./sinais";

const HTML = `<!doctype html><html lang="pt-BR"><head>
<title>Konext Tech — Assistência de Celulares em Itapetininga</title>
<meta name="description" content="Conserto de celulares com garantia em Itapetininga: troca de tela, bateria, conectores e venda de acessórios.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://konexttech.com.br/">
<meta property="og:title" content="Konext Tech">
<script type="application/ld+json">{"@type":"LocalBusiness","name":"Konext"}</script>
</head><body>
<h1>Assistência técnica de celulares</h1>
<img src="a.jpg" alt="frente da loja"><img src="b.jpg">
<p>${"palavra ".repeat(80)}</p>
</body></html>`;

describe("extrairSinaisSeo", () => {
  const s = extrairSinaisSeo(HTML, "https://konexttech.com.br/");

  it("lê título, descrição, lang e viewport", () => {
    expect(s.titulo).toContain("Konext Tech");
    expect(s.tituloLen).toBeGreaterThan(15);
    expect(s.descricao).toContain("garantia");
    expect(s.viewport).toBe(true);
    expect(s.canonical).toBe(true);
    expect(s.lang).toBe("pt-BR");
    expect(s.https).toBe(true);
  });

  it("conta H1, imagens sem alt, schema e open graph", () => {
    expect(s.h1).toEqual(["Assistência técnica de celulares"]);
    expect(s.qtdImagens).toBe(2);
    expect(s.imagensSemAlt).toBe(1);
    expect(s.temSchema).toBe(true);
    expect(s.tiposSchema).toContain("LocalBusiness");
    expect(s.qtdOpenGraph).toBe(1);
    expect(s.palavras).toBeGreaterThan(60);
    expect(s.pareceSpa).toBe(false);
  });

  it("aponta o problema das imagens sem alt, sem reclamar do título", () => {
    const p = problemasDeSeo(s);
    expect(p.some((x) => x.includes("alt"))).toBe(true);
    expect(p.some((x) => x.includes("<title>"))).toBe(false);
  });

  it("detecta app JS (pouco texto + script)", () => {
    const spa = extrairSinaisSeo(`<html><head><title>App</title></head><body><div id="root"></div><script src="app.js"></script></body></html>`, "https://x.com");
    expect(spa.pareceSpa).toBe(true);
  });
});
