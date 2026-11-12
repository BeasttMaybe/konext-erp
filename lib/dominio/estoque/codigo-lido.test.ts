import { describe, expect, it } from "vitest";

import { digitoVerificadorEanConfere } from "./etiqueta";
import { produtoPeloCodigoLido } from "./codigo-lido";

const P = (id: string, codigoBarras: string | null, sku: string | null = null) => ({ id, codigoBarras, sku });

describe("produtoPeloCodigoLido", () => {
  it("codigo identico ao cadastrado", () => {
    expect(produtoPeloCodigoLido([P("a", "7891234567895")], "7891234567895")?.id).toBe("a");
  });

  it("cadastro de 12 digitos: a etiqueta imprime 13, e o lido com 13 acha o produto", () => {
    const produtos = [P("pelicula", "789123456789")];
    const lido = "7891234567895";
    // confere que o lido e mesmo o EAN-13 valido daquele cadastro
    expect(digitoVerificadorEanConfere(lido)).toBe(true);
    expect(produtoPeloCodigoLido(produtos, lido)?.id).toBe("pelicula");
  });

  it("cadastro de 7 digitos: idem para EAN-8", () => {
    const lido = "1234567" + "0";
    expect(digitoVerificadorEanConfere(lido)).toBe(true);
    expect(produtoPeloCodigoLido([P("cabo", "1234567")], lido)?.id).toBe("cabo");
  });

  it("produto sem codigo de barras: acha pelo SKU que a etiqueta Code128 carrega", () => {
    expect(produtoPeloCodigoLido([P("capa", null, "CAPA-IP13-PRT")], "capa-ip13-prt")?.id).toBe("capa");
  });

  it("codigo de barras vence SKU igual de outro produto", () => {
    const produtos = [P("pelo-sku", null, "7891234567895"), P("pelo-barras", "7891234567895")];
    expect(produtoPeloCodigoLido(produtos, "7891234567895")?.id).toBe("pelo-barras");
  });

  it("dois produtos com o mesmo codigo: nenhum — nao escolhe por adivinhacao", () => {
    expect(produtoPeloCodigoLido([P("a", "7891234567895"), P("b", "7891234567895")], "7891234567895")).toBeNull();
  });

  it("espacos em volta e leitura vazia", () => {
    expect(produtoPeloCodigoLido([P("a", "7891234567895")], "  7891234567895\n")?.id).toBe("a");
    expect(produtoPeloCodigoLido([P("a", "")], "")).toBeNull();
  });

  it("codigo desconhecido", () => {
    expect(produtoPeloCodigoLido([P("a", "7891234567895", "X")], "0000")).toBeNull();
  });
});
