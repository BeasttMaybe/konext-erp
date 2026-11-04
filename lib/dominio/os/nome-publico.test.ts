import { describe, expect, it } from "vitest";

import { primeiroNomePublico } from "./nome-publico";

describe("os/nome-publico", () => {
  it("devolve o primeiro NOME, não a primeira letra", () => {
    // O bug que motivou a função: `.split("")[0]` separa em caracteres, e a
    // página pública de rastreio cumprimentava "João Silva" como "J".
    expect(primeiroNomePublico("João Silva")).toBe("João");
    expect(primeiroNomePublico("Maria Aparecida dos Santos")).toBe("Maria");
  });

  it("aguenta nome colado de outro sistema", () => {
    // Espaço duplo, espaço nas pontas e tabulação: `split(" ")` devolveria
    // string vazia no primeiro pedaço em metade desses casos.
    expect(primeiroNomePublico("  Ana   Paula ")).toBe("Ana");
    expect(primeiroNomePublico("Carlos\tEduardo")).toBe("Carlos");
    expect(primeiroNomePublico("\n Roberto")).toBe("Roberto");
  });

  it("nome de uma palavra só continua inteiro", () => {
    expect(primeiroNomePublico("Madonna")).toBe("Madonna");
  });

  it("sem nome, não mostra vazio na tela do cliente", () => {
    for (const entrada of ["", "   ", null, undefined]) {
      expect(primeiroNomePublico(entrada), String(entrada)).toBe("Cliente");
    }
  });

  it("nunca devolve o nome completo — é o ponto da função", () => {
    // Esta tela é aberta por link, sem login, e pode ser encaminhada.
    expect(primeiroNomePublico("João da Silva Pereira")).not.toContain("Silva");
    expect(primeiroNomePublico("João da Silva Pereira")).not.toContain("Pereira");
  });
});
