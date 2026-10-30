import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A escala de z-index é uma regra de design, e regra sem teste volta.
 *
 * O que motivou: `--kx-z-dropdown` valia 40 e `--kx-z-dialogo` valia 60. Radix
 * leva tanto o conteúdo do Select quanto o do Dialog para o `body`, onde eles
 * viram irmãos na mesma pilha — então todo select aberto dentro de todo
 * diálogo do sistema era desenhado ATRÁS da caixa. A lista abria, ficava
 * escondida, e para quem usava parecia que o clique não funcionava.
 *
 * O teste lê os tokens do CSS de verdade, não uma cópia: uma segunda lista de
 * valores aqui dentro poderia divergir da real sem ninguém perceber, que é
 * exatamente a classe de problema que isto existe para impedir.
 */

// Os valores vivem em tokens-konext.css; a exposição ao Tailwind, em
// globals.css. O teste lê os dois de verdade, nunca uma cópia — uma segunda
// lista aqui dentro poderia divergir da real sem ninguém perceber, que é
// exatamente a classe de problema que isto existe para impedir.
const CSS = readFileSync(join(process.cwd(), "app/tokens-konext.css"), "utf8");
const CSS_GLOBAL = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

function lerCamada(nome: string): number {
  const encontrado = CSS.match(new RegExp(`--kx-z-${nome}:\\s*(-?\\d+)`));

  if (!encontrado) {
    throw new Error(`Token --kx-z-${nome} não encontrado em app/tokens-konext.css`);
  }

  return Number(encontrado[1]);
}

describe("escala de z-index", () => {
  const camadas = {
    base: lerCamada("base"),
    sticky: lerCamada("sticky"),
    cabecalho: lerCamada("cabecalho"),
    barraLateral: lerCamada("barra-lateral"),
    drawer: lerCamada("drawer"),
    dialogo: lerCamada("dialogo"),
    dropdown: lerCamada("dropdown"),
    toast: lerCamada("toast"),
  };

  it("coloca a lista suspensa ACIMA do diálogo", () => {
    // A regressão real: select dentro de diálogo desenhando atrás da caixa.
    expect(camadas.dropdown).toBeGreaterThan(camadas.dialogo);
  });

  it("coloca a lista suspensa acima da gaveta", () => {
    expect(camadas.dropdown).toBeGreaterThan(camadas.drawer);
  });

  it("mantém o diálogo acima da gaveta e das barras fixas", () => {
    expect(camadas.dialogo).toBeGreaterThan(camadas.drawer);
    expect(camadas.drawer).toBeGreaterThan(camadas.barraLateral);
    expect(camadas.barraLateral).toBeGreaterThanOrEqual(camadas.cabecalho);
    expect(camadas.cabecalho).toBeGreaterThan(camadas.sticky);
    expect(camadas.sticky).toBeGreaterThan(camadas.base);
  });

  it("mantém o toast acima de tudo, inclusive da lista suspensa", () => {
    // Aviso que não aparece não avisa nada.
    for (const valor of Object.values(camadas)) {
      expect(camadas.toast).toBeGreaterThanOrEqual(valor);
    }
  });

  it("expõe cada camada ao Tailwind, senão a classe z-kx-* não existe", () => {
    // Já aconteceu: as classes z-kx-* estavam no JSX e o @theme não expunha os
    // tokens, então elas não viravam z-index nenhum.
    for (const nome of ["base", "sticky", "cabecalho", "barra-lateral", "drawer", "dialogo", "dropdown", "toast"]) {
      expect(CSS_GLOBAL).toContain(`--z-index-kx-${nome}: var(--kx-z-${nome})`);
    }
  });
});
