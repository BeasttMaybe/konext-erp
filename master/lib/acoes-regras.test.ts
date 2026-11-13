import { describe, expect, it } from "vitest";

import { conferirConfirmacao, operacaoDoModulo, validarModulo } from "./acoes-regras";

describe("acoes do master", () => {
  it("so aceita modulo do catalogo", () => {
    expect(validarModulo("os")).toBe(true);
    expect(validarModulo("nao-existe")).toBe(false);
  });
  it("suspender exige o slug; reativar nao", () => {
    expect(conferirConfirmacao("SUSPENSA", "loja-x", "loja-x")).toBeNull();
    expect(conferirConfirmacao("SUSPENSA", "loja", "loja-x")).not.toBeNull();
    expect(conferirConfirmacao("ATIVA", "", "loja-x")).toBeNull();
  });
  it("ligar volta ao padrao (sem linha)", () => {
    expect(operacaoDoModulo(true)).toBe("apagar");
    expect(operacaoDoModulo(false)).toBe("gravar-desligado");
  });
});
