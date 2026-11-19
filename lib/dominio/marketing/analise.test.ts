import { describe, expect, it } from "vitest";

import {
  lerRecomendacoes,
  montarMensagensAnalise,
  ordenarPorPrioridade,
  rotuloArea,
  type ContextoAnalise,
} from "./analise";

const CTX: ContextoAnalise = {
  loja: { nome: "Konext Tech", cidade: "Itapetininga", segmento: "Assistência técnica de celulares." },
  google: {
    verificado: true,
    site: "https://konexttech.com.br/",
    categoriaPrincipal: "Loja de celulares",
    qtdCategoriasSecundarias: 0,
    temDescricao: true,
    descricaoLen: 600,
    temHorario: true,
    fotos: "1+",
    impressoes: 741,
    ligacoes: 36,
    rotas: 57,
    cliquesSite: 5,
    avaliacoesTotal: 71,
    avaliacoesMedia: 5,
    avaliacoesSemResposta: 10,
  },
  seo: { problemas: ["Sem meta description."], pareceSpa: false, palavras: 320 },
  instagram: { seguidores: 438, alcance: 459, interacoes: 133 },
  tiktok: { seguidores: 67, visualizacoes: 85303, curtidas: 238 },
};

describe("montarMensagensAnalise", () => {
  it("monta system+user com os dados e pede JSON", () => {
    const msgs = montarMensagensAnalise(CTX);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].papel).toBe("system");
    expect(msgs[0].conteudo).toContain("JSON");
    expect(msgs[1].conteudo).toContain("Konext Tech");
    expect(msgs[1].conteudo).toContain("741 visualizações");
    expect(msgs[1].conteudo).toContain("TIKTOK");
  });
});

describe("lerRecomendacoes", () => {
  it("lê um array JSON, mesmo com texto/cercas em volta", () => {
    const resposta = 'Claro!\n```json\n[{"area":"PERFIL_GOOGLE","prioridade":"Alta","titulo":"Adicione categorias","dica":"Inclua categorias secundárias."},{"area":"SITE_SEO","prioridade":"Média","titulo":"Meta description","dica":"Escreva um resumo."}]\n```';
    const recs = lerRecomendacoes(resposta);
    expect(recs).toHaveLength(2);
    expect(recs[0].area).toBe("PERFIL_GOOGLE");
    expect(recs[0].prioridade).toBe("Alta");
  });

  it("descarta itens inválidos e normaliza prioridade", () => {
    const resposta = '[{"area":"XPTO","titulo":"x","dica":"y"},{"area":"REDES","prioridade":"Urgente","titulo":"Poste mais","dica":"3x por semana."},{"area":"AVALIACOES","titulo":"","dica":"vazio"}]';
    const recs = lerRecomendacoes(resposta);
    expect(recs).toHaveLength(1);
    expect(recs[0].area).toBe("REDES");
    expect(recs[0].prioridade).toBe("Média");
  });

  it("devolve vazio quando não há array", () => {
    expect(lerRecomendacoes("desculpe, não consegui")).toEqual([]);
  });
});

describe("ordenarPorPrioridade", () => {
  it("coloca Alta antes de Média e Baixa", () => {
    const ordenado = ordenarPorPrioridade([
      { area: "REDES", prioridade: "Baixa", titulo: "a", dica: "a" },
      { area: "REDES", prioridade: "Alta", titulo: "b", dica: "b" },
      { area: "REDES", prioridade: "Média", titulo: "c", dica: "c" },
    ]);
    expect(ordenado.map((r) => r.prioridade)).toEqual(["Alta", "Média", "Baixa"]);
  });
});

describe("rotuloArea", () => {
  it("traduz os códigos de área", () => {
    expect(rotuloArea("PERFIL_GOOGLE")).toBe("Perfil do Google");
    expect(rotuloArea("SITE_SEO")).toBe("Site & SEO");
  });
});
