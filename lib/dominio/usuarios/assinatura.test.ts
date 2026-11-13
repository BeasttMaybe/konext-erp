import { describe, expect, it } from "vitest";

import { assinanteDaOS, caminhoDaAssinatura, TAMANHO_MAXIMO_DA_ASSINATURA, validarAssinaturaRecebida } from "./assinatura";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe("validarAssinaturaRecebida", () => {
  it("aceita PNG pequeno e recusa vazio, grande e nao-imagem", () => {
    expect(validarAssinaturaRecebida(png)).toEqual({ ok: true, tipo: "image/png" });
    expect(validarAssinaturaRecebida(new Uint8Array()).ok).toBe(false);
    const grande = new Uint8Array(TAMANHO_MAXIMO_DA_ASSINATURA + 1);
    grande.set(png);
    expect(validarAssinaturaRecebida(grande).ok).toBe(false);
    expect(validarAssinaturaRecebida(new TextEncoder().encode("<svg/>")).ok).toBe(false);
  });
});

describe("assinanteDaOS", () => {
  const ana = { id: "u1", nome: "Ana" };
  const bia = { id: "u2", nome: "Bia" };
  const caio = { id: "u3", nome: "Caio" };

  it("prefere o tecnico principal", () => {
    expect(
      assinanteDaOS({
        tecnicos: [
          { principal: false, usuario: ana },
          { principal: true, usuario: bia },
        ],
        criadoPor: caio,
      })
    ).toEqual({ usuarioId: "u2", nome: "Bia" });
  });

  it("sem principal, o primeiro tecnico; sem tecnicos, quem abriu", () => {
    expect(assinanteDaOS({ tecnicos: [{ principal: false, usuario: ana }], criadoPor: caio })?.usuarioId).toBe("u1");
    expect(assinanteDaOS({ tecnicos: [], criadoPor: caio })?.usuarioId).toBe("u3");
    expect(assinanteDaOS({ tecnicos: [], criadoPor: null })).toBeNull();
  });
});

describe("caminhoDaAssinatura", () => {
  it("versiona pelo momento da gravacao", () => {
    expect(caminhoDaAssinatura("u1", 1700000000123)).toBe("/assinatura/u1?v=1700000000123");
  });
});
