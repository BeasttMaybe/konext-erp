import { describe, expect, it } from "vitest";

import { abrirConexao, chaveDoCofre, guardarConexao } from "./cofre-de-conexoes";

const chave = chaveDoCofre("uma frase longa o bastante para o cofre 123");
const url = "postgresql://loja:segredo@ep-x.us-east-1.aws.neon.tech/loja_x?sslmode=require";

describe("cofre de conexoes", () => {
  it("guarda e abre; o texto guardado nao contem a senha", () => {
    const guardada = guardarConexao(url, "t1", chave);
    expect(guardada).not.toContain("segredo");
    expect(abrirConexao(guardada, "t1", chave)).toBe(url);
  });
  it("nao abre com outra chave nem para outro tenant", () => {
    const guardada = guardarConexao(url, "t1", chave);
    expect(() => abrirConexao(guardada, "t2", chave)).toThrow();
    expect(() => abrirConexao(guardada, "t1", chaveDoCofre("outra frase longa o bastante para o cofre 456"))).toThrow();
  });
  it("exige frase de 32+ caracteres", () => {
    expect(() => chaveDoCofre(undefined)).toThrow();
    expect(() => chaveDoCofre("curta")).toThrow();
  });
});
