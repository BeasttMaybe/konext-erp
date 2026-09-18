import { describe, expect, it } from "vitest";

import { dividirIgualmente, resolverTecnicos, type TecnicoEntrada } from "./tecnicos";

describe("dividirIgualmente", () => {
  it("1 tecnico leva 100%", () => {
    expect(dividirIgualmente(1)).toEqual([100]);
  });

  it("2 tecnicos: 50/50", () => {
    expect(dividirIgualmente(2)).toEqual([50, 50]);
  });

  it("3 tecnicos: dizima periodica cai toda na ultima parte, soma exata 100", () => {
    const partes = dividirIgualmente(3);
    expect(partes).toEqual([33.33, 33.33, 33.34]);
    expect(partes.reduce((total, parte) => total + parte, 0)).toBeCloseTo(100, 2);
  });

  it("7 tecnicos: soma sempre exatamente 100, nunca 99.99 ou 100.01", () => {
    const partes = dividirIgualmente(7);
    const soma = partes.reduce((total, parte) => total + parte, 0);
    expect(Math.round(soma * 100) / 100).toBe(100);
  });

  it("0 tecnicos: lista vazia", () => {
    expect(dividirIgualmente(0)).toEqual([]);
  });
});

describe("resolverTecnicos — participacao automatica (divisao igual)", () => {
  it("um tecnico sem participacao informada recebe 100%, vira principal", () => {
    const resultado = resolverTecnicos([{ usuarioId: "u1" }]);
    expect(resultado.sucesso).toBe(true);
    if (resultado.sucesso) {
      expect(resultado.tecnicos).toEqual([{ usuarioId: "u1", participacaoPercentual: 100, principal: true }]);
    }
  });

  it("tres tecnicos sem participacao informada dividem 100% igualmente", () => {
    const resultado = resolverTecnicos([{ usuarioId: "u1" }, { usuarioId: "u2" }, { usuarioId: "u3" }]);
    expect(resultado.sucesso).toBe(true);
    if (resultado.sucesso) {
      const soma = resultado.tecnicos.reduce((total, t) => total + t.participacaoPercentual, 0);
      expect(Math.round(soma * 100) / 100).toBe(100);
    }
  });

  it("lista vazia remove todos os tecnicos, sem erro", () => {
    const resultado = resolverTecnicos([]);
    expect(resultado).toEqual({ sucesso: true, tecnicos: [] });
  });
});

describe("resolverTecnicos — participacao manual", () => {
  it("aceita participacoes manuais que somam exatamente 100%", () => {
    const entrada: TecnicoEntrada[] = [
      { usuarioId: "u1", participacaoPercentual: 60 },
      { usuarioId: "u2", participacaoPercentual: 40 },
    ];
    const resultado = resolverTecnicos(entrada);
    expect(resultado.sucesso).toBe(true);
    if (resultado.sucesso) {
      expect(resultado.tecnicos.map((t) => t.participacaoPercentual)).toEqual([60, 40]);
    }
  });

  it("aceita dentro da tolerancia de arredondamento (soma 99.995~100.005)", () => {
    const entrada: TecnicoEntrada[] = [
      { usuarioId: "u1", participacaoPercentual: 33.33 },
      { usuarioId: "u2", participacaoPercentual: 33.33 },
      { usuarioId: "u3", participacaoPercentual: 33.34 },
    ];
    expect(resolverTecnicos(entrada).sucesso).toBe(true);
  });

  it("rejeita participacoes manuais que NAO somam 100%, citando a soma real", () => {
    const entrada: TecnicoEntrada[] = [
      { usuarioId: "u1", participacaoPercentual: 60 },
      { usuarioId: "u2", participacaoPercentual: 30 },
    ];
    const resultado = resolverTecnicos(entrada);
    expect(resultado.sucesso).toBe(false);
    if (!resultado.sucesso) {
      expect(resultado.erro).toContain("90");
    }
  });

  it("rejeita mistura de informado/nao informado", () => {
    const entrada: TecnicoEntrada[] = [
      { usuarioId: "u1", participacaoPercentual: 60 },
      { usuarioId: "u2" },
    ];
    const resultado = resolverTecnicos(entrada);
    expect(resultado.sucesso).toBe(false);
  });
});

describe("resolverTecnicos — tecnico duplicado", () => {
  it("rejeita o mesmo usuarioId duas vezes", () => {
    const resultado = resolverTecnicos([{ usuarioId: "u1" }, { usuarioId: "u1" }]);
    expect(resultado.sucesso).toBe(false);
  });
});

describe("resolverTecnicos — exatamente um principal", () => {
  it("nenhum marcado: o primeiro da lista vira principal", () => {
    const resultado = resolverTecnicos([{ usuarioId: "u1" }, { usuarioId: "u2" }]);
    expect(resultado.sucesso).toBe(true);
    if (resultado.sucesso) {
      expect(resultado.tecnicos[0].principal).toBe(true);
      expect(resultado.tecnicos[1].principal).toBe(false);
    }
  });

  it("um marcado explicitamente: respeita a escolha, mesmo nao sendo o primeiro", () => {
    const resultado = resolverTecnicos([
      { usuarioId: "u1" },
      { usuarioId: "u2", principal: true },
    ]);
    expect(resultado.sucesso).toBe(true);
    if (resultado.sucesso) {
      expect(resultado.tecnicos[0].principal).toBe(false);
      expect(resultado.tecnicos[1].principal).toBe(true);
    }
  });

  it("dois marcados: erro", () => {
    const resultado = resolverTecnicos([
      { usuarioId: "u1", principal: true },
      { usuarioId: "u2", principal: true },
    ]);
    expect(resultado.sucesso).toBe(false);
  });

  it("remover o principal da lista (ele nao aparece mais) promove o primeiro remanescente automaticamente", () => {
    // Simula: OS tinha u1 (principal) e u2. u1 foi removido — a chamada so
    // manda o que resta, sem ninguem marcado principal (o antigo se foi).
    const resultado = resolverTecnicos([{ usuarioId: "u2" }, { usuarioId: "u3" }]);
    expect(resultado.sucesso).toBe(true);
    if (resultado.sucesso) {
      expect(resultado.tecnicos.find((t) => t.usuarioId === "u2")?.principal).toBe(true);
    }
  });

  it("exatamente um tecnico e sempre principal, mesmo sem marcar", () => {
    const resultado = resolverTecnicos([{ usuarioId: "u1" }]);
    expect(resultado.sucesso).toBe(true);
    if (resultado.sucesso) {
      expect(resultado.tecnicos[0].principal).toBe(true);
    }
  });
});
