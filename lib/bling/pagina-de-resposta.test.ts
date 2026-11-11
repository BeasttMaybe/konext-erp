import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { escaparHtml } from "@/lib/html/escapar";
import { CSP_DA_PAGINA_DE_RESPOSTA, montarHtmlDeResposta } from "./pagina-de-resposta";

describe("escaparHtml", () => {
  it("neutraliza os cinco caracteres que abrem tag, entidade ou atributo", () => {
    expect(escaparHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
    );
  });

  it("escapa o & primeiro, senao as entidades geradas seriam escapadas de novo", () => {
    expect(escaparHtml("<")).toBe("&lt;");
    expect(escaparHtml("&lt;")).toBe("&amp;lt;");
  });

  it("aceita qualquer coisa sem lancar", () => {
    expect(escaparHtml(null)).toBe("");
    expect(escaparHtml(undefined)).toBe("");
    expect(escaparHtml(42)).toBe("42");
  });
});

describe("montarHtmlDeResposta", () => {
  // Exatamente o que chegava pelo parametro `error` da URL.
  const ATAQUE = `<script>fetch("/x")</script><img src=x onerror=alert(1)>`;

  it("o parametro `error` da URL nao vira marcacao", () => {
    const html = montarHtmlDeResposta(
      "Autorização não concluída",
      `O Bling não autorizou a conexão: ${ATAQUE}. Nada foi alterado.`,
      false
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("o titulo tambem e escapado — ele aparece no <title> e no <h1>", () => {
    const html = montarHtmlDeResposta(ATAQUE, "x", false);

    expect(html).not.toContain("<script>");
    expect(html.match(/&lt;script&gt;/g)?.length).toBe(2);
  });

  it("corta um detalhe absurdo, que nenhum retorno legitimo do Bling tem", () => {
    const html = montarHtmlDeResposta("t", "a".repeat(5000), false);

    expect(html).not.toContain("a".repeat(301));
    expect(html).toContain("a".repeat(300));
  });

  it("texto normal passa intacto, com acento", () => {
    const html = montarHtmlDeResposta("Bling conectado", "As notas vão aparecer no Konext.", true);

    expect(html).toContain("<h1>Bling conectado</h1>");
    expect(html).toContain("<p>As notas vão aparecer no Konext.</p>");
  });

  it("a politica de conteudo proibe script de qualquer origem", () => {
    expect(CSP_DA_PAGINA_DE_RESPOSTA).toContain("default-src 'none'");
    expect(CSP_DA_PAGINA_DE_RESPOSTA).not.toContain("script-src");
  });
});

/**
 * GUARDA: o Route Handler nao volta a montar HTML por conta propria.
 */
describe("rota de callback do Bling", () => {
  const fonte = readFileSync(
    join(process.cwd(), "app/api/integracoes/bling/callback/route.ts"),
    "utf8"
  );

  it("monta a pagina pela funcao que escapa", () => {
    expect(fonte).toContain("montarHtmlDeResposta(");
    expect(fonte).not.toContain("<!doctype html>");
  });

  it("envia a politica de conteudo junto", () => {
    expect(fonte).toContain("CSP_DA_PAGINA_DE_RESPOSTA");
  });
});
