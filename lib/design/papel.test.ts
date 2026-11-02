import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PALETA_PAPEL, type NomeCorPapel } from "./papel";

/**
 * A paleta de papel existe duas vezes no projeto, e isso é inevitável: os
 * documentos em HTML leem os tokens `--kx-papel-*` do CSS, e o PDF precisa
 * dos valores em TypeScript porque `@react-pdf/renderer` não resolve
 * variável CSS.
 *
 * Duas cópias do mesmo valor divergem — é só questão de tempo, e o sintoma
 * seria o pior possível: a mesma loja mandando um recibo num cinza e uma
 * proposta em outro, sem ninguém notar. Então o teste lê o CSS DE VERDADE e
 * falha quando os dois deixam de bater.
 */

const CSS = readFileSync(join(process.cwd(), "app/tokens-konext.css"), "utf8");

const TOKEN_DE: Record<NomeCorPapel, string> = {
  papel: "--kx-papel",
  alternado: "--kx-papel-alternado",
  texto: "--kx-papel-texto",
  texto2: "--kx-papel-texto-2",
  legenda: "--kx-papel-legenda",
  borda: "--kx-papel-borda",
  bordaForte: "--kx-papel-borda-forte",
};

function lerToken(nome: string): string {
  // `[^-]` no fim pra `--kx-papel` não casar com `--kx-papel-texto`.
  const achado = CSS.match(new RegExp(`${nome}:\\s*(#[0-9a-fA-F]{6})\\s*;`));

  if (!achado) {
    throw new Error(`Token ${nome} não encontrado em app/tokens-konext.css`);
  }

  return achado[1].toLowerCase();
}

describe("lib/design/papel", () => {
  it.each(Object.keys(TOKEN_DE) as NomeCorPapel[])(
    "%s bate com o token do CSS",
    (chave) => {
      expect(PALETA_PAPEL[chave].toLowerCase()).toBe(lerToken(TOKEN_DE[chave]));
    }
  );

  it("a família papel é declarada UMA vez, fora dos blocos de tema", () => {
    // É o ponto dela: um `--kx-papel-*` que mudasse com o tema imprimiria
    // texto claro em folha branca pra quem usa o sistema no tema escuro. As
    // outras famílias aparecem duas vezes de propósito (tema escuro e claro);
    // esta tem que aparecer uma.
    for (const token of Object.values(TOKEN_DE)) {
      const ocorrencias = [...CSS.matchAll(new RegExp(`${token}:\\s*#`, "g"))];
      expect(ocorrencias.length, `${token} declarado ${ocorrencias.length}x`).toBe(1);
    }
  });

  it("as outras famílias continuam declaradas duas vezes (controle)", () => {
    // Se o teste acima passasse por erro de regex em vez de por acerto, este
    // cairia junto — `--kx-sucesso-fundo` TEM que existir nos dois temas.
    const ocorrencias = [...CSS.matchAll(/--kx-sucesso-fundo:\s*#/g)];
    expect(ocorrencias.length).toBe(2);
  });
});
