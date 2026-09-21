import { afterEach, describe, expect, it, vi } from "vitest";

import {
  agoraNaLoja,
  comoDataDeCalendario,
  dataDeCalendario,
  diferencaEmDiasDeCalendario,
  diferencaEntreDatasDeCalendario,
  fimDaSemana,
  fimDoDia,
  fimDoMes,
  hojeComoDataDeCalendario,
  inicioDaSemana,
  inicioDoDia,
  inicioDoMes,
  mesmoDia,
  somarDias,
  somarDiasEmDataDeCalendario,
} from "./datas";

const FUSO_LOJA = "America/Sao_Paulo";

describe("lib/datas — fronteiras no fuso da loja", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('às 22:30 no horário local do dia D, "hoje" é D, não D+1', () => {
    // 22:30 de 14/01/2026 em America/Sao_Paulo (UTC-3) é 01:30 UTC de 15/01 —
    // o processo (UTC, ex. Vercel) já está no dia seguinte.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T01:30:00.000Z"));

    const agora = agoraNaLoja(FUSO_LOJA);
    expect(agora.getFullYear()).toBe(2026);
    expect(agora.getMonth()).toBe(0); // janeiro
    expect(agora.getDate()).toBe(14);

    // TZDate#toISOString() imprime com o offset da loja (-03:00), não "Z" —
    // comparar por instante (getTime()) é agnóstico ao formato de exibição.
    const inicio = inicioDoDia(new Date(), FUSO_LOJA);
    expect(inicio.getTime()).toBe(new Date("2026-01-14T03:00:00.000Z").getTime());

    const fim = fimDoDia(new Date(), FUSO_LOJA);
    expect(fim.getTime()).toBe(new Date("2026-01-15T02:59:59.999Z").getTime());
  });

  it("o último dia de um mês depois das 21h continua no mesmo mês", () => {
    // 22:00 de 31/01/2026 em America/Sao_Paulo é 01:00 UTC de 01/02 — o
    // processo já mudou de mês em UTC, a loja ainda não.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T01:00:00.000Z"));

    const agora = agoraNaLoja(FUSO_LOJA);
    expect(agora.getMonth()).toBe(0); // ainda janeiro, no fuso da loja
    expect(agora.getDate()).toBe(31);

    const inicioMes = inicioDoMes(new Date(), FUSO_LOJA);
    expect(inicioMes.getTime()).toBe(new Date("2026-01-01T03:00:00.000Z").getTime());

    const fimMes = fimDoMes(new Date(), FUSO_LOJA);
    // Último instante de 31/01 no fuso da loja = 01/02 02:59:59.999 UTC.
    expect(fimMes.getTime()).toBe(new Date("2026-02-01T02:59:59.999Z").getTime());
  });

  it("semana começa no domingo, não segunda", () => {
    // 14/01/2026 é uma quarta-feira; o domingo daquela semana é 11/01.
    const quarta = new Date("2026-01-14T15:00:00.000Z");

    const inicio = inicioDaSemana(quarta, FUSO_LOJA);
    expect(inicio.getDay()).toBe(0); // domingo
    expect(inicio.getDate()).toBe(11);
    expect(inicio.getMonth()).toBe(0);

    const fim = fimDaSemana(quarta, FUSO_LOJA);
    expect(fim.getDay()).toBe(6); // sábado
    expect(fim.getDate()).toBe(17);
  });

  it("uma data de calendário (vencimento) nunca desloca um dia ao passar pelas novas funções", () => {
    const vencimento = dataDeCalendario("2026-01-15");
    expect(vencimento).not.toBeNull();
    expect(vencimento!.toISOString()).toBe("2026-01-15T00:00:00.000Z");

    // Somar/subtrair dias numa data de calendário nunca sai da meia-noite UTC.
    const maisDez = somarDiasEmDataDeCalendario(vencimento!, 10);
    expect(maisDez.toISOString()).toBe("2026-01-25T00:00:00.000Z");

    // Diferença entre duas datas de calendário é exata, em dias inteiros.
    expect(diferencaEntreDatasDeCalendario(vencimento!, maisDez)).toBe(10);

    // dataDeCalendario rejeita datas inválidas (ex.: 31 de fevereiro) em vez
    // de "corrigir" silenciosamente para março.
    expect(dataDeCalendario("2026-02-31")).toBeNull();
    expect(dataDeCalendario("não é uma data")).toBeNull();
  });

  it("comoDataDeCalendario resolve o dia certo no fuso da loja antes de ancorar em UTC", () => {
    vi.useFakeTimers();
    // 22:30 de 14/01/2026 na loja (America/Sao_Paulo) = 01:30 UTC de 15/01.
    vi.setSystemTime(new Date("2026-01-15T01:30:00.000Z"));

    const hoje = hojeComoDataDeCalendario(FUSO_LOJA);
    // "Hoje" pra loja ainda é 14/01, representado como meia-noite UTC — não
    // 15/01 (o dia do processo) nem 14/01T03:00Z (meia-noite local como
    // instante, que é a armadilha que esta função existe pra evitar).
    expect(hoje.toISOString()).toBe("2026-01-14T00:00:00.000Z");

    expect(comoDataDeCalendario(new Date(), FUSO_LOJA).toISOString()).toBe(hoje.toISOString());
  });

  it("mesmoDia compara dois instantes no fuso da loja, não no fuso do processo", () => {
    // 23:00 de 14/01 na loja e 01:00 de 15/01 na loja são dias diferentes;
    // ambos caem no mesmo dia UTC (15/01) se comparados sem fuso.
    const instanteA = new Date("2026-01-15T02:00:00.000Z"); // 23:00 -03:00 do dia 14
    const instanteB = new Date("2026-01-15T04:00:00.000Z"); // 01:00 -03:00 do dia 15

    expect(mesmoDia(instanteA, instanteB, FUSO_LOJA)).toBe(false);
    expect(mesmoDia(instanteA, instanteA, FUSO_LOJA)).toBe(true);
  });

  it("somarDias soma dias corridos no fuso da loja", () => {
    const base = new Date("2026-01-14T03:00:00.000Z"); // 14/01 00:00 -03:00
    const maisSete = somarDias(base, 7, FUSO_LOJA);
    expect(maisSete.getTime()).toBe(new Date("2026-01-21T03:00:00.000Z").getTime());
  });

  it("diferencaEmDiasDeCalendario normaliza os dois lados pro início do dia antes de subtrair", () => {
    const inicioDoAno = new Date("2026-01-01T03:00:00.000Z"); // 01/01 00:00 -03:00
    const finalDoAno = new Date("2026-01-10T14:00:00.000Z"); // 10/01 11:00 -03:00
    expect(diferencaEmDiasDeCalendario(inicioDoAno, finalDoAno, FUSO_LOJA)).toBe(9);
  });
});
