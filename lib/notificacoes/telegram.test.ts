import { describe, expect, it } from "vitest";

import { quebrarEmPartes } from "./telegram";

describe("quebra de mensagem do Telegram", () => {
  it("mensagem curta vai inteira, numa parte", () => {
    expect(quebrarEmPartes("oi", 100)).toEqual(["oi"]);
  });

  it("mensagem vazia não gera parte nenhuma", () => {
    // Senão o envio mandaria uma mensagem em branco pro celular do dono.
    expect(quebrarEmPartes("", 100)).toEqual([]);
  });

  it("quebra em linha, nunca no meio de uma", () => {
    // Cortar no meio partiria um aviso em dois: "R$ 1.2" numa mensagem e
    // "90,00" na seguinte é pior que não avisar.
    const partes = quebrarEmPartes("aaaa\nbbbb\ncccc", 10);

    expect(partes).toEqual(["aaaa\nbbbb", "cccc"]);
    for (const parte of partes) {
      expect(parte.length).toBeLessThanOrEqual(10);
    }
  });

  it("nenhuma parte passa do limite", () => {
    const texto = Array.from({ length: 300 }, (_, i) => `linha ${i} de aviso`).join("\n");

    for (const parte of quebrarEmPartes(texto, 4096)) {
      expect(parte.length).toBeLessThanOrEqual(4096);
    }
  });

  it("nenhuma linha é perdida na quebra", () => {
    const linhas = Array.from({ length: 200 }, (_, i) => `aviso numero ${i}`);
    const partes = quebrarEmPartes(linhas.join("\n"), 100);

    expect(partes.join("\n").split("\n")).toEqual(linhas);
  });

  it("linha maior que o limite é cortada em vez de descartada", () => {
    const gigante = "x".repeat(25);
    const partes = quebrarEmPartes(gigante, 10);

    expect(partes).toEqual(["xxxxxxxxxx", "xxxxxxxxxx", "xxxxx"]);
    expect(partes.join("")).toBe(gigante);
  });

  it("texto exatamente no limite não é quebrado", () => {
    expect(quebrarEmPartes("x".repeat(10), 10)).toHaveLength(1);
    expect(quebrarEmPartes("x".repeat(11), 10)).toHaveLength(2);
  });
});
