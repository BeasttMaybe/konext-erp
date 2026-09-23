// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePagamentoPdv } from "./usar-pagamento-pdv";
import { obterDefaultsConfiguracaoPdv } from "@/lib/configuracoes-pdv";
import { formatarDecimalPtBr } from "@/lib/pdv/formatacao-pagamento-pdv";

/**
 * Regressão do bug relatado em produção: com UM pagamento já lançado
 * cobrindo o total inteiro, trocar de forma (ex.: "Dinheiro" -> "PIX")
 * ficava travado mostrando "Esta forma ja foi adicionada..." sem saída, ou
 * criava uma segunda linha zerada em vez de substituir — ver o comentário
 * em cima de `adicionarNovoPagamento` em usar-pagamento-pdv.ts. Estes
 * testes cobrem a regra corrigida de substituição/divisão e a regra de
 * foco real ao reabrir uma linha já existente numa divisão parcial
 * (requisitos 1 e 2 do bug).
 */

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function montarPagamento(overrides: Partial<Parameters<typeof usePagamentoPdv>[0]> = {}) {
  return renderHook(() =>
    usePagamentoPdv({
      total: 100,
      configuracaoPagamento: obterDefaultsConfiguracaoPdv(),
      temClienteSelecionado: true,
      tentativaVendaId: 1,
      aoConfirmar: vi.fn().mockResolvedValue({ sucesso: true }),
      aoPrecisarDeCliente: vi.fn(),
      ...overrides,
    })
  );
}

describe("usePagamentoPdv — substituição de pagamento único", () => {
  it("uma linha cobrindo o total inteiro: trocar de forma SUBSTITUI (nunca duplica), mesmo depois de outra interação ter tocado o estado", () => {
    const { result } = montarPagamento();

    const idInicial = result.current.linhas[0].id;
    expect(result.current.linhas).toHaveLength(1);
    expect(result.current.linhas[0].formaPagamento).toBe("DINHEIRO");
    expect(result.current.linhas[0].valorBruto).toBe(100);

    // Qualquer interação prévia (ex.: reabrir o editor da própria linha)
    // era o gatilho que zerava a flag "pagamento inicial automático" no
    // código antigo e quebrava a substituição a partir daqui.
    act(() => {
      result.current.abrirEditorLinha(result.current.linhas[0]);
    });

    act(() => {
      result.current.aplicarFormaRapida("PIX");
    });

    expect(result.current.linhas).toHaveLength(1);
    expect(result.current.linhas[0].formaPagamento).toBe("PIX");
    expect(result.current.linhas[0].valorBruto).toBe(100);
    // Mantém o MESMO id de linha (substituição, não recriação arbitrária).
    expect(result.current.linhas[0].id).toBe(idInicial);
  });

  it("uma linha só, já reduzida manualmente (não cobre mais o total): trocar de forma DIVIDE, com o restante na forma nova", () => {
    const { result } = montarPagamento();
    const idInicial = result.current.linhas[0].id;

    act(() => {
      result.current.atualizarValorLinha(idInicial, 60);
    });
    expect(result.current.linhas).toHaveLength(1);
    expect(result.current.linhas[0].valorBruto).toBe(60);

    act(() => {
      result.current.aplicarFormaRapida("PIX");
    });

    expect(result.current.linhas).toHaveLength(2);
    const dinheiro = result.current.linhas.find((linha) => linha.formaPagamento === "DINHEIRO");
    const pix = result.current.linhas.find((linha) => linha.formaPagamento === "PIX");
    expect(dinheiro?.valorBruto).toBe(60);
    expect(pix?.valorBruto).toBe(40);
  });

  it("pagamento misto desativado: trocar de forma sempre substitui, mesmo a linha não cobrindo o total", () => {
    const { result } = montarPagamento({
      configuracaoPagamento: { ...obterDefaultsConfiguracaoPdv(), permitirPagamentoMisto: false },
    });

    act(() => {
      result.current.aplicarFormaRapida("PIX");
    });

    expect(result.current.linhas).toHaveLength(1);
    expect(result.current.linhas[0].formaPagamento).toBe("PIX");
    expect(result.current.linhas[0].valorBruto).toBe(100);
  });
});

