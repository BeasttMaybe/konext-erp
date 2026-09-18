import { describe, expect, it } from "vitest";

import {
  calcularLimiteDesconto,
  converterDescontoEntreUnidades,
  formatarPercentual,
  parseEntradaPercentual,
  sanitizarEntradaPercentual,
} from "./desconto-input";

describe("sanitizarEntradaPercentual", () => {
  it("mantem so digitos e virgula", () => {
    expect(sanitizarEntradaPercentual("12abc")).toBe("12");
    expect(sanitizarEntradaPercentual("12,5")).toBe("12,5");
  });

  it("limita a 2 casas decimais", () => {
    expect(sanitizarEntradaPercentual("12,5678")).toBe("12,56");
  });

  it("aceita ponto digitado como separador de milhar sem quebrar (so remove)", () => {
    expect(sanitizarEntradaPercentual("1.234")).toBe("1234");
  });
});

describe("parseEntradaPercentual", () => {
  it("converte texto com virgula pra numero", () => {
    expect(parseEntradaPercentual("12,5")).toBe(12.5);
  });

  it("aceita ponto tambem", () => {
    expect(parseEntradaPercentual("12.5")).toBe(12.5);
  });

  it("nunca passa de 100", () => {
    expect(parseEntradaPercentual("150")).toBe(100);
  });

  it("texto vazio ou invalido vira 0", () => {
    expect(parseEntradaPercentual("")).toBe(0);
    expect(parseEntradaPercentual(",")).toBe(0);
    expect(parseEntradaPercentual("-5")).toBe(0);
  });

  it("arredonda pra 2 casas decimais", () => {
    expect(parseEntradaPercentual("12,3456")).toBe(12.35);
  });
});

describe("formatarPercentual", () => {
  it("formata com 2 casas e virgula", () => {
    expect(formatarPercentual(12.5)).toBe("12,50");
    expect(formatarPercentual(0)).toBe("0,00");
  });
});

describe("converterDescontoEntreUnidades", () => {
  it("de VALOR pra PERCENTUAL usa o subtotal como base", () => {
    const resultado = converterDescontoEntreUnidades({
      valor: 50,
      deUnidade: "VALOR",
      paraUnidade: "PERCENTUAL",
      subtotal: 500,
    });
    expect(resultado).toBe(10);
  });

  it("de PERCENTUAL pra VALOR usa o subtotal como base", () => {
    const resultado = converterDescontoEntreUnidades({
      valor: 10,
      deUnidade: "PERCENTUAL",
      paraUnidade: "VALOR",
      subtotal: 500,
    });
    expect(resultado).toBe(50);
  });

  it("nunca descarta o valor silenciosamente — mesma unidade devolve o mesmo valor", () => {
    expect(
      converterDescontoEntreUnidades({ valor: 25, deUnidade: "VALOR", paraUnidade: "VALOR", subtotal: 500 })
    ).toBe(25);
  });

  it("sem subtotal (carrinho vazio) zera em vez de dividir por zero", () => {
    expect(
      converterDescontoEntreUnidades({ valor: 50, deUnidade: "VALOR", paraUnidade: "PERCENTUAL", subtotal: 0 })
    ).toBe(0);
  });

  it("de VALOR pra PERCENTUAL nunca ultrapassa 100%, mesmo com desconto maior que o subtotal", () => {
    const resultado = converterDescontoEntreUnidades({
      valor: 600,
      deUnidade: "VALOR",
      paraUnidade: "PERCENTUAL",
      subtotal: 500,
    });
    expect(resultado).toBe(100);
  });
});

describe("calcularLimiteDesconto", () => {
  it("desconto em R$ e convertido pra percentual do subtotal antes de comparar", () => {
    // Subtotal 500, desconto de R$ 60 = 12% — acima de um limite de 10%.
    const resultado = calcularLimiteDesconto({
      valor: 60,
      unidade: "VALOR",
      subtotal: 500,
      limitePercentual: 10,
    });

    expect(resultado.percentualEfetivo).toBeCloseTo(12);
    expect(resultado.acimaDoLimite).toBe(true);
  });

  it("desconto em % compara direto", () => {
    const resultado = calcularLimiteDesconto({
      valor: 15,
      unidade: "PERCENTUAL",
      subtotal: 500,
      limitePercentual: 10,
    });

    expect(resultado.percentualEfetivo).toBeCloseTo(15);
    expect(resultado.acimaDoLimite).toBe(true);
  });

  it("dentro do limite, nas duas unidades", () => {
    const emReais = calcularLimiteDesconto({ valor: 40, unidade: "VALOR", subtotal: 500, limitePercentual: 10 });
    const emPercentual = calcularLimiteDesconto({ valor: 8, unidade: "PERCENTUAL", subtotal: 500, limitePercentual: 10 });

    expect(emReais.acimaDoLimite).toBe(false);
    expect(emPercentual.acimaDoLimite).toBe(false);
  });

  it("exatamente no limite nao acusa excesso (folga de arredondamento, igual ao servidor)", () => {
    const resultado = calcularLimiteDesconto({ valor: 50, unidade: "VALOR", subtotal: 500, limitePercentual: 10 });
    expect(resultado.acimaDoLimite).toBe(false);
  });

  it("calcula o limite em reais pro subtotal atual", () => {
    const resultado = calcularLimiteDesconto({ valor: 0, unidade: "VALOR", subtotal: 34.9, limitePercentual: 10 });
    expect(resultado.limiteReais).toBeCloseTo(3.49);
  });

  it("carrinho vazio nunca acusa excesso", () => {
    const resultado = calcularLimiteDesconto({ valor: 0, unidade: "PERCENTUAL", subtotal: 0, limitePercentual: 10 });
    expect(resultado.acimaDoLimite).toBe(false);
    expect(resultado.limiteReais).toBe(0);
  });
});
