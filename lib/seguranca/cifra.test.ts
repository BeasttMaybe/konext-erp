import { describe, expect, it } from "vitest";

import { abrir, cifrar, decifrar, estaCifrado, gerarChave, lerChave } from "./cifra";

const chave = lerChave(gerarChave());

describe("cifra", () => {
  it("cifra e abre de volta, com IV novo a cada vez", () => {
    const a = cifrar("1234", chave, "os.senha");
    const b = cifrar("1234", chave, "os.senha");
    expect(a).not.toBe(b);
    expect(a).not.toContain("1234");
    expect(estaCifrado(a)).toBe(true);
    expect(decifrar(a, chave, "os.senha")).toBe("1234");
    expect(abrir(b, chave, "os.senha")).toBe("1234");
  });

  it("acentos e textos longos", () => {
    const texto = "senha çãé ".repeat(40);
    expect(decifrar(cifrar(texto, chave, "x"), chave, "x")).toBe(texto);
  });

  it("leitura dupla: texto puro antigo volta como esta; vazio vira null", () => {
    expect(abrir("1-5-9-6", chave, "os.senhaDesenho")).toBe("1-5-9-6");
    expect(abrir("", chave, "os.senha")).toBeNull();
    expect(abrir(null, chave, "os.senha")).toBeNull();
  });

  it("nao abre com outra chave, outro campo ou adulterado", () => {
    const valor = cifrar("abc", chave, "os.senha");
    const outra = lerChave(gerarChave());
    expect(abrir(valor, outra, "os.senha")).toBeNull();
    expect(abrir(valor, chave, "os.senhaDesenho")).toBeNull();
    const adulterado = valor.slice(0, -2) + (valor.endsWith("A") ? "BB" : "AA");
    expect(abrir(adulterado, chave, "os.senha")).toBeNull();
    expect(() => decifrar("v1:abc", chave, "os.senha")).toThrow();
  });

  it("recusa chave de tamanho errado", () => {
    expect(() => lerChave(Buffer.alloc(16).toString("base64"))).toThrow();
  });
});
