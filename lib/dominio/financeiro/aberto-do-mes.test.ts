import { describe, expect, it } from "vitest";

import { dataDeCalendario } from "@/lib/datas";

import { calcularAbertoDoMes, type ParcelaEmAberto } from "./aberto-do-mes";

const em = (iso: string) => dataDeCalendario(iso)!;

const HOJE = em("2026-11-09");
const FIM_DO_MES = em("2026-11-30");

function parcela(iso: string, centavos: number, liquidada = false): ParcelaEmAberto {
  return { dataVencimento: em(iso), valorCentavos: centavos, estaLiquidada: liquidada };
}

const calcular = (parcelas: ParcelaEmAberto[], hoje = HOJE, fim = FIM_DO_MES) =>
  calcularAbertoDoMes({ parcelas, hoje, fimDoMes: fim });

describe("aberto do mês — o defeito reportado", () => {
  it("parcela que vence depois do mês NÃO entra", () => {
    // É o defeito: o painel somava toda parcela pendente que existe, e a
    // despesa fixa mensal mantém doze meses materializados à frente. Um ano
    // de aluguel aparecia como dívida do mês.
    const resultado = calcular([
      parcela("2026-11-05", 150_000),
      parcela("2026-12-05", 150_000),
      parcela("2027-01-05", 150_000),
      parcela("2027-02-05", 150_000),
    ]);

    expect(resultado.totalCentavos).toBe(150_000);
  });

  it("um ano de despesa fixa não vira dívida do mês", () => {
    const umAno = Array.from({ length: 13 }, (_, indice) => {
      const mes = 11 + indice;
      const ano = mes > 12 ? 2027 : 2026;
      const mesNormalizado = mes > 12 ? mes - 12 : mes;
      return parcela(`${ano}-${String(mesNormalizado).padStart(2, "0")}-10`, 500_000);
    });

    expect(calcular(umAno).totalCentavos).toBe(500_000);
  });
});

describe("aberto do mês — o que entra", () => {
  it("soma o que vence dentro do mês e ainda não foi pago", () => {
    const resultado = calcular([
      parcela("2026-11-10", 10_000),
      parcela("2026-11-25", 5_000),
    ]);

    expect(resultado.totalCentavos).toBe(15_000);
    expect(resultado.atrasadoCentavos).toBe(0);
  });

  it("ATRASADO de meses anteriores entra, porque atraso é dívida de agora", () => {
    // Não deixa de ser devido por ter vencido em setembro.
    const resultado = calcular([
      parcela("2026-09-10", 20_000),
      parcela("2026-11-20", 10_000),
    ]);

    expect(resultado.totalCentavos).toBe(30_000);
    expect(resultado.atrasadoCentavos).toBe(20_000);
  });

  it("parcela liquidada não conta, mesmo vencendo no mês", () => {
    const resultado = calcular([
      parcela("2026-11-10", 10_000, true),
      parcela("2026-11-11", 3_000),
    ]);

    expect(resultado.totalCentavos).toBe(3_000);
  });

  it("parcela liquidada e atrasada também não conta", () => {
    expect(calcular([parcela("2026-09-10", 99_000, true)])).toEqual({
      totalCentavos: 0,
      atrasadoCentavos: 0,
    });
  });
});

describe("aberto do mês — as bordas de data", () => {
  it("o que vence HOJE entra no total e não conta como atraso", () => {
    const resultado = calcular([parcela("2026-11-09", 7_000)]);

    expect(resultado.totalCentavos).toBe(7_000);
    expect(resultado.atrasadoCentavos).toBe(0);
  });

  it("o que vence ONTEM é atraso", () => {
    const resultado = calcular([parcela("2026-11-08", 7_000)]);

    expect(resultado.atrasadoCentavos).toBe(7_000);
  });

  it("o ÚLTIMO dia do mês entra; o primeiro do seguinte não", () => {
    // A borda que decide se o painel conta um mês ou treze.
    expect(calcular([parcela("2026-11-30", 1_000)]).totalCentavos).toBe(1_000);
    expect(calcular([parcela("2026-12-01", 1_000)]).totalCentavos).toBe(0);
  });

  it("funciona na virada do ano", () => {
    const resultado = calcular(
      [parcela("2026-12-31", 4_000), parcela("2027-01-01", 9_000)],
      em("2026-12-15"),
      em("2026-12-31")
    );

    expect(resultado.totalCentavos).toBe(4_000);
  });

  it("em fevereiro, o dia 28 ou 29 é o fim", () => {
    expect(
      calcular([parcela("2024-02-29", 2_000)], em("2024-02-01"), em("2024-02-29")).totalCentavos
    ).toBe(2_000);
  });
});

describe("aberto do mês — bordas", () => {
  it("lista vazia dá zero, não NaN", () => {
    expect(calcular([])).toEqual({ totalCentavos: 0, atrasadoCentavos: 0 });
  });

  it("tudo liquidado dá zero", () => {
    expect(
      calcular([parcela("2026-11-01", 5_000, true), parcela("2026-11-02", 5_000, true)])
    ).toEqual({ totalCentavos: 0, atrasadoCentavos: 0 });
  });

  it("o atrasado nunca passa do total", () => {
    const resultado = calcular([
      parcela("2026-09-01", 10_000),
      parcela("2026-11-20", 10_000),
      parcela("2026-12-20", 10_000),
    ]);

    expect(resultado.atrasadoCentavos).toBeLessThanOrEqual(resultado.totalCentavos);
  });
});
