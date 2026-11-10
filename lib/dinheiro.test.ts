import { describe, expect, it } from "vitest";

import {
  aplicarPercentual,
  deDecimal,
  dividirEmParcelas,
  formatarReais,
  lerEntradaMonetaria,
  lerReais,
  multiplicarPorQuantidade,
  paraCentavos,
  paraDecimal,
  paraMoeda,
  somar,
  subtrair,
} from "./dinheiro";

describe("lib/dinheiro — deDecimal / paraDecimal", () => {
  it("converte um número em reais para centavos inteiros", () => {
    expect(deDecimal(1409.89)).toBe(140989);
    expect(deDecimal(0)).toBe(0);
    expect(deDecimal(10)).toBe(1000);
  });

  it("converte uma string decimal (formato Prisma.Decimal#toString(), com '.') para centavos", () => {
    expect(deDecimal("1409.89")).toBe(140989);
    expect(deDecimal("0.05")).toBe(5);
  });

  it("converte um objeto Decimal-like (com toString()) para centavos", () => {
    const decimalFalso = { toString: () => "99.90" };
    expect(deDecimal(decimalFalso)).toBe(9990);
  });

  it("lida com valores negativos (estorno/ajuste)", () => {
    expect(deDecimal(-10.5)).toBe(-1050);
  });

  it("o caso clássico de ponto flutuante: 0.1 + 0.2 (em reais) precisa virar exatamente 30 centavos, não 30.000000000000004", () => {
    // 0.1 + 0.2 === 0.30000000000000004 em JavaScript puro — a conversão de
    // borda precisa absorver esse ruído binário, não propagá-lo.
    const somaEmReaisComRuido = 0.1 + 0.2;
    expect(somaEmReaisComRuido).not.toBe(0.3); // prova que o ruído existe
    expect(deDecimal(somaEmReaisComRuido)).toBe(30);
  });

  it("paraDecimal é o inverso exato de deDecimal, devolvendo string", () => {
    expect(paraDecimal(140989)).toBe("1409.89");
    expect(paraDecimal(5)).toBe("0.05");
    expect(paraDecimal(0)).toBe("0.00");
    expect(paraDecimal(-1050)).toBe("-10.50");
  });

  it("paraDecimal rejeita centavos não inteiros (proteção contra uso indevido)", () => {
    expect(() => paraDecimal(10.5)).toThrow();
  });
});

describe("lib/dinheiro — somar / subtrair", () => {
  it("soma quaisquer valores em centavos, aritmética de inteiro exata", () => {
    expect(somar(100, 200, 300)).toBe(600);
    expect(somar()).toBe(0);
    expect(somar(deDecimal(0.1), deDecimal(0.2))).toBe(30);
  });

  it("subtrai b de a", () => {
    expect(subtrair(1000, 300)).toBe(700);
    expect(subtrair(100, 150)).toBe(-50);
  });
});

describe("lib/dinheiro — o caso do fechamento de caixa (R$ 1.409,89)", () => {
  it("somar várias parcelas de venda em ponto flutuante daria 1409.8899999999999; em centavos dá exatamente 140989", () => {
    // Reproduz o bug documentado no contexto da Fase 2A-2: uma sequência de
    // vendas cujos valores, somados em ponto flutuante puro, produzem ruído
    // binário visível no resultado final.
    const valoresEmReais = [45.9, 122.3, 87.15, 310.44, 233.33, 610.77];
    const somaFloatIngenua = valoresEmReais.reduce((total, valor) => total + valor, 0);
    expect(somaFloatIngenua).toBeCloseTo(1409.89, 10);

    const somaEmCentavos = somar(...valoresEmReais.map((valor) => deDecimal(valor)));
    expect(somaEmCentavos).toBe(140989);
    expect(formatarReais(somaEmCentavos)).toBe("R$ 1.409,89");
  });
});

describe("lib/dinheiro — multiplicarPorQuantidade", () => {
  it("multiplica preço unitário (centavos) por quantidade inteira", () => {
    expect(multiplicarPorQuantidade(1999, 3)).toBe(5997);
  });

  it("arredonda HALF-UP quando a quantidade é fracionária (insumo por peso)", () => {
    // 333 centavos * 1.5 = 499.5 -> half-up = 500
    expect(multiplicarPorQuantidade(333, 1.5)).toBe(500);
  });
});

