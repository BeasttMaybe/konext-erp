import { describe, expect, it } from "vitest";

import {
  HORAS_DE_VALIDADE_DO_LINK,
  MAXIMO_DE_FOTOS_POR_OS,
  MOMENTOS_DA_FOTO,
  TAMANHO_MAXIMO_DA_FOTO_EM_BYTES,
  chavePertenceAOrdem,
  ehTipoDeImagemAceito,
  formatarTamanho,
  montarChaveDaFoto,
  rotuloDoMomento,
  situacaoDoLink,
  validarFoto,
} from "./fotos";

describe("os/fotos — tipos aceitos", () => {
  it("aceita os três formatos que todo navegador exibe", () => {
    expect(ehTipoDeImagemAceito("image/jpeg")).toBe(true);
    expect(ehTipoDeImagemAceito("image/png")).toBe(true);
    expect(ehTipoDeImagemAceito("image/webp")).toBe(true);
  });

  it("recusa HEIC e o que não é imagem", () => {
    // O navegador converte HEIC pra JPEG ao reduzir, antes de enviar. Aceitar
    // HEIC aqui seria guardar arquivo que boa parte dos navegadores não abre.
    expect(ehTipoDeImagemAceito("image/heic")).toBe(false);
    expect(ehTipoDeImagemAceito("application/pdf")).toBe(false);
    expect(ehTipoDeImagemAceito("")).toBe(false);
  });
});

describe("os/fotos — validação do envio", () => {
  const base = { tipoConteudo: "image/jpeg", tamanhoBytes: 300_000, fotosJaExistentes: 0 };

  it("passa numa foto reduzida normal", () => {
    expect(validarFoto(base)).toEqual({ valido: true });
  });

  it("recusa arquivo que não é imagem, dizendo quais valem", () => {
    const resultado = validarFoto({ ...base, tipoConteudo: "application/pdf" });

    expect(resultado.valido).toBe(false);
    expect(resultado.valido === false && resultado.erro).toContain("JPG, PNG ou WebP");
  });

  it("recusa arquivo vazio", () => {
    expect(validarFoto({ ...base, tamanhoBytes: 0 }).valido).toBe(false);
  });

  it("recusa acima do teto, dizendo o tamanho que chegou", () => {
    const resultado = validarFoto({
      ...base,
      tamanhoBytes: TAMANHO_MAXIMO_DA_FOTO_EM_BYTES + 1,
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.valido === false && resultado.erro).toContain("2,0 MB");
  });

  it("aceita exatamente no teto", () => {
    expect(validarFoto({ ...base, tamanhoBytes: TAMANHO_MAXIMO_DA_FOTO_EM_BYTES }).valido).toBe(
      true
    );
  });

  it("recusa quando a OS já está no limite de fotos", () => {
    const resultado = validarFoto({ ...base, fotosJaExistentes: MAXIMO_DE_FOTOS_POR_OS });

    expect(resultado.valido).toBe(false);
    expect(resultado.valido === false && resultado.erro).toContain("limite");
  });

  it("aceita a última vaga", () => {
    expect(validarFoto({ ...base, fotosJaExistentes: MAXIMO_DE_FOTOS_POR_OS - 1 }).valido).toBe(
      true
    );
  });
});

describe("os/fotos — caminho no bucket", () => {
  it("agrupa por OS e usa nome aleatório, nunca o do arquivo", () => {
    // Nome de arquivo de celular pode conter o que o dono do aparelho
    // escreveu, e o caminho aparece em URL.
    const chave = montarChaveDaFoto({
      ordemServicoId: "os-123",
      tipoConteudo: "image/jpeg",
      identificador: "abc-def",
    });

    expect(chave).toBe("os/os-123/abc-def.jpg");
  });

  it("usa a extensão de cada tipo", () => {
    const comTipo = (tipoConteudo: "image/jpeg" | "image/png" | "image/webp") =>
      montarChaveDaFoto({ ordemServicoId: "x", tipoConteudo, identificador: "i" });

    expect(comTipo("image/png")).toMatch(/\.png$/);
    expect(comTipo("image/webp")).toMatch(/\.webp$/);
  });

  it("reconhece a chave que pertence à OS", () => {
    expect(chavePertenceAOrdem("os/os-123/abc.jpg", "os-123")).toBe(true);
  });

  /**
   * O ponto da conferência: apagar uma foto recebe o id de uma LINHA, e a linha
   * carrega a chave. Sem isto, uma linha com chave adulterada apagaria o
   * arquivo de outra OS.
   */
  it("recusa chave de outra OS, e o prefixo que só parece igual", () => {
    expect(chavePertenceAOrdem("os/os-999/abc.jpg", "os-123")).toBe(false);
    expect(chavePertenceAOrdem("os/os-1234/abc.jpg", "os-123")).toBe(false);
    expect(chavePertenceAOrdem("diagnostico/abc.txt", "os-123")).toBe(false);
    expect(chavePertenceAOrdem("../os/os-123/abc.jpg", "os-123")).toBe(false);
  });
});

describe("os/fotos — momentos", () => {
  it("são três, e cada um tem rótulo e explicação", () => {
    expect(MOMENTOS_DA_FOTO).toHaveLength(3);

    for (const momento of MOMENTOS_DA_FOTO) {
      expect(momento.rotulo.length, momento.valor).toBeGreaterThan(0);
      expect(momento.ajuda.length, momento.valor).toBeGreaterThan(0);
    }
  });

  it("o rótulo volta pelo valor, e o desconhecido não vira vazio", () => {
    expect(rotuloDoMomento("ENTRADA")).toBe("Na entrada");
    expect(rotuloDoMomento("INVENTADO" as never)).toBe("INVENTADO");
  });
});

describe("os/fotos — link do celular", () => {
  const agora = new Date("2026-11-03T12:00:00.000Z");

  it("vale enquanto não expirou", () => {
    expect(
      situacaoDoLink({
        expiraEm: new Date("2026-11-04T12:00:00.000Z"),
        revogadoEm: null,
        agora,
      })
    ).toBe("VALIDO");
  });

  it("expira no instante do prazo, não depois", () => {
    expect(situacaoDoLink({ expiraEm: agora, revogadoEm: null, agora })).toBe("EXPIRADO");
  });

  it("revogado vence expirado na mensagem", () => {
    // Quem revogou quer saber que revogou; "expirou" sugeriria que bastava
    // esperar.
    expect(
      situacaoDoLink({
        expiraEm: new Date("2026-11-01T12:00:00.000Z"),
        revogadoEm: new Date("2026-11-02T12:00:00.000Z"),
        agora,
      })
    ).toBe("REVOGADO");
  });

  it("a validade é de um dia", () => {
    expect(HORAS_DE_VALIDADE_DO_LINK).toBe(24);
  });
});

describe("os/fotos — tamanho legível", () => {
  it("escolhe a unidade e usa vírgula decimal", () => {
    expect(formatarTamanho(512)).toBe("512 B");
    expect(formatarTamanho(312 * 1024)).toBe("312 KB");
    expect(formatarTamanho(Math.round(1.4 * 1024 * 1024))).toBe("1,4 MB");
  });
});
