import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contraste das famílias de feedback é regra de design, e regra sem teste
 * volta — mesma razão do `camadas-z.test.ts` ao lado.
 *
 * Cada família (`sucesso`, `alerta`, `erro`, `info`, `garantia`) é um par
 * fundo+texto, e o par existe justamente para garantir que o texto seja
 * legível sobre aquele fundo nos DOIS temas. Nada no CSS impede alguém de
 * clarear um `-fundo` ou escurecer um `-texto` e derrubar a legibilidade: o
 * resultado continua "funcionando", só fica impossível de ler para quem tem
 * baixa visão — o tipo de regressão que não aparece olhando a tela num
 * monitor bom.
 *
 * A barra é 4.5:1, o mínimo do WCAG 2.1 AA para texto normal (1.4.3). As
 * famílias nasceram bem acima: 6.58–10.16 no escuro e 4.61–6.07 no claro.
 *
 * O teste lê o CSS de verdade, não uma cópia dos valores: uma segunda lista
 * aqui dentro poderia divergir da real sem ninguém perceber, que é
 * exatamente a classe de problema que isto existe para impedir.
 */

const CSS = readFileSync(join(process.cwd(), "app/tokens-konext.css"), "utf8");

/** Mínimo do WCAG 2.1 AA para texto normal (1.4.3 Contrast Minimum). */
const MINIMO_AA = 4.5;

const FAMILIAS = ["sucesso", "alerta", "erro", "info", "garantia"] as const;

/**
 * O arquivo tem um bloco por tema: o escuro é o padrão (`:root`) e vem
 * primeiro, o claro vem depois. Cada família aparece uma vez em cada bloco,
 * então a primeira ocorrência de um token é a do tema escuro e a segunda é a
 * do claro.
 */
function lerTokenPorTema(nome: string): { escuro: string; claro: string } {
  const ocorrencias = [...CSS.matchAll(new RegExp(`--kx-${nome}:\\s*(#[0-9a-fA-F]{6})`, "g"))].map(
    (m) => m[1]
  );

  if (ocorrencias.length < 2) {
    throw new Error(
      `--kx-${nome} precisa existir nos dois temas de app/tokens-konext.css; achei ${ocorrencias.length} ocorrência(s).`
    );
  }

  return { escuro: ocorrencias[0], claro: ocorrencias[1] };
}

/** Luminância relativa, WCAG 2.1 (fórmula de 1.4.3). */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = canais.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function razaoDeContraste(a: string, b: string): number {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (maior + 0.05) / (menor + 0.05);
}

describe("contraste das famílias de feedback", () => {
  it.each(FAMILIAS)("%s: texto sobre o próprio fundo passa de 4.5:1 nos dois temas", (familia) => {
    const fundo = lerTokenPorTema(`${familia}-fundo`);
    const texto = lerTokenPorTema(`${familia}-texto`);

    const escuro = razaoDeContraste(texto.escuro, fundo.escuro);
    const claro = razaoDeContraste(texto.claro, fundo.claro);

    expect(escuro, `--kx-${familia}-texto sobre --kx-${familia}-fundo no tema escuro`).toBeGreaterThanOrEqual(
      MINIMO_AA
    );
    expect(claro, `--kx-${familia}-texto sobre --kx-${familia}-fundo no tema claro`).toBeGreaterThanOrEqual(
      MINIMO_AA
    );
  });

  it("a fórmula bate com valores conhecidos", () => {
    // Âncoras do WCAG: preto sobre branco é 21:1, e cor sobre si mesma é 1:1.
    expect(razaoDeContraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(razaoDeContraste("#5a5fe0", "#5a5fe0")).toBeCloseTo(1, 5);
  });

  it("reprova um par ilegível, para o teste não passar por vacuidade", () => {
    // Se a função sempre devolvesse um número alto, os casos acima passariam
    // sem provar nada. Dois tons de índigo vizinhos têm que reprovar.
    expect(razaoDeContraste("#5a5fe0", "#4548c9")).toBeLessThan(MINIMO_AA);
  });

  it("a família info existe nos dois temas (era azul solto do Tailwind)", () => {
    // O trio de KPI do PDV usava `bg-blue-50 dark:bg-blue-950/30`, azul
    // genérico do Tailwind que não é o azul da marca. Se alguém remover a
    // família, este teste cai junto com a tela.
    const info = lerTokenPorTema("info");
    expect(info.escuro).toBe("#8b91ff");
    expect(info.claro).toBe("#4548c9");
  });
});