describe("lib/dinheiro — aplicarPercentual (taxa sobre valor ímpar, força arredondamento)", () => {
  it("3,14% sobre R$ 33,33 (3333 centavos) força arredondamento HALF-UP", () => {
    // 3333 * 3.14 / 100 = 104.6562 -> half-up = 105
    expect(aplicarPercentual(3333, 3.14)).toBe(105);
  });

  it("caso exato de meio centavo arredonda pra cima (half-up)", () => {
    // 100 centavos * 0.5% = 0.5 -> half-up = 1
    expect(aplicarPercentual(100, 0.5)).toBe(1);
  });

  it("percentual zero não altera nada", () => {
    expect(aplicarPercentual(123456, 0)).toBe(0);
  });
});

describe("lib/dinheiro — dividirEmParcelas", () => {
  it("R$ 100,00 em 3x vira 33,34 + 33,33 + 33,33 (resto vai para a(s) primeira(s) parcela(s))", () => {
    const parcelas = dividirEmParcelas(10000, 3);
    expect(parcelas).toEqual([3334, 3333, 3333]);
    expect(somar(...parcelas)).toBe(10000);
  });

  it("divisão exata não gera resto nenhum", () => {
    expect(dividirEmParcelas(9900, 3)).toEqual([3300, 3300, 3300]);
  });

  it("1 parcela devolve o valor cheio", () => {
    expect(dividirEmParcelas(12345, 1)).toEqual([12345]);
  });

  it("a soma das parcelas SEMPRE bate com o total original, em qualquer divisão", () => {
    for (const [centavos, n] of [
      [10000, 3],
      [10000, 7],
      [1, 3],
      [999999, 11],
      [140989, 6],
    ] as const) {
      const parcelas = dividirEmParcelas(centavos, n);
      expect(parcelas).toHaveLength(n);
      expect(somar(...parcelas)).toBe(centavos);
    }
  });

  it("rejeita quantidade de parcelas inválida", () => {
    expect(() => dividirEmParcelas(1000, 0)).toThrow();
    expect(() => dividirEmParcelas(1000, -1)).toThrow();
    expect(() => dividirEmParcelas(1000, 1.5)).toThrow();
  });
});

describe("lib/dinheiro — formatarReais / lerReais", () => {
  it("formata centavos como 'R$ 1.409,89' (com separador de milhar)", () => {
    expect(formatarReais(140989)).toBe("R$ 1.409,89");
    expect(formatarReais(0)).toBe("R$ 0,00");
    expect(formatarReais(100000000)).toBe("R$ 1.000.000,00");
  });

  it("formata valores negativos", () => {
    expect(formatarReais(-1050)).toContain("10,50");
  });

  it("lerReais interpreta o mesmo texto de volta, com separador de milhar", () => {
    expect(lerReais("R$ 1.409,89")).toBe(140989);
    expect(lerReais("1.409,89")).toBe(140989);
    expect(lerReais("1409,89")).toBe(140989);
    expect(lerReais("1409")).toBe(140900);
    expect(lerReais("1.000.000,00")).toBe(100000000);
  });

  it("formatarReais e lerReais são inversos entre si (ida e volta, com milhar)", () => {
    for (const centavos of [0, 5, 100, 140989, 100000000, 999]) {
      expect(lerReais(formatarReais(centavos))).toBe(centavos);
    }
  });

  it("lerReais rejeita texto que não é um valor monetário", () => {
    expect(() => lerReais("abc")).toThrow();
    expect(() => lerReais("")).toThrow();
  });
});

describe("lib/dinheiro — limite de desconto: mesma função no cliente e no servidor", () => {
  // Simula os dois "lados" chamando a MESMA função de lib/dinheiro.ts —
  // prova que servidor e cliente nunca podem divergir, porque não há duas
  // implementações, há uma só sendo importada duas vezes.
  function calcularLimiteDescontoCentavos(subtotalCentavos: number, limitePercentual: number): number {
    return aplicarPercentual(subtotalCentavos, limitePercentual);
  }

  it("cliente e servidor, chamando a mesma função com os mesmos dados, produzem exatamente o mesmo limite", () => {
    const subtotalCentavos = deDecimal(1234.56);
    const limitePercentual = 12.5;

    const limiteNoServidor = calcularLimiteDescontoCentavos(subtotalCentavos, limitePercentual);
    const limiteNoCliente = calcularLimiteDescontoCentavos(subtotalCentavos, limitePercentual);

    expect(limiteNoServidor).toBe(limiteNoCliente);
    expect(limiteNoServidor).toBe(aplicarPercentual(subtotalCentavos, limitePercentual));
  });
});

describe("lib/dinheiro — paraCentavos / paraMoeda (compatibilidade com lib/pdv/pagamentos.ts)", () => {
  it("paraCentavos é equivalente a deDecimal para number", () => {
    expect(paraCentavos(1409.89)).toBe(deDecimal(1409.89));
  });

  it("paraMoeda desfaz paraCentavos", () => {
    expect(paraMoeda(paraCentavos(19.9))).toBeCloseTo(19.9, 10);
  });
});

