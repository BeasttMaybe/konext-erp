import { describe, expect, it } from "vitest";

import { metaParaFormulario, paraCampoDeDataBR, type MetaSalva } from "./formulario";

/**
 * Errar esta conversão é silencioso: um campo que volta vazio por descuido
 * não dá erro nenhum — só apaga o que estava salvo quando a pessoa salva.
 * Por isso cada campo tem teste.
 */

const metaBase: MetaSalva = {
  id: "meta-1",
  titulo: "Faturar 30 mil",
  descricao: null,
  categoria: "FINANCEIRA",
  tipoValor: "DINHEIRO",
  valorAlvo: 30000,
  unidade: null,
  dataInicio: "2026-11-01T00:00:00.000Z",
  dataPrazo: "2026-11-30T00:00:00.000Z",
  prioridade: "ALTA",
  origemProgresso: "AUTOMATICA",
  fonteAutomatica: "ORDENS_SERVICO",
  metricaAutomatica: "FATURAMENTO_OS",
  direcao: "MAIOR_MELHOR",
  configuracaoAutomatica: { dataInicio: "2026-11-01", dataFim: "2026-11-30" },
};

describe("paraCampoDeDataBR", () => {
  it("converte ISO para DD/MM/AAAA", () => {
    expect(paraCampoDeDataBR("2026-11-09T00:00:00.000Z")).toBe("09/11/2026");
    expect(paraCampoDeDataBR("2026-01-01")).toBe("01/01/2026");
  });

  it("não empurra o dia 1º para o mês anterior", () => {
    // As datas do projeto são de calendário, à meia-noite UTC. Converter
    // para o fuso de quem olha jogaria 01/11 para 31/10 em qualquer lugar a
    // oeste de Greenwich — o Brasil inteiro.
    expect(paraCampoDeDataBR("2026-11-01T00:00:00.000Z")).toBe("01/11/2026");
  });

  it("vazio para ausente, nunca 'Invalid Date'", () => {
    expect(paraCampoDeDataBR(null)).toBe("");
    expect(paraCampoDeDataBR(undefined)).toBe("");
    expect(paraCampoDeDataBR("")).toBe("");
    expect(paraCampoDeDataBR("sem data")).toBe("");
  });
});

describe("metaParaFormulario", () => {
  it("traz todos os campos da meta automática", () => {
    expect(metaParaFormulario(metaBase)).toEqual({
      id: "meta-1",
      titulo: "Faturar 30 mil",
      descricao: "",
      categoria: "FINANCEIRA",
      tipoValor: "DINHEIRO",
      valorAlvo: "30000",
      unidade: "",
      dataInicio: "01/11/2026",
      dataPrazo: "30/11/2026",
      prioridade: "ALTA",
      origemProgresso: "AUTOMATICA",
      fonteAutomatica: "ORDENS_SERVICO",
      metricaAutomatica: "FATURAMENTO_OS",
      direcao: "MAIOR_MELHOR",
      dataInicioAutomatica: "01/11/2026",
      dataFimAutomatica: "30/11/2026",
      produtoIdAutomatica: "",
    });
  });

  it("alvo zero continua sendo zero, e não campo vazio", () => {
    // "reduzir retorno de garantia a 0%" é meta legítima. Testar por falsy
    // transformaria o alvo em branco e a meta perderia o objetivo ao salvar.
    expect(metaParaFormulario({ ...metaBase, valorAlvo: 0 }).valorAlvo).toBe("0");
  });

  it("alvo ausente vira campo vazio", () => {
    expect(metaParaFormulario({ ...metaBase, valorAlvo: null }).valorAlvo).toBe("");
  });

  it("enum ausente vira string vazia, que é o que o Select entende", () => {
    const form = metaParaFormulario({
      ...metaBase,
      origemProgresso: "MANUAL",
      fonteAutomatica: null,
      metricaAutomatica: null,
      configuracaoAutomatica: null,
    });

    expect(form.fonteAutomatica).toBe("");
    expect(form.metricaAutomatica).toBe("");
    expect(form.dataInicioAutomatica).toBe("");
    expect(form.produtoIdAutomatica).toBe("");
  });

  it("preserva o produto da meta de estoque", () => {
    const form = metaParaFormulario({
      ...metaBase,
      fonteAutomatica: "ESTOQUE",
      metricaAutomatica: "QUANTIDADE_ITEM_ESTOQUE",
      configuracaoAutomatica: { produtoId: "prod-7" },
    });

    expect(form.produtoIdAutomatica).toBe("prod-7");
  });
});
