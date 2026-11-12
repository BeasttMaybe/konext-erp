import { describe, expect, it } from "vitest";

import {
  caminhoDaLogo,
  conferirArquivoEscolhido,
  detectarTipoDaLogo,
  ehCaminhoDaLogoEnviada,
  TAMANHO_MAXIMO_DA_LOGO_GRAVADA,
  validarLogoRecebida,
} from "./logo-enviada";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("tipo pelos primeiros bytes", () => {
  it("reconhece PNG, JPG e WEBP", () => {
    expect(detectarTipoDaLogo(png)).toBe("image/png");
    expect(detectarTipoDaLogo(jpg)).toBe("image/jpeg");
    expect(detectarTipoDaLogo(webp)).toBe("image/webp");
  });

  it("recusa SVG e qualquer outra coisa, mesmo que o nome diga .png", () => {
    expect(detectarTipoDaLogo(svg)).toBeNull();
    expect(validarLogoRecebida(svg).ok).toBe(false);
    expect(detectarTipoDaLogo(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe("limites", () => {
  it("recusa vazio e acima de 1 MB no servidor", () => {
    expect(validarLogoRecebida(new Uint8Array()).ok).toBe(false);
    const grande = new Uint8Array(TAMANHO_MAXIMO_DA_LOGO_GRAVADA + 1);
    grande.set(png);
    const resultado = validarLogoRecebida(grande);
    expect(resultado.ok).toBe(false);
    expect(validarLogoRecebida(png)).toEqual({ ok: true, tipo: "image/png" });
  });

  it("na escolha: so imagem, ate 5 MB", () => {
    expect(conferirArquivoEscolhido({ type: "image/png", size: 4 * 1024 * 1024 })).toBeNull();
    expect(conferirArquivoEscolhido({ type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/limite é 5 MB/);
    expect(conferirArquivoEscolhido({ type: "image/svg+xml", size: 100 })).toMatch(/PNG, JPG ou WEBP/);
    expect(conferirArquivoEscolhido({ type: "application/pdf", size: 100 })).not.toBeNull();
  });
});

describe("endereco da logo", () => {
  it("muda a cada envio e e reconhecido como logo enviada", () => {
    expect(caminhoDaLogo(1731445200000)).toBe("/logo-da-empresa?v=1731445200000");
    expect(ehCaminhoDaLogoEnviada("/logo-da-empresa?v=123")).toBe(true);
    expect(ehCaminhoDaLogoEnviada("/logo-da-empresa")).toBe(true);
    expect(ehCaminhoDaLogoEnviada("/logo-da-empresa?v=1&x=<script>")).toBe(false);
    expect(ehCaminhoDaLogoEnviada("//malicioso.com/logo-da-empresa")).toBe(false);
  });
});
