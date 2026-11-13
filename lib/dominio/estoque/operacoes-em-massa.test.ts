import { describe, expect, it } from "vitest";

import { arredondar, calcularNovoPreco, copiasDoProduto, lerRegraDePreco, normalizarIds } from "./operacoes-em-massa";

describe("lerRegraDePreco", () => {
  it("le valor em reais com virgula", () => {
    expect(lerRegraDePreco({ modo: "DEFINIR", valor: "1.234,50" })).toEqual({
      ok: true,
      regra: { modo: "DEFINIR", valorCentavos: 123450 },
      arredondamento: "NENHUM",
    });
  });
  it("recusa limites", () => {
    expect(lerRegraDePreco({ modo: "DEFINIR", valor: "0" }).ok).toBe(false);
    expect(lerRegraDePreco({ modo: "PERCENTUAL", valor: "0" }).ok).toBe(false);
    expect(lerRegraDePreco({ modo: "PERCENTUAL", valor: "-90" }).ok).toBe(false);
    expect(lerRegraDePreco({ modo: "PERCENTUAL", valor: "abc" }).ok).toBe(false);
    expect(lerRegraDePreco({ modo: "OUTRO", valor: "10" }).ok).toBe(false);
  });
});

describe("arredondar", () => {
  it("para ,90 sempre para cima", () => {
    expect(arredondar(3712, "NOVENTA")).toBe(3790);
    expect(arredondar(3790, "NOVENTA")).toBe(3790);
    expect(arredondar(3795, "NOVENTA")).toBe(3890);
    expect(arredondar(3701, "INTEIRO")).toBe(3800);
    expect(arredondar(3700, "INTEIRO")).toBe(3700);
    expect(arredondar(3701, "NENHUM")).toBe(3701);
  });
});

describe("calcularNovoPreco", () => {
  it("percentual sobre o preco atual", () => {
    expect(calcularNovoPreco(10000, null, { modo: "PERCENTUAL", percentual: 10 }, "NENHUM")).toEqual({ ok: true, novoCentavos: 11000 });
    expect(calcularNovoPreco(3333, null, { modo: "PERCENTUAL", percentual: -10 }, "NENHUM")).toEqual({ ok: true, novoCentavos: 3000 });
  });
  it("margem sobre o custo", () => {
    expect(calcularNovoPreco(1, 2000, { modo: "MARGEM_SOBRE_CUSTO", percentual: 100 }, "NOVENTA")).toEqual({ ok: true, novoCentavos: 4090 });
    expect(calcularNovoPreco(1, 0, { modo: "MARGEM_SOBRE_CUSTO", percentual: 100 }, "NENHUM").ok).toBe(false);
    expect(calcularNovoPreco(1, null, { modo: "MARGEM_SOBRE_CUSTO", percentual: 100 }, "NENHUM").ok).toBe(false);
  });
  it("definir", () => {
    expect(calcularNovoPreco(1, null, { modo: "DEFINIR", valorCentavos: 4990 }, "NENHUM")).toEqual({ ok: true, novoCentavos: 4990 });
  });
});

describe("ids e copias", () => {
  it("normaliza", () => {
    expect(normalizarIds(["a", "a", " b ", ""])).toEqual({ ok: true, ids: ["a", "b"] });
    expect(normalizarIds([]).ok).toBe(false);
    expect(normalizarIds(["a", "b", "c"], 2).ok).toBe(false);
  });
  it("copias", () => {
    expect(copiasDoProduto("UMA", 9, 9)).toBe(1);
    expect(copiasDoProduto("FIXO", 3, 0)).toBe(3);
    expect(copiasDoProduto("SALDO", 1, 0)).toBe(1);
    expect(copiasDoProduto("SALDO", 1, 7)).toBe(7);
  });
});
