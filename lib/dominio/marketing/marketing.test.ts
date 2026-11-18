import { describe, expect, it } from "vitest";

import {
  CANAIS_ORGANICOS,
  ehIdDePlataforma,
  plataformaConfiguravel,
  plataformaDoCanal,
  plataformaPorId,
  PLATAFORMAS,
} from "./plataformas";
import { podeCancelar, podeEditar, statusAoSalvar, validarPublicacao } from "./publicacao";

describe("plataformas", () => {
  it("as quatro plataformas pedidas existem", () => {
    expect(PLATAFORMAS.map((p) => p.id).sort()).toEqual(["GOOGLE_ADS", "GOOGLE_PERFIL", "META", "TIKTOK_ADS"]);
    expect(ehIdDePlataforma("META")).toBe(true);
    expect(ehIdDePlataforma("ORKUT")).toBe(false);
  });
  it("Meta publica orgânico e anúncio, no Instagram e Facebook", () => {
    const meta = plataformaPorId("META")!;
    expect(meta.organico && meta.anuncios).toBe(true);
    expect(meta.canais).toEqual(["INSTAGRAM", "FACEBOOK"]);
    expect(plataformaDoCanal("INSTAGRAM")).toBe("META");
  });
  it("Google Ads é só anúncio (sem canal orgânico)", () => {
    const g = plataformaPorId("GOOGLE_ADS")!;
    expect(g.organico).toBe(false);
    expect(g.anuncios).toBe(true);
  });
  it("configurável só quando todas as variáveis existem", () => {
    expect(plataformaConfiguravel("META", new Set(["META_APP_ID"]))).toBe(false);
    expect(plataformaConfiguravel("META", new Set(["META_APP_ID", "META_APP_SECRET"]))).toBe(true);
  });
  it("todos os canais orgânicos vêm de alguma plataforma", () => {
    for (const canal of CANAIS_ORGANICOS) expect(plataformaPorId(plataformaDoCanal(canal))).toBeTruthy();
  });
});

describe("validarPublicacao", () => {
  const agora = new Date("2026-11-18T12:00:00Z");

  it("post orgânico válido com agendamento", () => {
    const r = validarPublicacao(
      { tipo: "POST_ORGANICO", texto: " Promoção de película! ", canais: ["INSTAGRAM", "FACEBOOK", "INSTAGRAM"], agendadoPara: "2026-11-18T15:00:00Z" },
      agora
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.texto).toBe("Promoção de película!");
      expect(r.dados.canais).toEqual(["INSTAGRAM", "FACEBOOK"]);
      expect(r.dados.agendadoPara).toBe("2026-11-18T15:00:00.000Z");
    }
  });

  it("recusa sem texto, sem canal e com agendamento no passado", () => {
    expect(validarPublicacao({ texto: "", canais: ["INSTAGRAM"] }, agora).ok).toBe(false);
    expect(validarPublicacao({ texto: "oi", canais: [] }, agora).ok).toBe(false);
    expect(validarPublicacao({ texto: "oi", canais: ["INSTAGRAM"], agendadoPara: "2026-11-18T11:00:00Z" }, agora).ok).toBe(false);
    expect(validarPublicacao({ texto: "oi", canais: ["x) DROP"], agendadoPara: "" }, agora).ok).toBe(false);
  });

  it("anúncio pago exige verba válida", () => {
    expect(validarPublicacao({ tipo: "ANUNCIO_PAGO", texto: "oi", canais: ["INSTAGRAM"] }, agora).ok).toBe(false);
    const r = validarPublicacao({ tipo: "ANUNCIO_PAGO", texto: "oi", canais: ["INSTAGRAM"], orcamento: "50,00", linkDestino: "https://konext.com.br" }, agora);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.orcamentoCentavos).toBe(5000);
      expect(r.dados.linkDestino).toBe("https://konext.com.br");
    }
    expect(validarPublicacao({ tipo: "ANUNCIO_PAGO", texto: "oi", canais: ["INSTAGRAM"], orcamento: "0,50" }, agora).ok).toBe(false);
    expect(validarPublicacao({ tipo: "ANUNCIO_PAGO", texto: "oi", canais: ["INSTAGRAM"], orcamento: "10", linkDestino: "zap" }, agora).ok).toBe(false);
  });
});

describe("status", () => {
  it("orgânico agendado vira AGENDADA; sem data, RASCUNHO", () => {
    expect(statusAoSalvar({ tipo: "POST_ORGANICO", agendadoPara: "2026-11-18T15:00:00Z" })).toBe("AGENDADA");
    expect(statusAoSalvar({ tipo: "POST_ORGANICO", agendadoPara: null })).toBe("RASCUNHO");
  });
  it("anúncio pago NUNCA publica sozinho: fica RASCUNHO mesmo com data", () => {
    expect(statusAoSalvar({ tipo: "ANUNCIO_PAGO", agendadoPara: "2026-11-18T15:00:00Z" })).toBe("RASCUNHO");
  });
  it("edição/cancelamento só antes de sair", () => {
    expect(podeEditar("PUBLICADA")).toBe(false);
    expect(podeEditar("AGENDADA")).toBe(true);
    expect(podeCancelar("FALHOU")).toBe(true);
    expect(podeCancelar("PUBLICANDO")).toBe(false);
  });
});