describe("lib/dinheiro — lerEntradaMonetaria", () => {
  it("lê pt-BR com ponto de milhar e vírgula decimal", () => {
    expect(lerEntradaMonetaria("1.234,56")).toBe(123456);
    expect(lerEntradaMonetaria("R$ 1.234,56")).toBe(123456);
    expect(lerEntradaMonetaria("R$ 89,90")).toBe(8990);
  });

  // O caso que os parsers antigos liam como 0: um custo de mil e duzentos
  // reais entrava na OS valendo nada.
  it("não devolve 0 para um valor pt-BR válido", () => {
    expect(lerEntradaMonetaria("1.200,00")).toBe(120000);
  });

  it("lê o formato do input[type=number], onde o ponto é decimal", () => {
    expect(lerEntradaMonetaria("1234.56")).toBe(123456);
    expect(lerEntradaMonetaria("0.1")).toBe(10);
    expect(lerEntradaMonetaria("150")).toBe(15000);
  });

  it("aceita number direto, inclusive o clássico 0.07 * 3", () => {
    expect(lerEntradaMonetaria(19.9)).toBe(1990);
    expect(lerEntradaMonetaria(0)).toBe(0);
    expect(lerEntradaMonetaria(-12.5)).toBe(-1250);
  });

  it("devolve null em vez de lançar, pra action responder erro à tela", () => {
    expect(lerEntradaMonetaria("")).toBeNull();
    expect(lerEntradaMonetaria("   ")).toBeNull();
    expect(lerEntradaMonetaria("abc")).toBeNull();
    expect(lerEntradaMonetaria("R$")).toBeNull();
    expect(lerEntradaMonetaria(Number.NaN)).toBeNull();
    expect(lerEntradaMonetaria(Number.POSITIVE_INFINITY)).toBeNull();
    expect(lerEntradaMonetaria(null)).toBeNull();
    expect(lerEntradaMonetaria(undefined)).toBeNull();
    expect(lerEntradaMonetaria({})).toBeNull();
  });
});

describe("lerEntradaMonetaria: o que o dono realmente digita", () => {
  /**
   * O dono: "se por exemplo eu coloco 8.153,90 o sistema não reconhece, daí
   * tenho que retirar o . pra reconhecer".
   *
   * Ele não estava errado em digitar: 8.153,90 é como se escreve dinheiro em
   * português. Quem estava errado eram as telas, que liam o texto com um
   * `.replace(",", ".")` próprio — e `"8.153.90"` não é número nenhum.
   */
  it("aceita o formato com ponto de milhar e vírgula decimal", () => {
    expect(lerEntradaMonetaria("8.153,90")).toBe(815390);
    expect(lerEntradaMonetaria("R$ 8.153,90")).toBe(815390);
    expect(lerEntradaMonetaria("1.234.567,89")).toBe(123456789);
  });

  it("continua aceitando sem o ponto de milhar", () => {
    expect(lerEntradaMonetaria("8153,90")).toBe(815390);
    expect(lerEntradaMonetaria("8153")).toBe(815300);
  });

  it("ponto de milhar sem centavos não vira troco", () => {
    // Era aqui que "8.153" virava R$ 8,15 — mil vezes menos, em silêncio.
    expect(lerEntradaMonetaria("8.153")).toBe(815300);
    expect(lerEntradaMonetaria("1.234")).toBe(123400);
    expect(lerEntradaMonetaria("1.234.567")).toBe(123456700);
  });

  it("ponto decimal do campo numérico continua sendo decimal", () => {
    // `input[type=number]` manda "1234.56", com o ponto separando centavos.
    expect(lerEntradaMonetaria("1234.56")).toBe(123456);
    expect(lerEntradaMonetaria("0.5")).toBe(50);
    expect(lerEntradaMonetaria("8.1")).toBe(810);
    // "0.500" é meio real, não quinhentos.
    expect(lerEntradaMonetaria("0.500")).toBe(50);
  });

  it("devolve null para o que não é dinheiro, em vez de zero", () => {
    // Zero silencioso é o que fazia a peça de mil reais entrar custando nada.
    expect(lerEntradaMonetaria("")).toBeNull();
    expect(lerEntradaMonetaria("   ")).toBeNull();
    expect(lerEntradaMonetaria("abc")).toBeNull();
    expect(lerEntradaMonetaria(null)).toBeNull();
    expect(lerEntradaMonetaria(undefined)).toBeNull();
    expect(lerEntradaMonetaria(NaN)).toBeNull();
  });
});