describe("usePagamentoPdv — foco em divisão parcial (forma já lançada)", () => {
  it("clicar numa forma já presente numa divisão parcial abre o editor DA LINHA EXISTENTE de verdade, sem duplicar e sem virar mensagem sem saída", () => {
    const { result } = montarPagamento();
    const idInicial = result.current.linhas[0].id;

    // Monta uma divisão parcial: DINHEIRO 60 + PIX 40, nenhuma cobrindo o
    // total sozinha.
    act(() => {
      result.current.atualizarValorLinha(idInicial, 60);
    });
    act(() => {
      result.current.aplicarFormaRapida("PIX");
    });
    expect(result.current.linhas).toHaveLength(2);

    const linhaDinheiro = result.current.linhas.find((linha) => linha.formaPagamento === "DINHEIRO");
    expect(linhaDinheiro).toBeDefined();

    // Clicar em "Dinheiro" de novo (forma já lançada, divisão parcial):
    // precisa abrir o editor da linha existente (mesmo caminho de
    // "Editar" — abrirEditorLinha), não só "selecionar" sem preencher o
    // valor em edição, e nunca criar uma terceira linha.
    act(() => {
      result.current.aplicarFormaRapida("DINHEIRO");
    });

    expect(result.current.linhas).toHaveLength(2);
    expect(result.current.linhaEmEdicaoId).toBe(linhaDinheiro?.id);
    expect(result.current.valoresPagamentosEmEdicao[linhaDinheiro!.id]).toBe(formatarDecimalPtBr(60));
  });
});

describe("usePagamentoPdv — remover pagamento até sobrar um", () => {
  function montarDivisaoParcial(total = 100) {
    const hook = montarPagamento({ total });
    const idInicial = hook.result.current.linhas[0].id;

    act(() => {
      hook.result.current.atualizarValorLinha(idInicial, 60);
    });
    act(() => {
      hook.result.current.aplicarFormaRapida("PIX");
    });

    return hook;
  }

  it("remover a linha não-dinheiro, sobrando dinheiro: sincroniza o valor recebido com o novo total (não fica preso no valor antigo)", () => {
    const { result } = montarDivisaoParcial();

    act(() => {
      result.current.aplicarAtalhoValorRecebido(60);
    });
    expect(result.current.valorRecebidoDinheiro).toBe(60);

    const idPix = result.current.linhas.find((linha) => linha.formaPagamento === "PIX")!.id;

    act(() => {
      result.current.removerPagamento(idPix);
    });

    expect(result.current.linhas).toHaveLength(1);
    expect(result.current.linhas[0].formaPagamento).toBe("DINHEIRO");
    expect(result.current.linhas[0].valorBruto).toBe(100);
    expect(result.current.valorRecebidoDinheiro).toBe(100);
    expect(result.current.valorRecebidoEmEdicao).toBe(formatarDecimalPtBr(100));
  });

  it("remover a linha de dinheiro, sobrando outra forma: zera o valor recebido em vez de deixar um número órfão", () => {
    const { result } = montarDivisaoParcial();

    act(() => {
      result.current.aplicarAtalhoValorRecebido(60);
    });
    expect(result.current.valorRecebidoDinheiro).toBe(60);

    const idDinheiro = result.current.linhas.find((linha) => linha.formaPagamento === "DINHEIRO")!.id;

    act(() => {
      result.current.removerPagamento(idDinheiro);
    });

    expect(result.current.linhas).toHaveLength(1);
    expect(result.current.linhas[0].formaPagamento).toBe("PIX");
    expect(result.current.linhas[0].valorBruto).toBe(100);
    expect(result.current.valorRecebidoDinheiro).toBe(0);
    expect(result.current.valorRecebidoEmEdicao).toBeNull();
  });

  it("remover uma linha limpa a entrada correspondente em valoresPagamentosEmEdicao", () => {
    const { result } = montarDivisaoParcial();
    const linhaPix = result.current.linhas.find((linha) => linha.formaPagamento === "PIX")!;

    act(() => {
      result.current.abrirEditorLinha(linhaPix);
    });
    expect(result.current.valoresPagamentosEmEdicao[linhaPix.id]).toBeDefined();

    act(() => {
      result.current.removerPagamento(linhaPix.id);
    });

    expect(result.current.valoresPagamentosEmEdicao[linhaPix.id]).toBeUndefined();
  });
});
