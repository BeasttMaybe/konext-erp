import { describe, expect, it } from "vitest";

import { numeroDaMeta, numeroDaMetaOuNulo } from "./valores";

/** Imita um `Prisma.Decimal`: objeto cujo `toString()` da o decimal. */
function decimal(texto: string) {
  return { toString: () => texto };
}

describe("lib/dominio/metas/valores", () => {
  it("le o Decimal do banco pelo texto, sem perder casa", () => {
    expect(numeroDaMeta(decimal("15000.0000"))).toBe(15000);
    expect(numeroDaMeta(decimal("4.5000"))).toBe(4.5);
    expect(numeroDaMeta(decimal("0.0001"))).toBe(0.0001);
    expect(numeroDaMeta(decimal("9999999999.9999"))).toBe(9999999999.9999);
  });

  it("aceita number e string direto", () => {
    expect(numeroDaMeta(80)).toBe(80);
    expect(numeroDaMeta("80.5")).toBe(80.5);
  });

  it("meta sem valor conta como zero, nao como NaN", () => {
    expect(numeroDaMeta(null)).toBe(0);
    expect(numeroDaMeta(undefined)).toBe(0);
    expect(numeroDaMeta("")).toBe(0);
    expect(numeroDaMeta(decimal("nao e numero"))).toBe(0);
    expect(numeroDaMeta({})).toBe(0);
  });

  it("numeroDaMetaOuNulo preserva o null do alvo de uma meta de CHECKLIST", () => {
    expect(numeroDaMetaOuNulo(null)).toBeNull();
    expect(numeroDaMetaOuNulo(undefined)).toBeNull();
    expect(numeroDaMetaOuNulo(decimal("lixo"))).toBeNull();
    // Zero continua sendo zero: alvo zero e diferente de alvo ausente.
    expect(numeroDaMetaOuNulo(decimal("0.0000"))).toBe(0);
  });

  it("nao soma Decimal como string", () => {
    // O engano que gerou o KPI de R$ 1.101.065.160,10 no financeiro:
    // `0 + Decimal` concatena. Convertido, soma.
    const a = numeroDaMeta(decimal("110.0000"));
    const b = numeroDaMeta(decimal("10.0000"));
    expect(a + b).toBe(120);
  });
});
