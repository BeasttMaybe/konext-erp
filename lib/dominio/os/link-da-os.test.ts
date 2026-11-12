import { describe, expect, it } from "vitest";

import { caminhoDaOS, idDaOSNoQrLido } from "./link-da-os";

const ID = "0d576660-1c2b-4f6e-9a3d-2b1c0e5f7a91";

describe("idDaOSNoQrLido", () => {
  it("URL completa impressa na OS", () => {
    expect(idDaOSNoQrLido(`https://konext.app/os/${ID}`)).toBe(ID);
  });

  it("caminho sozinho, com barra no fim ou parametro", () => {
    expect(idDaOSNoQrLido(caminhoDaOS(ID))).toBe(ID);
    expect(idDaOSNoQrLido(`/os/${ID}/`)).toBe(ID);
    expect(idDaOSNoQrLido(`https://x.app/os/${ID}?modelo=A4`)).toBe(ID);
  });

  it("de outro dominio: aproveita o id, nunca o endereco", () => {
    // O chamador navega para caminhoDaOS(id) — o host lido e descartado.
    expect(idDaOSNoQrLido(`https://golpe.example/os/${ID}`)).toBe(ID);
  });

  it("nao e QR de OS", () => {
    for (const lido of ["", "7891234567895", "https://konext.app/os", `https://konext.app/os/${ID}/imprimir`, "https://konext.app/os/123", `https://konext.app/crm/${ID}`, "javascript:alert(1)"]) {
      expect(idDaOSNoQrLido(lido)).toBeNull();
    }
  });
});
