import { describe, expect, it } from "vitest";

import {
  TAMANHOS_DE_ETIQUETA,
  TAMANHO_DE_ETIQUETA_PADRAO,
  acharTamanhoDeEtiqueta,
  codigoDaEtiqueta,
  digitoVerificadorEanConfere,
  encurtarParaEtiqueta,
  limiteDeNomePorTamanho,
  mmParaPontos,
} from "./etiqueta";

describe("estoque/etiqueta — qual código vai nas barras", () => {
  it("prefere o código de barras do fabricante, como EAN-13", () => {
    // É o que o leitor espera e o que permite bipar a embalagem original.
    expect(codigoDaEtiqueta({ codigoBarras: "7890001000121", sku: "CAP-0012" })).toEqual({
      simbologia: "ean13",
      conteudo: "7890001000121",
      legenda: "7890001000121",
      origem: "CODIGO_DE_BARRAS",
    });
  });

  it("aceita 12 dígitos: o EAN-13 calcula o verificador", () => {
    const codigo = codigoDaEtiqueta({ codigoBarras: "789000100012", sku: null });

    expect(codigo?.simbologia).toBe("ean13");
  });

  it("reconhece EAN-8", () => {
    expect(codigoDaEtiqueta({ codigoBarras: "12345678", sku: null })?.simbologia).toBe("ean8");
  });

  it("código numérico fora dos tamanhos de EAN cai no Code128", () => {
    // 10 dígitos não é EAN nenhum, mas continua sendo o código que o dono
    // cadastrou — ignorá-lo seria pior que codificá-lo.
    const codigo = codigoDaEtiqueta({ codigoBarras: "1234567890", sku: "CAP-0001" });

    expect(codigo?.simbologia).toBe("code128");
    expect(codigo?.conteudo).toBe("1234567890");
    expect(codigo?.origem).toBe("CODIGO_DE_BARRAS");
  });

  it("código de barras com letra também vale, em Code128", () => {
    const codigo = codigoDaEtiqueta({ codigoBarras: "ABC-123", sku: "CAP-0001" });

    expect(codigo?.simbologia).toBe("code128");
    expect(codigo?.conteudo).toBe("ABC-123");
  });

  it("sem código de barras, usa o SKU em Code128", () => {
    // O EAN não aceita letra nem hífen; o Code128 aceita.
    expect(codigoDaEtiqueta({ codigoBarras: null, sku: "CAP-0012" })).toEqual({
      simbologia: "code128",
      conteudo: "CAP-0012",
      legenda: "CAP-0012",
      origem: "SKU",
    });
  });

  it("sem nenhum dos dois, não existe etiqueta", () => {
    // Inventar um número geraria etiqueta que bipa e não acha produto nenhum.
    expect(codigoDaEtiqueta({ codigoBarras: null, sku: null })).toBeNull();
    expect(codigoDaEtiqueta({ codigoBarras: "   ", sku: "  " })).toBeNull();
  });
});

describe("estoque/etiqueta — tamanhos", () => {
  it("o padrão está na lista", () => {
    expect(
      TAMANHOS_DE_ETIQUETA.some((tamanho) => tamanho.id === TAMANHO_DE_ETIQUETA_PADRAO)
    ).toBe(true);
  });

  it("id desconhecido cai no padrão em vez de quebrar", () => {
    // Vem de query string: um id inventado não pode derrubar a impressão.
    expect(acharTamanhoDeEtiqueta("nao-existe").id).toBe(TAMANHO_DE_ETIQUETA_PADRAO);
  });

  it("acha cada tamanho da lista", () => {
    for (const tamanho of TAMANHOS_DE_ETIQUETA) {
      expect(acharTamanhoDeEtiqueta(tamanho.id).id).toBe(tamanho.id);
    }
  });
});

describe("estoque/etiqueta — milímetros para pontos", () => {
  it("converte na medida exata do PDF", () => {
    // 1 pt = 1/72", 1" = 25,4 mm. Erro aqui desloca o conteúdo pro picote.
    expect(mmParaPontos(25.4)).toBeCloseTo(72, 6);
    expect(mmParaPontos(50)).toBeCloseTo(141.732, 3);
    expect(mmParaPontos(0)).toBe(0);
  });
});

describe("estoque/etiqueta — nome que não cabe", () => {
  it("corta com reticências", () => {
    // Numa etiqueta, texto que estoura a caixa desaparece — não vira segunda
    // linha.
    const cortado = encurtarParaEtiqueta("Capa de silicone iPhone 13 Pro Max", 22);

    expect(cortado).toBe("Capa de silicone iPho…");
    // As reticências contam no limite: o resultado nunca passa dele.
    expect(cortado).toHaveLength(22);
  });

  it("deixa em paz o que cabe, só limpando espaço", () => {
    expect(encurtarParaEtiqueta("  Capa   iPhone 13 ", 22)).toBe("Capa iPhone 13");
  });

  it("o limite cresce com a etiqueta", () => {
    const pequena = acharTamanhoDeEtiqueta("33x22");
    const media = acharTamanhoDeEtiqueta("50x30");
    const grande = acharTamanhoDeEtiqueta("60x40");

    expect(limiteDeNomePorTamanho(pequena)).toBeLessThan(limiteDeNomePorTamanho(media));
    expect(limiteDeNomePorTamanho(media)).toBeLessThan(limiteDeNomePorTamanho(grande));
  });
});

describe("estoque/etiqueta — dígito verificador do EAN", () => {
  /**
   * Casos reais: o gerador recusa EAN de 13 dígitos com verificador errado, e
   * a mensagem crua dele é `bwipp.ean13badCheckDigit#6915`. Conferir aqui
   * permite avisar na tela do produto, antes de tentar imprimir.
   */
  it("aceita um EAN-13 válido", () => {
    // 7891000315507 — Nescau 370g, código real da GS1 Brasil.
    expect(digitoVerificadorEanConfere("7891000315507")).toBe(true);
  });

  it("recusa quando um dígito foi trocado", () => {
    expect(digitoVerificadorEanConfere("7891000315506")).toBe(false);
    expect(digitoVerificadorEanConfere("7890001000121")).toBe(false);
  });

  it("aceita um EAN-8 válido e recusa o alterado", () => {
    expect(digitoVerificadorEanConfere("40170725")).toBe(true);
    expect(digitoVerificadorEanConfere("40170724")).toBe(false);
  });

  it("não opina sobre código que não é EAN completo", () => {
    // 12 dígitos é válido: o 13º ainda vai ser calculado pelo gerador.
    expect(digitoVerificadorEanConfere("789100031550")).toBeNull();
    expect(digitoVerificadorEanConfere("CAP-0012")).toBeNull();
    expect(digitoVerificadorEanConfere("")).toBeNull();
  });
});
