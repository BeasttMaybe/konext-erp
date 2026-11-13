import { afterEach, describe, expect, it, vi } from "vitest";

import {
  agoraNaLoja,
  comoDataDeCalendario,
  dataDeCalendario,
  diferencaEmDiasDeCalendario,
  diferencaEntreDatasDeCalendario,
  exigirDataDeCalendario,
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
  somarMesesEmDataDeCalendario,
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

describe("exigirDataDeCalendario — o bug do último dia do filtro", () => {
  /**
   * Sete telas montavam a data no navegador com
   * `new Date(`${texto}T12:00:00`)`. Sem sufixo de fuso, o JavaScript
   * interpreta isso no fuso de QUEM DIGITOU: em São Paulo, meio-dia local é
   * 15:00 UTC. O banco guardava 15:00 do dia 30.
   *
   * O filtro de período compara com meia-noite UTC, como manda a convenção
   * deste módulo. Então `<= 2026-11-30T00:00:00Z` deixava de fora o boleto
   * do próprio dia 30 — e só aparecia filtrando até o dia 1 do mês seguinte,
   * que foi o contorno que o dono da loja descobriu sozinho e reportou.
   *
   * Provado contra Postgres real antes de corrigir.
   */
  const FIM_DO_FILTRO = dataDeCalendario("2026-11-30")!;

  it("a data gravada entra no filtro do próprio dia", () => {
    const gravada = exigirDataDeCalendario("2026-11-30", "o vencimento");

    expect(gravada.getTime()).toBeLessThanOrEqual(FIM_DO_FILTRO.getTime());
    expect(gravada.toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });

  it("o jeito antigo cairia fora do filtro — é o bug, documentado", () => {
    // Não é como o código faz: é como ELE FAZIA. O teste existe pra que a
    // volta do padrão antigo apareça como falha, e não como "sumiu um boleto".
    const comoEraEmSaoPaulo = new Date("2026-11-30T15:00:00.000Z");

    expect(comoEraEmSaoPaulo.getTime()).toBeGreaterThan(FIM_DO_FILTRO.getTime());
  });

  it("não depende do fuso de quem digitou", () => {
    // O vencimento do dia 30 é dia 30 em Tóquio, em Lisboa e em Rio Branco.
    expect(exigirDataDeCalendario("2026-11-30", "x").toISOString()).toBe(
      "2026-11-30T00:00:00.000Z"
    );
  });

  it("o último dia de qualquer mês entra no filtro daquele mês", () => {
    for (const [ultimoDia, mes] of [
      ["2026-01-31", "janeiro"],
      ["2026-02-28", "fevereiro"],
      ["2024-02-29", "fevereiro bissexto"],
      ["2026-04-30", "abril"],
      ["2026-12-31", "dezembro"],
    ] as const) {
      const gravada = exigirDataDeCalendario(ultimoDia, "o vencimento");
      const fimDoFiltro = dataDeCalendario(ultimoDia)!;

      expect(gravada.getTime(), mes).toBeLessThanOrEqual(fimDoFiltro.getTime());
    }
  });

  it("recusa texto que não é data, com mensagem que nomeia o campo", () => {
    for (const ruim of ["", "30/11/2026", "2026-13-01", "2026-02-30", "ontem"]) {
      expect(() => exigirDataDeCalendario(ruim, "a data de vencimento"), ruim).toThrow(
        /data de vencimento/
      );
    }
  });
});

describe("somarMesesEmDataDeCalendario", () => {
  const em = (iso: string) => dataDeCalendario(iso)!;
  const iso = (data: Date) => data.toISOString().slice(0, 10);

  it("soma mês mantendo o dia", () => {
    expect(iso(somarMesesEmDataDeCalendario(em("2026-01-15"), 1))).toBe("2026-02-15");
    expect(iso(somarMesesEmDataDeCalendario(em("2026-01-15"), 11))).toBe("2026-12-15");
  });

  it("gruda no último dia do mês quando o dia não existe lá", () => {
    // É o que o banco faz com boleto, e o que se espera de uma despesa fixa
    // que vence "no dia 31".
    expect(iso(somarMesesEmDataDeCalendario(em("2026-01-31"), 1))).toBe("2026-02-28");
    expect(iso(somarMesesEmDataDeCalendario(em("2024-01-31"), 1))).toBe("2024-02-29");
    expect(iso(somarMesesEmDataDeCalendario(em("2026-03-31"), 1))).toBe("2026-04-30");
  });

  it("vira o ano", () => {
    expect(iso(somarMesesEmDataDeCalendario(em("2026-11-30"), 2))).toBe("2027-01-30");
    expect(iso(somarMesesEmDataDeCalendario(em("2026-12-31"), 1))).toBe("2027-01-31");
  });

  it("devolve meia-noite UTC — a hora é o que quebrava o filtro", () => {
    // A cópia antiga devolvia meio-dia, e aí a parcela 2 em diante ficava de
    // fora do último dia de todo filtro de período.
    for (const meses of [0, 1, 6, 12, 36]) {
      const resultado = somarMesesEmDataDeCalendario(em("2026-11-30"), meses);
      expect(resultado.toISOString(), `+${meses}`).toMatch(/T00:00:00\.000Z$/);
    }
  });

  it("aceita meses negativos", () => {
    expect(iso(somarMesesEmDataDeCalendario(em("2026-03-31"), -1))).toBe("2026-02-28");
  });

  it("não acumula desvio em doze meses seguidos", () => {
    // Gerar parcela por parcela a partir da MESMA base, nunca da anterior:
    // somar um mês doze vezes a partir de 31/01 pararia em 28/02 pra sempre.
    const base = em("2026-01-31");
    const doze = Array.from({ length: 12 }, (_, indice) =>
      iso(somarMesesEmDataDeCalendario(base, indice))
    );

    expect(doze).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30",
      "2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31",
      "2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31",
    ]);
  });
});

describe("instanteDentroDaDataDeCalendario", () => {
  it("dia 1 em UTC-3 continua no mesmo mes", async () => {
    const { instanteDentroDaDataDeCalendario, inicioDoMes, dataDeCalendario } = await import("./datas");
    const dia1 = dataDeCalendario("2026-11-01")!;
    const inicio = inicioDoMes(instanteDentroDaDataDeCalendario(dia1), "America/Sao_Paulo");
    expect(inicio.getTime()).toBe(Date.parse("2026-11-01T03:00:00.000Z"));
    // sem o ajuste, a meia-noite UTC cai em outubro
    expect(inicioDoMes(dia1, "America/Sao_Paulo").getTime()).toBe(Date.parse("2026-10-01T03:00:00.000Z"));
  });
});
