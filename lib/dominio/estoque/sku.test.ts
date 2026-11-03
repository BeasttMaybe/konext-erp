import { describe, expect, it } from "vitest";

import {
  formatarSku,
  lerSequencialDoSku,
  montarSku,
  prefixoDaCategoria,
  proximoSku,
  validarSku,
} from "./sku";

describe("estoque/sku — prefixo vem da categoria", () => {
  it("usa as três primeiras letras, sem acento, em maiúsculas", () => {
    expect(prefixoDaCategoria("Capas")).toBe("CAP");
    expect(prefixoDaCategoria("Peça de reparo")).toBe("PEC");
    expect(prefixoDaCategoria("Equipamento de rede")).toBe("EQU");
    expect(prefixoDaCategoria("Acessório")).toBe("ACE");
  });

  it("ignora dígitos, espaços e símbolos", () => {
    // O prefixo é lido e digitado por gente: dígito nele deixaria o separador
    // do sequencial ambíguo.
    expect(prefixoDaCategoria("3G modem")).toBe("GMO");
    expect(prefixoDaCategoria("  fones   bluetooth ")).toBe("FON");
  });

  it("completa quando a categoria tem menos de três letras", () => {
    expect(prefixoDaCategoria("TV")).toBe("TVX");
    expect(prefixoDaCategoria("a")).toBe("AXX");
  });

  it("cai num prefixo reserva quando não há letra nenhuma", () => {
    expect(prefixoDaCategoria("123")).toBe("PRO");
    expect(prefixoDaCategoria("---")).toBe("PRO");
  });
});

describe("estoque/sku — formato", () => {
  it("monta com quatro dígitos", () => {
    expect(montarSku("CAP", 12)).toBe("CAP-0012");
    expect(montarSku("CAP", 1)).toBe("CAP-0001");
  });

  it("não trunca quando o sequencial passa de quatro dígitos", () => {
    // Perder o dígito transformaria o décimo-milésimo produto num SKU repetido.
    expect(montarSku("CAP", 10000)).toBe("CAP-10000");
  });

  it("lê o sequencial de volta, ignorando maiúsculas", () => {
    expect(lerSequencialDoSku("CAP-0012", "CAP")).toBe(12);
    expect(lerSequencialDoSku("cap-0012", "CAP")).toBe(12);
  });

  it("devolve null pra SKU fora do padrão ou de outro prefixo", () => {
    expect(lerSequencialDoSku("MEU-CODIGO-ANTIGO", "CAP")).toBeNull();
    expect(lerSequencialDoSku("PEC-0012", "CAP")).toBeNull();
    expect(lerSequencialDoSku("CAP-0000", "CAP")).toBeNull();
  });
});

describe("estoque/sku — próximo livre", () => {
  it("começa em 1 quando não há nenhum", () => {
    expect(proximoSku("CAP", [])).toBe("CAP-0001");
  });

  it("usa o MAIOR existente + 1, não a contagem", () => {
    // Contar repetiria um código assim que um produto fosse excluído, e SKU
    // repetido é pior que buraco na sequência.
    expect(proximoSku("CAP", ["CAP-0001", "CAP-0007"])).toBe("CAP-0008");
  });

  it("ignora SKU digitado à mão fora do padrão", () => {
    // SKU próprio é permitido; ele não pode atrapalhar a geração do próximo.
    expect(proximoSku("CAP", ["CAP-0003", "CODIGO-DO-FORNECEDOR", "CAP"])).toBe("CAP-0004");
  });

  it("não se confunde com o sequencial de outro prefixo", () => {
    expect(proximoSku("CAP", ["PEC-0099", "CAP-0002"])).toBe("CAP-0003");
  });
});

describe("estoque/sku — validação", () => {
  it("normaliza pra maiúsculas e sem espaço", () => {
    // "cap-12" e "CAP-12" sendo dois produtos seria armadilha garantida.
    expect(formatarSku("  cap - 12 ")).toBe("CAP-12");
    expect(validarSku("cap-12")).toEqual({ valido: true, sku: "CAP-12" });
  });

  it("recusa vazio", () => {
    expect(validarSku("   ").valido).toBe(false);
  });

  it("recusa caractere que quebraria busca e etiqueta", () => {
    expect(validarSku("CAP/12").valido).toBe(false);
    expect(validarSku("CAP 12#").valido).toBe(false);
  });

  it("aceita letras, números, ponto e hífen", () => {
    expect(validarSku("ABC-12.3").valido).toBe(true);
  });

  it("recusa SKU longo demais", () => {
    expect(validarSku("A".repeat(25)).valido).toBe(false);
    expect(validarSku("A".repeat(24)).valido).toBe(true);
  });
});
