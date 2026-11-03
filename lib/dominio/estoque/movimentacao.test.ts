import { describe, expect, it } from "vitest";

import {
  conferirContinuidade,
  efeitoNoSaldo,
  ErroMovimentacaoEstoque,
  saldoDepois,
  tipoDaOrigem,
  validarMovimentacao,
  type OrigemMovimentacao,
} from "./movimentacao";

const TODAS_AS_ORIGENS: OrigemMovimentacao[] = [
  "VENDA_PDV",
  "PEDIDO_VENDA",
  "ESTORNO_VENDA",
  "CADASTRO",
  "AJUSTE_MANUAL",
  "COMPRA_NOTA",
  "INVENTARIO",
  "HISTORICO_RECONSTRUIDO",
];

describe("lib/dominio/estoque/movimentacao — tipo por origem", () => {
  it("toda origem tem um tipo, sem buraco", () => {
    for (const origem of TODAS_AS_ORIGENS) {
      expect(tipoDaOrigem(origem), origem).toBeDefined();
    }
  });

  it("venda tira do estoque, estorno devolve", () => {
    expect(tipoDaOrigem("VENDA_PDV")).toBe("SAIDA");
    expect(tipoDaOrigem("PEDIDO_VENDA")).toBe("SAIDA");
    expect(tipoDaOrigem("ESTORNO_VENDA")).toBe("ENTRADA");
  });

  it("compra e cadastro entram; ajuste e inventário podem ir pros dois lados", () => {
    expect(tipoDaOrigem("COMPRA_NOTA")).toBe("ENTRADA");
    expect(tipoDaOrigem("CADASTRO")).toBe("ENTRADA");
    expect(tipoDaOrigem("AJUSTE_MANUAL")).toBe("AJUSTE");
    expect(tipoDaOrigem("INVENTARIO")).toBe("AJUSTE");
  });
});

describe("lib/dominio/estoque/movimentacao — efeito no saldo", () => {
  it("saída subtrai, entrada soma", () => {
    expect(efeitoNoSaldo("SAIDA", 3)).toBe(-3);
    expect(efeitoNoSaldo("ENTRADA", 3)).toBe(3);
  });

  it("saldoDepois aplica o efeito", () => {
    expect(saldoDepois(10, "SAIDA", 3)).toBe(7);
    expect(saldoDepois(10, "ENTRADA", 3)).toBe(13);
    expect(saldoDepois(10, "SAIDA", 10)).toBe(0);
  });
});

describe("lib/dominio/estoque/movimentacao — validação", () => {
  it("quantidade é sempre positiva: negativo é erro de quem chamou", () => {
    // O sinal vem do tipo. Aceitar -3 em SAIDA daria saldo +3.
    expect(() => validarMovimentacao({ quantidade: -3, tipo: "SAIDA" })).toThrow(
      ErroMovimentacaoEstoque
    );
    expect(() => validarMovimentacao({ quantidade: 0, tipo: "ENTRADA" })).toThrow(
      ErroMovimentacaoEstoque
    );
  });

  it("quantidade fracionada é erro: estoque é peça contada", () => {
    expect(() => validarMovimentacao({ quantidade: 1.5, tipo: "SAIDA" })).toThrow(
      ErroMovimentacaoEstoque
    );
  });

  it("saída maior que o saldo é barrada, e a mensagem diz os dois números", () => {
    expect(() => saldoDepois(2, "SAIDA", 5)).toThrow(/Saída de 5 maior que o saldo de 2/);
  });

  it("sem saldo conhecido, a saída passa — é o caso do backfill", () => {
    // Linha reconstruída do histórico não sabe o saldo da época, e barrar
    // ali impediria o próprio backfill de rodar.
    expect(() => validarMovimentacao({ quantidade: 5, saldoAnterior: null, tipo: "SAIDA" })).not.toThrow();
  });
});

describe("lib/dominio/estoque/movimentacao — continuidade do livro", () => {
  it("livro coerente fecha", () => {
    const r = conferirContinuidade([
      { tipo: "ENTRADA", quantidade: 10, saldoAnterior: 0, saldoPosterior: 10 },
      { tipo: "SAIDA", quantidade: 3, saldoAnterior: 10, saldoPosterior: 7 },
      { tipo: "SAIDA", quantidade: 7, saldoAnterior: 7, saldoPosterior: 0 },
    ]);

    expect(r.fecha).toBe(true);
    expect(r.primeiraDivergencia).toBeNull();
  });

  it("pega a linha que não fecha com o próprio movimento", () => {
    const r = conferirContinuidade([
      { tipo: "ENTRADA", quantidade: 10, saldoAnterior: 0, saldoPosterior: 10 },
      // 10 − 3 = 7, não 8.
      { tipo: "SAIDA", quantidade: 3, saldoAnterior: 10, saldoPosterior: 8 },
    ]);

    expect(r.fecha).toBe(false);
    expect(r.primeiraDivergencia).toBe(1);
  });

  it("pega o salto entre uma linha e a seguinte", () => {
    // É o sintoma de alguém ter mexido no saldo SEM registrar movimento —
    // exatamente o que o livro existe pra flagrar.
    const r = conferirContinuidade([
      { tipo: "ENTRADA", quantidade: 10, saldoAnterior: 0, saldoPosterior: 10 },
      { tipo: "SAIDA", quantidade: 2, saldoAnterior: 4, saldoPosterior: 2 },
    ]);

    expect(r.fecha).toBe(false);
    expect(r.primeiraDivergencia).toBe(1);
  });

  it("linha do backfill não derruba a conferência", () => {
    const r = conferirContinuidade([
      { tipo: "SAIDA", quantidade: 4, saldoAnterior: null, saldoPosterior: null },
      { tipo: "ENTRADA", quantidade: 10, saldoAnterior: 0, saldoPosterior: 10 },
    ]);

    expect(r.fecha).toBe(true);
  });

  it("livro vazio fecha", () => {
    expect(conferirContinuidade([]).fecha).toBe(true);
  });
});
