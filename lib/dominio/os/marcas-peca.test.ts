import { describe, expect, it } from "vitest";
import {
  TAMANHO_MAXIMO_NOME_MARCA,
  exigeMarcaPeca,
  formatarNomeMarca,
  normalizarNomeMarca,
  validarMarcaDoItem,
  validarNomeMarca,
} from "./marcas-peca";

describe("normalizarNomeMarca", () => {
  it("colapsa as grafias que seriam marcas diferentes no relatório", () => {
    const esperado = "original";

    for (const grafia of ["Original", "original", "ORIGINAL", " Original ", "Originál"]) {
      expect(normalizarNomeMarca(grafia)).toBe(esperado);
    }
  });

  it("colapsa espaço duplicado no meio do nome", () => {
    expect(normalizarNomeMarca("GX  Incell")).toBe("gx incell");
  });

  it("mantém marcas de verdade distintas", () => {
    expect(normalizarNomeMarca("Original")).not.toBe(normalizarNomeMarca("Original Retirada"));
  });
});

describe("formatarNomeMarca", () => {
  it("preserva acento e maiúscula na forma exibida", () => {
    expect(formatarNomeMarca("  Hard  OLED Premium ")).toBe("Hard OLED Premium");
    expect(formatarNomeMarca("Originál")).toBe("Originál");
  });
});

describe("validarNomeMarca", () => {
  it("devolve a forma exibida e a chave normalizada", () => {
    const resultado = validarNomeMarca("  GX  Incell ");

    expect(resultado).toEqual({ valido: true, nome: "GX Incell", nomeNormalizado: "gx incell" });
  });

  it("recusa nome vazio ou só com espaço", () => {
    for (const entrada of ["", "   ", "\t\n"]) {
      expect(validarNomeMarca(entrada)).toEqual({
        valido: false,
        erro: "Informe o nome da marca.",
      });
    }
  });

  it("recusa nome sem nenhuma letra ou dígito", () => {
    const erro = {
      valido: false,
      erro: "Informe um nome de marca com letras ou números.",
    };

    // Pontuação: tem caractere, não tem rótulo nem chave de agrupamento.
    expect(validarNomeMarca("---")).toEqual(erro);
    // Acentos digitados soltos: sobrevivem à normalização, mas não são nome.
    expect(validarNomeMarca("´`^")).toEqual(erro);
    // Acentos combinantes: a normalização remove, sobra string vazia.
    expect(validarNomeMarca("́̂")).toEqual(erro);
  });

  it("aceita marca com dígito e com pontuação junto de letra", () => {
    expect(validarNomeMarca("JK 2.0").valido).toBe(true);
    expect(validarNomeMarca("Soft OLED (A+)").valido).toBe(true);
  });

  it("recusa nome acima do limite", () => {
    const longo = "a".repeat(TAMANHO_MAXIMO_NOME_MARCA + 1);

    expect(validarNomeMarca(longo)).toEqual({
      valido: false,
      erro: `O nome da marca deve ter no máximo ${TAMANHO_MAXIMO_NOME_MARCA} caracteres.`,
    });
  });

  it("aceita nome exatamente no limite", () => {
    const limite = "a".repeat(TAMANHO_MAXIMO_NOME_MARCA);

    expect(validarNomeMarca(limite).valido).toBe(true);
  });
});

describe("exigeMarcaPeca", () => {
  it("dispensa marca só em OUTROS, por onde mão de obra é lançada", () => {
    expect(exigeMarcaPeca("OUTROS")).toBe(false);
  });

  it("exige marca em toda peça de verdade", () => {
    for (const tipo of ["TELA", "BATERIA", "CONECTOR_CARGA", "TAMPA_IPHONE", "TAMPA_ANDROID"] as const) {
      expect(exigeMarcaPeca(tipo)).toBe(true);
    }
  });
});

describe("validarMarcaDoItem", () => {
  it("aceita item OUTROS sem marca", () => {
    expect(validarMarcaDoItem("OUTROS", null)).toEqual({ valido: true });
    expect(validarMarcaDoItem("OUTROS", undefined)).toEqual({ valido: true });
    expect(validarMarcaDoItem("OUTROS", "")).toEqual({ valido: true });
  });

  it("recusa peça sem marca", () => {
    for (const ausente of [null, undefined, "", "   "]) {
      expect(validarMarcaDoItem("TELA", ausente)).toEqual({
        valido: false,
        erro: "Escolha a marca da peça.",
      });
    }
  });

  it("aceita peça com marca", () => {
    expect(validarMarcaDoItem("TELA", "7f1c2a8e-0000-4000-8000-000000000000")).toEqual({
      valido: true,
    });
  });

  it("aceita marca em item OUTROS quando o usuário escolheu uma", () => {
    expect(validarMarcaDoItem("OUTROS", "7f1c2a8e-0000-4000-8000-000000000000")).toEqual({
      valido: true,
    });
  });
});
