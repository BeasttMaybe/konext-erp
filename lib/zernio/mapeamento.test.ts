import { describe, expect, it } from "vitest";

import {
  canalParaZernio,
  limparTextoAvaliacao,
  resumirMetricasGoogle,
  serieDiariaDinamica,
  totalMetrica,
  zernioParaCanal,
  type MetricasBrutas,
  type RespostaPerformanceGoogle,
} from "./mapeamento";

describe("mapeamento de canais", () => {
  it("traduz canal do ERP para plataforma Zernio e volta", () => {
    expect(canalParaZernio("INSTAGRAM")).toBe("instagram");
    expect(canalParaZernio("FACEBOOK")).toBe("facebook");
    expect(canalParaZernio("TIKTOK")).toBe("tiktok");
    expect(canalParaZernio("GOOGLE_PERFIL")).toBe("googlebusiness");

    expect(zernioParaCanal("instagram")).toBe("INSTAGRAM");
    expect(zernioParaCanal("googlebusiness")).toBe("GOOGLE_PERFIL");
    expect(zernioParaCanal("linkedin")).toBeNull();
  });
});

describe("limparTextoAvaliacao", () => {
  it("remove a tradução automática do Google, mantendo o original", () => {
    const texto = "Ótimo atendimento.\n\n(Translated by Google)\nExcellent service.";
    expect(limparTextoAvaliacao(texto)).toBe("Ótimo atendimento.");
  });

  it("mantém texto sem tradução intacto", () => {
    expect(limparTextoAvaliacao("Serviço rápido e honesto")).toBe("Serviço rápido e honesto");
  });

  it("lida com texto vazio", () => {
    expect(limparTextoAvaliacao("")).toBe("");
  });
});

describe("resumirMetricasGoogle", () => {
  // Amostra real (reduzida) da resposta da Zernio para o Perfil do Google.
  const resposta: RespostaPerformanceGoogle = {
    dateRange: { startDate: "2026-11-15", endDate: "2026-11-17" },
    metrics: {
      BUSINESS_IMPRESSIONS_DESKTOP_MAPS: { total: 3, values: [{ date: "2026-11-15", value: 2 }, { date: "2026-11-16", value: 1 }] },
      BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: { total: 4, values: [{ date: "2026-11-15", value: 4 }] },
      BUSINESS_IMPRESSIONS_MOBILE_MAPS: { total: 5, values: [{ date: "2026-11-16", value: 5 }] },
      BUSINESS_IMPRESSIONS_MOBILE_SEARCH: { total: 10, values: [{ date: "2026-11-15", value: 6 }, { date: "2026-11-17", value: 4 }] },
      CALL_CLICKS: { total: 3, values: [{ date: "2026-11-15", value: 2 }, { date: "2026-11-16", value: 1 }] },
      BUSINESS_DIRECTION_REQUESTS: { total: 7, values: [{ date: "2026-11-16", value: 7 }] },
      WEBSITE_CLICKS: { total: 2, values: [{ date: "2026-11-17", value: 2 }] },
      BUSINESS_CONVERSATIONS: { total: 0, values: [] },
    },
  };

  it("soma as quatro impressões como visualizações", () => {
    const r = resumirMetricasGoogle(resposta);
    expect(r.totais.impressoes).toBe(22); // 3 + 4 + 5 + 10
    expect(r.totais.ligacoes).toBe(3);
    expect(r.totais.rotas).toBe(7);
    expect(r.totais.cliquesSite).toBe(2);
    expect(r.totais.conversas).toBe(0);
  });

  it("agrega a série diária somando as impressões por dia", () => {
    const r = resumirMetricasGoogle(resposta);
    const dia15 = r.porDia.find((d) => d.data === "2026-11-15");
    expect(dia15?.impressoes).toBe(12); // 2 + 4 + 6
    expect(dia15?.ligacoes).toBe(2);

    const dia16 = r.porDia.find((d) => d.data === "2026-11-16");
    expect(dia16?.impressoes).toBe(6); // 1 + 5
    expect(dia16?.rotas).toBe(7);

    const dia17 = r.porDia.find((d) => d.data === "2026-11-17");
    expect(dia17?.impressoes).toBe(4);
    expect(dia17?.cliquesSite).toBe(2);
  });

  it("devolve a série em ordem crescente de data", () => {
    const r = resumirMetricasGoogle(resposta);
    expect(r.porDia.map((d) => d.data)).toEqual(["2026-11-15", "2026-11-16", "2026-11-17"]);
  });

  it("lida com resposta vazia sem quebrar", () => {
    const r = resumirMetricasGoogle({});
    expect(r.totais.impressoes).toBe(0);
    expect(r.porDia).toEqual([]);
  });
});

describe("métricas genéricas (Instagram/TikTok)", () => {
  // Amostra reduzida do TikTok account-insights (time_series).
  const m: MetricasBrutas = {
    follower_count: { total: 67, values: [{ date: "2026-11-19", value: 67 }] },
    video_views: {
      total: 15,
      values: [
        { date: "2026-11-17", value: 10 },
        { date: "2026-11-18", value: 5 },
      ],
    },
    likes: {
      total: 3,
      values: [
        { date: "2026-11-17", value: 2 },
        { date: "2026-11-18", value: 1 },
      ],
    },
  };

  it("totalMetrica devolve o total arredondado e não-negativo", () => {
    expect(totalMetrica(m, "video_views")).toBe(15);
    expect(totalMetrica(m, "follower_count")).toBe(67);
    expect(totalMetrica(m, "inexistente")).toBe(0);
  });

  it("serieDiariaDinamica junta as métricas por dia, em ordem", () => {
    const serie = serieDiariaDinamica(m, ["video_views", "likes"]);
    expect(serie).toEqual([
      { data: "2026-11-17", video_views: 10, likes: 2 },
      { data: "2026-11-18", video_views: 5, likes: 1 },
    ]);
  });

  it("serieDiariaDinamica de métrica sem série devolve vazio", () => {
    expect(serieDiariaDinamica(m, ["follower_count"]).length).toBe(1);
    expect(serieDiariaDinamica(m, ["nao_existe"])).toEqual([]);
  });
});
