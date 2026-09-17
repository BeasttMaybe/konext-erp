import { describe, expect, it } from "vitest";

import {
  avaliarFinalizacao,
  avaliarFinalizacaoSemServico,
  resumirPendencias,
  type CodigoPendenciaFinalizacao,
  type EntradaAvaliacaoFinalizacao,
  type ItemParaAvaliacaoFinalizacao,
  type RegrasConfiguracaoFinalizacao,
} from "./regras-finalizacao";

const REGRAS_PADRAO: RegrasConfiguracaoFinalizacao = {
  exigirDiagnosticoParaFinalizar: false,
  permitirFinalizarSemPagamento: true,
  prazoGarantiaPadraoDias: 90,
  prazoMinimoGarantiaDias: 1,
  prazoMaximoGarantiaDias: 365,
};

const ITEM_VALIDO: ItemParaAvaliacaoFinalizacao = {
  id: "item-1",
  descricao: "Troca de tela",
  custo: 120,
  precoVenda: 250,
};

/** OS normal em PRONTO, com item valido e pedido no PDV, pronta para finalizar sem pendencia. */
function entradaBase(
  sobrescritas: Partial<EntradaAvaliacaoFinalizacao> = {}
): EntradaAvaliacaoFinalizacao {
  return {
    status: "PRONTO",
    ehRetornoGarantia: false,
    excluidaEm: null,
    archivedAt: null,
    possuiTermoGarantia: false,
    itens: [ITEM_VALIDO],
    observacoes: "Troca de tela concluída.",
    possuiPagamentoConfirmado: true,
    possuiVendaVinculada: true,
    prazoGarantiaDiasInformado: null,
    regras: REGRAS_PADRAO,
    ...sobrescritas,
  };
}

function codigos(entrada: EntradaAvaliacaoFinalizacao): CodigoPendenciaFinalizacao[] {
  return avaliarFinalizacao(entrada).pendencias.map((pendencia) => pendencia.codigo);
}

describe("caminho feliz", () => {
  it("OS normal em PRONTO com item, custo, preço e venda vinculada finaliza sem pendencia", () => {
    const resultado = avaliarFinalizacao(entradaBase());

    expect(resultado.podeFinalizar).toBe(true);
    expect(resultado.pendencias).toEqual([]);
    expect(resultado.ehResgate).toBe(false);
    expect(resultado.deveGerarTermo).toBe(true);
    expect(resultado.deveArquivar).toBe(true);
    expect(resultado.prazoGarantiaEfetivo).toBe(90);
  });

  it("usa o prazo informado quando dentro da faixa", () => {
    const resultado = avaliarFinalizacao(entradaBase({ prazoGarantiaDiasInformado: 180 }));

    expect(resultado.podeFinalizar).toBe(true);
    expect(resultado.prazoGarantiaEfetivo).toBe(180);
  });

  it("OS de retorno de garantia nao emite termo e dispensa itens, custo, preço e venda", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({
        ehRetornoGarantia: true,
        itens: [],
        possuiVendaVinculada: false,
      })
    );

    expect(resultado.podeFinalizar).toBe(true);
    expect(resultado.deveGerarTermo).toBe(false);
    expect(resultado.prazoGarantiaEfetivo).toBeNull();
  });
});

