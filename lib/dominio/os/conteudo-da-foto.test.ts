import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { conteudoConfereComOTipo, tipoRealDaImagem } from "./fotos";

const bytes = (...valores: number[]) => new Uint8Array(valores);
const texto = (conteudo: string) => new TextEncoder().encode(conteudo);

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);

describe("tipoRealDaImagem", () => {
  it("reconhece os tres formatos aceitos pela assinatura", () => {
    expect(tipoRealDaImagem(JPEG)).toBe("image/jpeg");
    expect(tipoRealDaImagem(PNG)).toBe("image/png");
    expect(tipoRealDaImagem(WEBP)).toBe("image/webp");
  });

  it("um HTML nao e imagem, declare o que declarar", () => {
    expect(tipoRealDaImagem(texto("<html><script>alert(1)</script></html>"))).toBeNull();
  });

  it("um SVG nao e aceito — e o formato de imagem que carrega script", () => {
    expect(tipoRealDaImagem(texto('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>'))).toBeNull();
  });

  it("RIFF que nao e WebP (um .wav, um .avi) nao passa", () => {
    const wav = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45);
    expect(tipoRealDaImagem(wav)).toBeNull();
  });

  it("arquivo vazio ou curto demais nao lanca, so nao e imagem", () => {
    expect(tipoRealDaImagem(bytes())).toBeNull();
    expect(tipoRealDaImagem(bytes(0xff, 0xd8))).toBeNull();
    expect(tipoRealDaImagem(bytes(0x52, 0x49, 0x46, 0x46))).toBeNull();
  });
});

describe("conteudoConfereComOTipo", () => {
  it("aceita quando o conteudo e o tipo declarado concordam", () => {
    expect(conteudoConfereComOTipo(JPEG, "image/jpeg")).toBe(true);
    expect(conteudoConfereComOTipo(PNG, "image/png")).toBe(true);
    expect(conteudoConfereComOTipo(WEBP, "image/webp")).toBe(true);
  });

  it("recusa o caso do ataque: HTML declarado como JPEG", () => {
    expect(conteudoConfereComOTipo(texto("<html></html>"), "image/jpeg")).toBe(false);
  });

  it("recusa imagem de verdade declarada com o tipo errado", () => {
    // O tipo declarado e o que fica gravado e volta no cabecalho da resposta.
    expect(conteudoConfereComOTipo(PNG, "image/jpeg")).toBe(false);
  });
});

/**
 * GUARDA: os dois caminhos de envio conferem o conteudo ANTES de gravar.
 */
describe("envio de foto", () => {
  it.each(["app/actions/fotos-os.ts", "app/actions/foto-pelo-celular.ts"])(
    "%s confere os bytes antes de mandar ao bucket",
    (arquivo) => {
      const fonte = readFileSync(join(process.cwd(), arquivo), "utf8");
      const confere = fonte.indexOf("conteudoConfereComOTipo(conteudo, arquivo.type)");
      const grava = fonte.indexOf("await gravarObjeto(");

      expect(confere).toBeGreaterThan(-1);
      expect(grava).toBeGreaterThan(-1);
      expect(confere).toBeLessThan(grava);
    }
  );
});
