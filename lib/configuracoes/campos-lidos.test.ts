import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CAMPOS_LIDOS_DE_CONFIGURACAO, SELECAO_DE_CONFIGURACAO, SELECAO_SO_O_ID } from "./campos-lidos";

const RAIZ = process.cwd();
const ler = (caminho: string) => readFileSync(join(RAIZ, caminho), "utf8");

/** Colunas escalares do `model Configuracao`, lidas do schema de verdade. */
function colunasDoSchema(): string[] {
  const schema = ler("prisma/schema.prisma");
  const bloco = /model Configuracao \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";

  return bloco
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "" && !linha.startsWith("//") && !linha.startsWith("@@"))
    .map((linha) => /^(\w+)\s+\w+/.exec(linha)?.[1])
    .filter((nome): nome is string => Boolean(nome));
}

describe("CAMPOS_LIDOS_DE_CONFIGURACAO", () => {
  const colunas = new Set(colunasDoSchema());
  const lista = new Set<string>(CAMPOS_LIDOS_DE_CONFIGURACAO);

  it("o leitor do schema enxerga o model (senao os testes abaixo passariam vazios)", () => {
    expect(colunas.size).toBeGreaterThan(50);
    expect(colunas.has("nomeFantasia")).toBe(true);
  });

  it("todo nome da lista existe no schema — nome errado derruba a leitura inteira", () => {
    const inexistentes = [...lista].filter((campo) => !colunas.has(campo));

    expect(inexistentes).toEqual([]);
  });

  it("nao tem nome repetido", () => {
    expect(lista.size).toBe(CAMPOS_LIDOS_DE_CONFIGURACAO.length);
  });

  /**
   * O teste que cobre o risco real de uma lista.
   *
   * Campo usado no codigo e ausente da lista nao da erro: vem `undefined` e a
   * tela mostra o valor padrao no lugar do que o dono configurou.
   */
  it("todo campo que app/actions/configuracoes.ts le de uma linha de Configuracao esta na lista", () => {
    const fonte = ler("app/actions/configuracoes.ts");
    const variaveis = ["configuracao", "configuracaoAlvo", "camposOsGarantia", "camposPdv"];

    const lidos = new Set<string>();
    for (const variavel of variaveis) {
      for (const achado of fonte.matchAll(new RegExp(`\\b${variavel}\\??\\.(\\w+)`, "g"))) {
        if (colunas.has(achado[1])) lidos.add(achado[1]);
      }
    }

    expect(lidos.size).toBeGreaterThan(50);
    expect([...lidos].filter((campo) => !lista.has(campo))).toEqual([]);
  });

  it("o select tem exatamente os campos da lista", () => {
    expect(Object.keys(SELECAO_DE_CONFIGURACAO).sort()).toEqual([...lista].sort());
    expect(Object.values(SELECAO_DE_CONFIGURACAO).every((valor) => valor === true)).toBe(true);
    expect(SELECAO_SO_O_ID).toEqual({ id: true });
  });
});

/**
 * GUARDA: nenhuma leitura nem escrita de `Configuracao` sem `select`.
 *
 * Vale para o projeto inteiro, nao so para o arquivo de configuracoes: a
 * queda de 10/11 veio de UMA chamada sem `select` entre trinta que tinham.
 */
describe("toda chamada a Configuracao diz quais colunas quer", () => {
  function arquivosDe(pasta: string): string[] {
    const achados: string[] = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) achados.push(...arquivosDe(caminho));
      else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) achados.push(caminho);
    }
    return achados;
  }

  /** Texto dos argumentos de uma chamada, do `(` ate o `)` que o fecha. */
  function argumentosDaChamada(fonte: string, aposAbreParenteses: number): string {
    let profundidade = 1;
    let posicao = aposAbreParenteses;
    while (posicao < fonte.length && profundidade > 0) {
      if (fonte[posicao] === "(") profundidade += 1;
      else if (fonte[posicao] === ")") profundidade -= 1;
      posicao += 1;
    }
    return fonte.slice(aposAbreParenteses, posicao - 1);
  }

  // `prisma.configuracao.findFirst(`, `configuracaoDelegate.update(`,
  // `tx.configuracao.create(` — mas nao `usuarioConfiguracao`, outro model.
  const CHAMADA = /(?<![A-Za-z])(?:configuracao|Configuracao|configuracaoDelegate)\??\.(findFirst|findUnique|findMany|create|update|upsert)\(/g;

  const chamadas = ["app", "lib"]
    .flatMap((pasta) => arquivosDe(join(RAIZ, pasta)))
    .flatMap((caminho) => {
      const fonte = readFileSync(caminho, "utf8");
      return [...fonte.matchAll(CHAMADA)].map((achado) => ({
        onde: `${caminho.replace(`${RAIZ}/`, "")}:${fonte.slice(0, achado.index).split("\n").length}`,
        metodo: achado[1],
        argumentos: argumentosDaChamada(fonte, (achado.index ?? 0) + achado[0].length),
      }));
    });

  it("o leitor enxerga as chamadas", () => {
    expect(chamadas.length).toBeGreaterThan(20);
    expect(chamadas.some((chamada) => chamada.onde.startsWith("app/actions/configuracoes.ts"))).toBe(true);
  });

  it("nenhuma chamada deixa de passar `select`", () => {
    const semSelect = chamadas
      .filter((chamada) => !/\bselect\s*:/.test(chamada.argumentos))
      .map((chamada) => `${chamada.onde} (${chamada.metodo})`);

    expect(semSelect).toEqual([]);
  });
});
