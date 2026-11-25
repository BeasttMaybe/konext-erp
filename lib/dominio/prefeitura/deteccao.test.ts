import { describe, expect, it } from "vitest";

import { ehNomeDePrefeitura } from "./deteccao";

describe("ehNomeDePrefeitura", () => {
  it("reconhece os nomes de prefeitura e município, com ou sem acento", () => {
    for (const nome of [
      "PREFEITURA MUNICIPAL DE ITAPETININGA",
      "Prefeitura de Sorocaba",
      "MUNICIPIO DE ITAPETININGA",
      "Município de São Paulo",
      "FUNDO MUNICIPAL DE SAUDE DE X",
      "camara municipal de boituva",
    ]) {
      expect(ehNomeDePrefeitura(nome), nome).toBe(true);
    }
  });

  it("não marca empresas comuns", () => {
    for (const nome of ["Konext Tech", "João da Silva ME", "Comercial Pref Ltda", "Municard Soluções"]) {
      expect(ehNomeDePrefeitura(nome), nome).toBe(false);
    }
  });

  it("é seguro com vazio/nulo", () => {
    expect(ehNomeDePrefeitura(null)).toBe(false);
    expect(ehNomeDePrefeitura(undefined)).toBe(false);
    expect(ehNomeDePrefeitura("")).toBe(false);
    expect(ehNomeDePrefeitura("   ")).toBe(false);
  });
});
