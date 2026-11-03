import { describe, expect, it } from "vitest";

import { LADO_MAIOR_APOS_REDUCAO } from "@/lib/dominio/os/fotos";

import { calcularDimensoes } from "./reduzir-imagem";

/**
 * Só a aritmética das dimensões: o resto de `reduzirImagem` depende de
 * `canvas` e `Image`, que são do navegador. O que pode dar errado em silêncio
 * é a conta — uma proporção invertida deixaria a foto achatada, e ninguém
 * repara numa foto de aparelho levemente esticada.
 */
describe("fotos/reduzir-imagem — dimensões", () => {
  it("reduz pelo lado maior, mantendo a proporção", () => {
    // Foto de celular deitada, 4032×3024 (4:3).
    const resultado = calcularDimensoes(4032, 3024);

    expect(resultado.largura).toBe(LADO_MAIOR_APOS_REDUCAO);
    expect(resultado.altura).toBe(1200);
    expect(resultado.largura / resultado.altura).toBeCloseTo(4032 / 3024, 2);
  });

  it("funciona igual com a foto em pé", () => {
    const resultado = calcularDimensoes(3024, 4032);

    expect(resultado.altura).toBe(LADO_MAIOR_APOS_REDUCAO);
    expect(resultado.largura).toBe(1200);
  });

  it("não amplia imagem menor que o limite", () => {
    // Ampliar não acrescenta detalhe: só aumenta o arquivo e borra.
    expect(calcularDimensoes(800, 600)).toEqual({ largura: 800, altura: 600 });
  });

  it("deixa em paz quem já está exatamente no limite", () => {
    expect(calcularDimensoes(LADO_MAIOR_APOS_REDUCAO, 900)).toEqual({
      largura: LADO_MAIOR_APOS_REDUCAO,
      altura: 900,
    });
  });

  it("nunca devolve dimensão zero numa imagem muito estreita", () => {
    // Print de tela comprido: 4000×10 arredondaria a altura pra 0, e canvas de
    // altura 0 não desenha nada — a foto subiria em branco.
    const resultado = calcularDimensoes(4000, 10);

    expect(resultado.altura).toBeGreaterThanOrEqual(1);
    expect(resultado.largura).toBe(LADO_MAIOR_APOS_REDUCAO);
  });

  it("imagem quadrada continua quadrada", () => {
    const resultado = calcularDimensoes(3000, 3000);

    expect(resultado.largura).toBe(resultado.altura);
    expect(resultado.largura).toBe(LADO_MAIOR_APOS_REDUCAO);
  });
});
