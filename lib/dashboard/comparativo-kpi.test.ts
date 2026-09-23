import { describe, expect, it } from "vitest";
import { montarComparativo } from "./comparativo-kpi";

describe("montarComparativo", () => {
  it("nunca mostra variação quando não há período anterior (anterior nulo)", () => {
    const resultado = montarComparativo(0, null, "cima");

    expect(resultado.variacaoPercentual).toBeNull();
  });

  it("nunca mostra variação quando o período anterior teve zero (sem base pra comparar, não é '-100%')", () => {
    // Regressão: antes de anterior !== 0 na guarda, valor=0/anterior=0 caía
    // no cálculo normal (0-0)/0 = NaN, e valor>0/anterior=0 "caía pra
    // -Infinity%/100%" dependendo de como o NaN/Infinity fosse formatado —
    // o sintoma reportado era literalmente "-100%" aparecendo sem nenhuma
    // venda no período anterior pra servir de base.
    const semDadoAlgum = montarComparativo(0, 0, "cima");
    const comVendaHojeSemAnteriorAlgum = montarComparativo(150, 0, "cima");

    expect(semDadoAlgum.variacaoPercentual).toBeNull();
    expect(comVendaHojeSemAnteriorAlgum.variacaoPercentual).toBeNull();
  });

  it("nunca mostra variação quando o próprio valor atual é nulo (métrica indefinida)", () => {
    const resultado = montarComparativo(null, 100, "cima");

    expect(resultado.variacaoPercentual).toBeNull();
  });

  it("calcula a variação normalmente quando há uma base real e não nula", () => {
    const caiuMetade = montarComparativo(50, 100, "cima");
    const dobrou = montarComparativo(200, 100, "cima");
    const zerouComBaseReal = montarComparativo(0, 100, "cima");

    expect(caiuMetade.variacaoPercentual).toBe(-50);
    expect(dobrou.variacaoPercentual).toBe(100);
    // Isto SIM é um "-100%" legítimo: o período anterior teve receita de
    // verdade (100) e o atual não teve nada — diferente do caso acima, onde
    // o próprio anterior já era 0/inexistente.
    expect(zerouComBaseReal.variacaoPercentual).toBe(-100);
  });

  it("usa o valor absoluto do anterior na base, mesmo que negativo (ex.: saldo)", () => {
    const resultado = montarComparativo(-30, -60, "baixo");

    // (-30 - -60) / abs(-60) * 100 = 30/60*100 = 50
    expect(resultado.variacaoPercentual).toBe(50);
  });

  it("preserva valor, anterior e direcaoBoa inalterados no resultado", () => {
    const resultado = montarComparativo(80, 40, "baixo");

    expect(resultado.valor).toBe(80);
    expect(resultado.anterior).toBe(40);
    expect(resultado.direcaoBoa).toBe("baixo");
  });
});
