import { describe, expect, it } from "vitest";

import {
  ErroCalculoVenda,
  calcularVendaPdv,
  type ItemEntradaCalculoVenda,
  type ProdutoParaCalculoVenda,
} from "./calcular-venda";

const CONFIG_PADRAO = { permitirDescontoPDV: true, descontoMaximoPDVPercentual: 10 };
const CONFIG_SEM_DESCONTO = { permitirDescontoPDV: false, descontoMaximoPDVPercentual: 10 };

function produto(overrides: Partial<ProdutoParaCalculoVenda> = {}): ProdutoParaCalculoVenda {
  return { id: "prod-1", nome: "Tela iPhone 11", precoVenda: 250, custo: 120, ...overrides };
}

describe("calcularVendaPdv — sem desconto", () => {
  it("soma preco * quantidade de cada item em centavos, ignorando qualquer valor externo", () => {
    const itens: ItemEntradaCalculoVenda[] = [
      { produto: produto({ id: "a", precoVenda: 250 }), quantidade: 2 },
      { produto: produto({ id: "b", nome: "Capinha", precoVenda: 39.9 }), quantidade: 1 },
    ];

    const resultado = calcularVendaPdv(itens, null, CONFIG_PADRAO);

    expect(resultado.subtotalBrutoCentavos).toBe(250 * 100 * 2 + 3990);
    expect(resultado.descontoCentavos).toBe(0);
    expect(resultado.totalCentavos).toBe(resultado.subtotalBrutoCentavos);
    expect(resultado.descontoAcimaDoLimite).toBe(false);
  });

  it("carrega o custo unitario real de cada item (nunca do cliente)", () => {
    const itens: ItemEntradaCalculoVenda[] = [
      { produto: produto({ custo: 87.5 }), quantidade: 3 },
    ];

    const resultado = calcularVendaPdv(itens, null, CONFIG_PADRAO);

    expect(resultado.itens[0].custoUnitarioCentavos).toBe(8750);
  });

  it("lanca ErroCalculoVenda para carrinho vazio", () => {
    expect(() => calcularVendaPdv([], null, CONFIG_PADRAO)).toThrow(ErroCalculoVenda);
  });

  it("lanca ErroCalculoVenda para quantidade invalida", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto(), quantidade: 0 }];
    expect(() => calcularVendaPdv(itens, null, CONFIG_PADRAO)).toThrow(ErroCalculoVenda);
  });
});

describe("calcularVendaPdv — desconto total", () => {
  it("aplica desconto percentual sobre o subtotal bruto", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto({ precoVenda: 100 }), quantidade: 1 }];
    const resultado = calcularVendaPdv(itens, { tipo: "PERCENTUAL", valor: 10 }, CONFIG_PADRAO);

    expect(resultado.subtotalBrutoCentavos).toBe(10000);
    expect(resultado.descontoCentavos).toBe(1000);
    expect(resultado.totalCentavos).toBe(9000);
    expect(resultado.percentualDescontoEfetivo).toBeCloseTo(10, 5);
    expect(resultado.descontoAcimaDoLimite).toBe(false);
  });

  it("aplica desconto em valor fixo (R$)", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto({ precoVenda: 100 }), quantidade: 1 }];
    const resultado = calcularVendaPdv(itens, { tipo: "VALOR", valor: 15 }, CONFIG_PADRAO);

    expect(resultado.descontoCentavos).toBe(1500);
    expect(resultado.totalCentavos).toBe(8500);
  });

  it("marca descontoAcimaDoLimite quando o percentual efetivo excede o maximo configurado", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto({ precoVenda: 100 }), quantidade: 1 }];
    const resultado = calcularVendaPdv(itens, { tipo: "PERCENTUAL", valor: 20 }, CONFIG_PADRAO);

    expect(resultado.descontoAcimaDoLimite).toBe(true);
  });

  it("nao marca descontoAcimaDoLimite quando o desconto pedido e exatamente o limite", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto({ precoVenda: 100 }), quantidade: 1 }];
    const resultado = calcularVendaPdv(itens, { tipo: "PERCENTUAL", valor: 10 }, CONFIG_PADRAO);

    expect(resultado.descontoAcimaDoLimite).toBe(false);
  });

  it("nunca deixa o desconto em valor fixo levar o total abaixo de zero", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto({ precoVenda: 50 }), quantidade: 1 }];
    const resultado = calcularVendaPdv(itens, { tipo: "VALOR", valor: 999 }, CONFIG_PADRAO);

    expect(resultado.totalCentavos).toBe(0);
    expect(resultado.descontoCentavos).toBe(5000);
  });

  it("lanca ErroCalculoVenda para desconto percentual acima de 100%", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto(), quantidade: 1 }];
    expect(() => calcularVendaPdv(itens, { tipo: "PERCENTUAL", valor: 150 }, CONFIG_PADRAO)).toThrow(
      ErroCalculoVenda
    );
  });

  it("lanca ErroCalculoVenda quando ha desconto pedido mas permitirDescontoPDV esta desligado", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto(), quantidade: 1 }];
    expect(() =>
      calcularVendaPdv(itens, { tipo: "VALOR", valor: 10 }, CONFIG_SEM_DESCONTO)
    ).toThrow(ErroCalculoVenda);
  });

  it("nao exige permitirDescontoPDV quando nenhum desconto e pedido", () => {
    const itens: ItemEntradaCalculoVenda[] = [{ produto: produto(), quantidade: 1 }];
    expect(() => calcularVendaPdv(itens, null, CONFIG_SEM_DESCONTO)).not.toThrow();
  });
});

describe("calcularVendaPdv — desconto por item", () => {
  it("aplica desconto em um item especifico sem afetar os demais", () => {
    const itens: ItemEntradaCalculoVenda[] = [
      { produto: produto({ id: "a", precoVenda: 100 }), quantidade: 1, desconto: { tipo: "VALOR", valor: 20 } },
      { produto: produto({ id: "b", precoVenda: 50 }), quantidade: 1 },
    ];

    const resultado = calcularVendaPdv(itens, null, CONFIG_PADRAO);

    expect(resultado.itens[0].descontoCentavos).toBe(2000);
    expect(resultado.itens[0].subtotalLiquidoCentavos).toBe(8000);
    expect(resultado.itens[1].descontoCentavos).toBe(0);
    expect(resultado.totalCentavos).toBe(8000 + 5000);
  });

  it("combina desconto por item com desconto total, aplicado sobre o restante", () => {
    const itens: ItemEntradaCalculoVenda[] = [
      { produto: produto({ id: "a", precoVenda: 100 }), quantidade: 1, desconto: { tipo: "VALOR", valor: 10 } },
    ];

    const resultado = calcularVendaPdv(itens, { tipo: "PERCENTUAL", valor: 10 }, CONFIG_PADRAO);

    // subtotal bruto 100 -> desconto item 10 -> base para desconto total 90 -> desconto total 10% de 90 = 9
    expect(resultado.descontoCentavos).toBe(1000 + 900);
    expect(resultado.totalCentavos).toBe(10000 - 1000 - 900);
  });
});
