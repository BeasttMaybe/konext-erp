import { describe, expect, it } from "vitest";

import { UNIDADES_DE_MEDIDA } from "@/lib/dominio/estoque/preco";

import { unidadeDoCadastro } from "./unidade";

describe("compras/unidade", () => {
  it("o que o fornecedor escreve vira o que o cadastro aceita", () => {
    expect(unidadeDoCadastro("PC")).toBe("UN");
    expect(unidadeDoCadastro("PÇ")).toBe("UN");
    expect(unidadeDoCadastro("UND")).toBe("UN");
    expect(unidadeDoCadastro("MT")).toBe("M");
    expect(unidadeDoCadastro("LT")).toBe("L");
    expect(unidadeDoCadastro("CAIXA")).toBe("CX");
  });

  it("o que já está certo passa direto", () => {
    expect(unidadeDoCadastro("UN")).toBe("UN");
    expect(unidadeDoCadastro("kg")).toBe("KG");
  });

  it("o que não dá pra traduzir vira unidade, nunca um valor inválido", () => {
    // É o ponto do módulo: um Select com valor fora das opções aparece
    // VAZIO, sem erro, e o produto nasce com a unidade errada.
    for (const entrada of ["ROLO", "FD", "???", "", null, undefined, "  "]) {
      const saida = unidadeDoCadastro(entrada);
      expect(
        UNIDADES_DE_MEDIDA.some((unidade) => unidade.valor === saida),
        `${String(entrada)} -> ${saida}`
      ).toBe(true);
    }
  });

  it("todo sinônimo aponta pra uma unidade que existe de verdade", () => {
    // Trava contra renomear uma unidade do cadastro e esquecer da tradução.
    for (const bruta of ["PC", "PCS", "PECA", "UND", "UNID", "UNIDADE", "EA", "CAIXA", "CJ", "PAC", "PACOTE", "DUZIA", "MT", "METRO", "KGS", "QUILO", "LT", "LITRO"]) {
      const saida = unidadeDoCadastro(bruta);
      expect(UNIDADES_DE_MEDIDA.some((u) => u.valor === saida), `${bruta} -> ${saida}`).toBe(true);
    }
  });
});
