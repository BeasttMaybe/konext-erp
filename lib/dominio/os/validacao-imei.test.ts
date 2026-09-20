import { describe, expect, it } from "vitest";

import { validarFormatoImei } from "./validacao-imei";

describe("validarFormatoImei", () => {
  it("aceita vazio, null ou undefined — campo opcional", () => {
    expect(validarFormatoImei("")).toEqual({ valido: true });
    expect(validarFormatoImei("   ")).toEqual({ valido: true });
    expect(validarFormatoImei(null)).toEqual({ valido: true });
    expect(validarFormatoImei(undefined)).toEqual({ valido: true });
  });

  it("aceita um IMEI numerico normal", () => {
    expect(validarFormatoImei("358123045237847")).toEqual({ valido: true });
  });

  it("aceita numeros de serie com letras e hifen", () => {
    expect(validarFormatoImei("SN-A1B2-C3D4")).toEqual({ valido: true });
    expect(validarFormatoImei("ABC 123 XYZ")).toEqual({ valido: true });
  });

  it("rejeita um e-mail digitado no campo (caso real de producao)", () => {
    const resultado = validarFormatoImei("konext58@gmail.com");
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.mensagem).toContain("letras, números, espaço ou hífen");
    }
  });

  it("rejeita outros caracteres especiais", () => {
    expect(validarFormatoImei("123/456").valido).toBe(false);
    expect(validarFormatoImei("123.456").valido).toBe(false);
    expect(validarFormatoImei("123#456").valido).toBe(false);
  });
});
