import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/**
 * Guarda: só existe UM jeito de ler dinheiro digitado.
 *
 * O DEFEITO QUE ISTO IMPEDE DE VOLTAR
 *
 * O dono: "se por exemplo eu coloco 8.153,90 o sistema não reconhece, daí
 * tenho que retirar o . pra reconhecer".
 *
 * Ele não estava digitando errado — 8.153,90 é como se escreve dinheiro em
 * português. Erradas estavam as telas: catorze lugares liam o texto com o seu
 * próprio `.replace(",", ".")`, que transforma "8.153,90" em "8.153.90" —
 * que não é número nenhum. Duas cópias (as do PDV) tiravam o ponto antes e
 * funcionavam; as outras não.
 *
 * Pior que recusar: "8.153" sem centavos passava como oito reais e quinze.
 * Mil vezes menos, sem erro nenhum na tela.
 *
 * `lerEntradaMonetaria` já existia em `lib/dinheiro.ts`, com a documentação
 * descrevendo exatamente este caso. O sistema tinha a resposta certa e as
 * telas não a usavam.
 *
 * Este teste procura o padrão de volta em todo o código de tela.
 */

/** Onde um leitor próprio de dinheiro pode reaparecer. */
const PASTAS = ["app", "components"];

/**
 * `.replace(",", ".")` é a assinatura do leitor caseiro: troca a vírgula
 * decimal e deixa o ponto de milhar no lugar, quebrando o valor.
 */
const PADRAO_DO_LEITOR_CASEIRO = String.raw`replace\(["']\,["'], ?["']\.["']\)`;

function procurar(padrao: string): string[] {
  try {
    const saida = execSync(
      `grep -rnE ${JSON.stringify(padrao)} --include=*.ts --include=*.tsx ${PASTAS.join(" ")}`,
      { cwd: process.cwd(), encoding: "utf8" }
    );

    return saida
      .split("\n")
      .filter((linha) => linha.trim() !== "" && !linha.includes(".test."));
  } catch {
    // `grep` sai com código 1 quando não encontra nada — que é o que queremos.
    return [];
  }
}

describe("leitura de dinheiro digitado mora num lugar só", () => {
  it("nenhuma tela lê dinheiro com replace próprio", () => {
    const encontrados = procurar(PADRAO_DO_LEITOR_CASEIRO);

    // A mensagem vai junto porque quem quebrar este teste precisa saber o que
    // usar no lugar, não só que quebrou.
    expect(
      encontrados,
      `Leitor de dinheiro próprio encontrado. Use 'lerEntradaMonetaria' de ` +
        `@/lib/dinheiro, que entende "8.153,90" e "8153.90".\n${encontrados.join("\n")}`
    ).toEqual([]);
  });

  it("o leitor único continua exportado com o nome esperado", () => {
    const dinheiro = readFileSync(join(process.cwd(), "lib/dinheiro.ts"), "utf8");

    expect(dinheiro).toContain("export function lerEntradaMonetaria");
    // O trecho que desfaz o ponto de milhar quando não há vírgula. Sem ele,
    // "8.153" volta a valer oito reais e quinze.
    expect(dinheiro).toMatch(/\^\\d\{1,3\}\(\\\.\\d\{3\}\)\+\$/);
  });
});