describe("regra a regra", () => {
  it("bloqueia OS excluida logicamente", () => {
    expect(codigos(entradaBase({ excluidaEm: new Date("2026-01-10T12:00:00Z") }))).toContain(
      "OS_EXCLUIDA"
    );
  });

  it("bloqueia status fora de PRONTO/ENTREGUE", () => {
    for (const status of ["AGUARDANDO_ORCAMENTO", "APROVADO", "EM_MANUTENCAO"] as const) {
      expect(codigos(entradaBase({ status }))).toContain("STATUS_INVALIDO");
    }
  });

  it("bloqueia OS normal sem nenhum item", () => {
    expect(codigos(entradaBase({ itens: [] }))).toContain("SEM_ITENS");
  });

  it("bloqueia item sem custo, item sem preço de venda, ou ambos — um por item", () => {
    const semCusto: ItemParaAvaliacaoFinalizacao = { ...ITEM_VALIDO, id: "item-2", custo: 0 };
    const semPreco: ItemParaAvaliacaoFinalizacao = { ...ITEM_VALIDO, id: "item-3", precoVenda: 0 };
    const semNada: ItemParaAvaliacaoFinalizacao = { ...ITEM_VALIDO, id: "item-4", custo: 0, precoVenda: 0 };

    const resultadoCusto = avaliarFinalizacao(entradaBase({ itens: [semCusto] }));
    expect(resultadoCusto.pendencias).toContainEqual(
      expect.objectContaining({ codigo: "ITEM_SEM_CUSTO", itemId: "item-2" })
    );
    expect(resultadoCusto.pendencias.map((p) => p.codigo)).not.toContain("ITEM_SEM_PRECO_VENDA");

    const resultadoPreco = avaliarFinalizacao(entradaBase({ itens: [semPreco] }));
    expect(resultadoPreco.pendencias).toContainEqual(
      expect.objectContaining({ codigo: "ITEM_SEM_PRECO_VENDA", itemId: "item-3" })
    );

    const resultadoAmbos = avaliarFinalizacao(entradaBase({ itens: [semNada] }));
    const codigosAmbos = resultadoAmbos.pendencias.map((p) => p.codigo);
    expect(codigosAmbos).toContain("ITEM_SEM_CUSTO");
    expect(codigosAmbos).toContain("ITEM_SEM_PRECO_VENDA");
  });

  it("valida cada item da lista, nao so o primeiro", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({
        itens: [ITEM_VALIDO, { ...ITEM_VALIDO, id: "item-2", custo: 0 }],
      })
    );

    expect(resultado.pendencias).toContainEqual(
      expect.objectContaining({ codigo: "ITEM_SEM_CUSTO", itemId: "item-2" })
    );
  });

  it("bloqueia OS normal sem pedido gerado no PDV", () => {
    expect(codigos(entradaBase({ possuiVendaVinculada: false }))).toContain("SEM_VENDA_VINCULADA");
  });

  it("bloqueia diagnostico vazio quando exigirDiagnosticoParaFinalizar", () => {
    const regras = { ...REGRAS_PADRAO, exigirDiagnosticoParaFinalizar: true };

    expect(codigos(entradaBase({ regras, observacoes: null }))).toContain("SEM_DIAGNOSTICO");
    expect(codigos(entradaBase({ regras, observacoes: "   " }))).toContain("SEM_DIAGNOSTICO");
    expect(codigos(entradaBase({ regras, observacoes: "Placa reparada." }))).not.toContain(
      "SEM_DIAGNOSTICO"
    );
  });

  it("bloqueia falta de pagamento quando permitirFinalizarSemPagamento e falso", () => {
    const regras = { ...REGRAS_PADRAO, permitirFinalizarSemPagamento: false };

    expect(codigos(entradaBase({ regras, possuiPagamentoConfirmado: false }))).toContain(
      "SEM_PAGAMENTO"
    );
    expect(codigos(entradaBase({ regras, possuiPagamentoConfirmado: true }))).not.toContain(
      "SEM_PAGAMENTO"
    );
  });

  it("bloqueia prazo de garantia fora da faixa configurada", () => {
    expect(codigos(entradaBase({ prazoGarantiaDiasInformado: 0 }))).toContain(
      "PRAZO_GARANTIA_INVALIDO"
    );
    expect(codigos(entradaBase({ prazoGarantiaDiasInformado: 400 }))).toContain(
      "PRAZO_GARANTIA_INVALIDO"
    );
    expect(codigos(entradaBase({ prazoGarantiaDiasInformado: 30.5 }))).toContain(
      "PRAZO_GARANTIA_INVALIDO"
    );
  });

  it("aceita os extremos da faixa", () => {
    expect(avaliarFinalizacao(entradaBase({ prazoGarantiaDiasInformado: 1 })).podeFinalizar).toBe(
      true
    );
    expect(avaliarFinalizacao(entradaBase({ prazoGarantiaDiasInformado: 365 })).podeFinalizar).toBe(
      true
    );
  });

  it("nao valida prazo quando a OS nao emite termo", () => {
    expect(
      codigos(entradaBase({ ehRetornoGarantia: true, itens: [], prazoGarantiaDiasInformado: 9999 }))
    ).not.toContain("PRAZO_GARANTIA_INVALIDO");
  });

  it("nao revalida o prazo quando o termo ja existe", () => {
    expect(
      codigos(entradaBase({ possuiTermoGarantia: true, prazoGarantiaDiasInformado: 9999 }))
    ).not.toContain("PRAZO_GARANTIA_INVALIDO");
  });
});

describe("pendencias simultaneas", () => {
  it("acumula todas as pendencias em vez de parar na primeira", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({
        status: "EM_MANUTENCAO",
        itens: [],
        possuiVendaVinculada: false,
        observacoes: "",
        possuiPagamentoConfirmado: false,
        prazoGarantiaDiasInformado: 9999,
        regras: {
          ...REGRAS_PADRAO,
          exigirDiagnosticoParaFinalizar: true,
          permitirFinalizarSemPagamento: false,
        },
      })
    );

    expect(resultado.podeFinalizar).toBe(false);
    expect(resultado.pendencias.map((p) => p.codigo).sort()).toEqual(
      [
        "PRAZO_GARANTIA_INVALIDO",
        "SEM_DIAGNOSTICO",
        "SEM_ITENS",
        "SEM_PAGAMENTO",
        "SEM_VENDA_VINCULADA",
        "STATUS_INVALIDO",
      ].sort()
    );
  });

  it("toda pendencia traz mensagem acionavel em pt-BR", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({ status: "APROVADO", itens: [] })
    );

    for (const pendencia of resultado.pendencias) {
      expect(pendencia.mensagem.length).toBeGreaterThan(15);
      expect(pendencia.mensagem.trim().endsWith(".")).toBe(true);
    }
  });
});

