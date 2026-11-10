import { describe, expect, it } from "vitest";

import { borderosDaConta, lerBordero } from "./bordero";

/** O borderô real que o dono trouxe do Bling. */
const BORDERO_REAL = {
  data: {
    id: 24847542107,
    data: "2026-01-15",
    historico: "Ref. ao pedido de venda nº 1",
    portador: { id: 14892995029 },
    categoria: { id: 14722835335 },
    pagamentos: [
      {
        contato: { id: 17886588890 },
        numeroDocumento: "000000000",
        valorPago: 40,
        juros: 0,
        desconto: 0,
        acrescimo: 0,
        tarifa: 0,
      },
    ],
  },
};

/** O detalhe da conta que aponta para esse borderô. */
const CONTA_REAL = {
  data: {
    id: 24786292671,
    situacao: 2,
    vencimento: "2026-01-08",
    valor: 40,
    saldo: 0,
    borderos: [24847542107],
  },
};

describe("lerBordero", () => {
  it("lê a data da baixa do payload real", () => {
    const bordero = lerBordero(BORDERO_REAL);

    expect(bordero?.data.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(bordero?.valorPagoReais).toBe(40);
  });

  it("a data da baixa NÃO é o vencimento", () => {
    // A prova de que o atalho erraria: esta conta venceu em 08/01 e foi paga
    // em 15/01. Numa conta que vence dia 28 e é paga dia 3, o vencimento
    // jogaria a receita para o mês errado.
    const bordero = lerBordero(BORDERO_REAL);
    const vencimento = CONTA_REAL.data.vencimento;

    expect(bordero?.data.toISOString().slice(0, 10)).not.toBe(vencimento);
  });

  it("soma os pagamentos quando o lote tem vários", () => {
    const bordero = lerBordero({
      data: { data: "2026-02-01", pagamentos: [{ valorPago: 10 }, { valorPago: 25.5 }] },
    });

    expect(bordero?.valorPagoReais).toBe(35.5);
  });

  it("sem data, devolve null em vez de hoje", () => {
    // Cair para "hoje" colocaria uma receita antiga no mês corrente — o
    // mesmo defeito que já inflou o faturamento uma vez.
    expect(lerBordero({ data: { pagamentos: [{ valorPago: 40 }] } })).toBeNull();
    expect(lerBordero({ data: { data: "0000-00-00" } })).toBeNull();
    expect(lerBordero(null)).toBeNull();
    expect(lerBordero({})).toBeNull();
  });

  it("borderô sem pagamentos tem valor zero, e não NaN", () => {
    expect(lerBordero({ data: { data: "2026-02-01" } })?.valorPagoReais).toBe(0);
  });
});

describe("borderosDaConta", () => {
  it("lê os ids do detalhe da conta", () => {
    expect(borderosDaConta(CONTA_REAL)).toEqual(["24847542107"]);
  });

  it("conta sem borderô devolve lista vazia", () => {
    expect(borderosDaConta({ data: { id: 1 } })).toEqual([]);
    expect(borderosDaConta({ data: { borderos: [] } })).toEqual([]);
    expect(borderosDaConta(null)).toEqual([]);
  });
});