describe("caso de resgate (OS ja ENTREGUE)", () => {
  it("ENTREGUE sem termo e sem arquivamento e resgate valido", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({ status: "ENTREGUE", possuiTermoGarantia: false, archivedAt: null })
    );

    expect(resultado.podeFinalizar).toBe(true);
    expect(resultado.ehResgate).toBe(true);
    expect(resultado.deveGerarTermo).toBe(true);
    expect(resultado.deveArquivar).toBe(true);
  });

  it("ENTREGUE com termo mas sem archivedAt e resgate de arquivamento", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({ status: "ENTREGUE", possuiTermoGarantia: true, archivedAt: null })
    );

    expect(resultado.podeFinalizar).toBe(true);
    expect(resultado.ehResgate).toBe(true);
    expect(resultado.deveGerarTermo).toBe(false);
    expect(resultado.deveArquivar).toBe(true);
  });

  it("ENTREGUE arquivada mas sem termo e resgate de garantia", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({
        status: "ENTREGUE",
        possuiTermoGarantia: false,
        archivedAt: new Date("2026-02-01T10:00:00Z"),
      })
    );

    expect(resultado.podeFinalizar).toBe(true);
    expect(resultado.ehResgate).toBe(true);
    expect(resultado.deveGerarTermo).toBe(true);
    expect(resultado.deveArquivar).toBe(false);
  });

  it("ENTREGUE completa nao tem o que finalizar", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({
        status: "ENTREGUE",
        possuiTermoGarantia: true,
        archivedAt: new Date("2026-02-01T10:00:00Z"),
      })
    );

    expect(resultado.podeFinalizar).toBe(false);
    expect(resultado.ehResgate).toBe(false);
    expect(resultado.pendencias.map((p) => p.codigo)).toEqual(["JA_FINALIZADA"]);
  });

  it("OS de retorno ENTREGUE sem archivedAt tambem e resgate", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({ status: "ENTREGUE", ehRetornoGarantia: true, archivedAt: null })
    );

    expect(resultado.podeFinalizar).toBe(true);
    expect(resultado.ehResgate).toBe(true);
    expect(resultado.deveGerarTermo).toBe(false);
  });

  it("resgate ainda respeita as demais regras de negocio", () => {
    const resultado = avaliarFinalizacao(
      entradaBase({
        status: "ENTREGUE",
        possuiTermoGarantia: false,
        archivedAt: null,
        itens: [],
      })
    );

    expect(resultado.podeFinalizar).toBe(false);
    expect(resultado.pendencias.map((p) => p.codigo)).toContain("SEM_ITENS");
  });
});

describe("resumirPendencias", () => {
  it("devolve string vazia sem pendencias", () => {
    expect(resumirPendencias([])).toBe("");
  });

  it("devolve a mensagem unica quando ha so uma", () => {
    const resultado = avaliarFinalizacao(entradaBase({ itens: [] }));
    expect(resumirPendencias(resultado.pendencias)).toBe(resultado.pendencias[0].mensagem);
  });

  it("informa a quantidade quando ha varias", () => {
    const resultado = avaliarFinalizacao(entradaBase({ status: "APROVADO", itens: [] }));
    expect(resumirPendencias(resultado.pendencias)).toContain(`${resultado.pendencias.length} pendências`);
  });
});

describe("avaliarFinalizacaoSemServico", () => {
  it("permite OS PRONTO, nao excluida, sem nenhum item", () => {
    const resultado = avaliarFinalizacaoSemServico({
      status: "PRONTO",
      excluidaEm: null,
      quantidadeItens: 0,
    });

    expect(resultado.podeFinalizar).toBe(true);
  });

  it("recusa OS com item vinculado", () => {
    const resultado = avaliarFinalizacaoSemServico({
      status: "PRONTO",
      excluidaEm: null,
      quantidadeItens: 1,
    });

    expect(resultado.podeFinalizar).toBe(false);
    expect(resultado.podeFinalizar ? "" : resultado.erro).toMatch(/finalização normal/);
  });

  it("recusa OS excluida logicamente", () => {
    const resultado = avaliarFinalizacaoSemServico({
      status: "PRONTO",
      excluidaEm: new Date("2026-01-10T12:00:00Z"),
      quantidadeItens: 0,
    });

    expect(resultado.podeFinalizar).toBe(false);
  });

  it("recusa OS ja entregue", () => {
    const resultado = avaliarFinalizacaoSemServico({
      status: "ENTREGUE",
      excluidaEm: null,
      quantidadeItens: 0,
    });

    expect(resultado.podeFinalizar).toBe(false);
  });

  it("recusa OS fora de PRONTO", () => {
    const resultado = avaliarFinalizacaoSemServico({
      status: "EM_MANUTENCAO",
      excluidaEm: null,
      quantidadeItens: 0,
    });

    expect(resultado.podeFinalizar).toBe(false);
  });
});
