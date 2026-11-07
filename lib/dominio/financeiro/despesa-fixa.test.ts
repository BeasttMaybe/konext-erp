import { describe, expect, it } from "vitest";

import { dataDeCalendario } from "@/lib/datas";

import {
  HORIZONTE_DE_MESES_DA_DESPESA_FIXA,
  parcelasFaltantesDaDespesaFixa,
} from "./despesa-fixa";

const em = (iso: string) => dataDeCalendario(iso)!;
const isoDe = (data: Date) => data.toISOString().slice(0, 10);

const HOJE = em("2026-11-07");

function faltantes(parcial: Partial<Parameters<typeof parcelasFaltantesDaDespesaFixa>[0]> = {}) {
  return parcelasFaltantesDaDespesaFixa({
    primeiroVencimento: em("2026-11-10"),
    ultimoNumeroParcelaExistente: 0,
    hoje: HOJE,
    encerradaEm: null,
    ...parcial,
  });
}

describe("despesa fixa mensal — o bug reportado", () => {
  it("uma despesa nova cobre o horizonte inteiro, não um mês", () => {
    // Era isto o defeito: com "1" no campo de parcelas, a despesa fixa
    // existia em novembro e desaparecia em dezembro.
    const gerar = faltantes();

    // Novembro/2026 até novembro/2027: treze meses de cobertura.
    expect(gerar).toHaveLength(HORIZONTE_DE_MESES_DA_DESPESA_FIXA + 1);
    expect(isoDe(gerar[0].dataVencimento)).toBe("2026-11-10");
    expect(isoDe(gerar.at(-1)!.dataVencimento)).toBe("2027-11-10");
  });

  it("não depende de quantidade de parcelas nenhuma", () => {
    // A função não tem esse parâmetro, e é esse o ponto: despesa fixa não
    // termina porque alguém digitou um número.
    expect(faltantes()).toHaveLength(13);
  });

  it("a numeração continua de onde parou", () => {
    const gerar = faltantes({ ultimoNumeroParcelaExistente: 5 });

    expect(gerar[0].numeroParcela).toBe(6);
    expect(isoDe(gerar[0].dataVencimento)).toBe("2027-04-10");
  });
});

describe("despesa fixa — empurrar o horizonte", () => {
  it("já coberta não gera nada", () => {
    // É o caso normal, e é o que torna seguro chamar isto a cada tela que
    // abre.
    expect(faltantes({ ultimoNumeroParcelaExistente: 13 })).toEqual([]);
  });

  it("um mês depois, aparece exatamente um mês novo", () => {
    const agora = faltantes();
    const umMesDepois = faltantes({
      ultimoNumeroParcelaExistente: agora.length,
      hoje: em("2026-12-07"),
    });

    expect(umMesDepois).toHaveLength(1);
    expect(isoDe(umMesDepois[0].dataVencimento)).toBe("2027-12-10");
    expect(umMesDepois[0].numeroParcela).toBe(14);
  });

  it("despesa antiga que ficou parada recupera todos os meses de uma vez", () => {
    // Cadastrada há dois anos com 12 parcelas e esquecida: ao abrir a tela,
    // o buraco é preenchido.
    const gerar = faltantes({
      primeiroVencimento: em("2024-11-10"),
      ultimoNumeroParcelaExistente: 12,
    });

    expect(isoDe(gerar[0].dataVencimento)).toBe("2025-11-10");
    expect(isoDe(gerar.at(-1)!.dataVencimento)).toBe("2027-11-10");
    expect(gerar[0].numeroParcela).toBe(13);
  });
});

describe("despesa fixa — encerramento", () => {
  it("encerrada para de gerar na data do encerramento", () => {
    const gerar = faltantes({ encerradaEm: em("2027-02-10") });

    expect(isoDe(gerar.at(-1)!.dataVencimento)).toBe("2027-02-10");
  });

  it("encerrar não apaga o que já venceu", () => {
    // Encerrar é "não cobra mais", não "nunca existiu".
    const gerar = faltantes({
      primeiroVencimento: em("2026-01-10"),
      encerradaEm: em("2026-06-10"),
    });

    expect(isoDe(gerar[0].dataVencimento)).toBe("2026-01-10");
    expect(gerar).toHaveLength(6);
  });

  it("encerrada antes do primeiro vencimento não gera nada", () => {
    expect(faltantes({ encerradaEm: em("2026-11-01") })).toEqual([]);
  });

  it("encerramento depois do horizonte não estica o horizonte", () => {
    const gerar = faltantes({ encerradaEm: em("2040-01-01") });

    expect(gerar).toHaveLength(HORIZONTE_DE_MESES_DA_DESPESA_FIXA + 1);
  });
});

describe("despesa fixa — vencimento em dia que não existe em todo mês", () => {
  it("dia 31 gruda no último dia de cada mês, sem escorregar", () => {
    // O erro clássico: somar um mês a partir da parcela ANTERIOR faz 31/01
    // virar 28/02 e ficar preso no dia 28 pra sempre. Aqui cada vencimento
    // é derivado do primeiro.
    const gerar = faltantes({ primeiroVencimento: em("2026-01-31"), hoje: em("2026-01-01") });

    expect(gerar.slice(0, 5).map((p) => isoDe(p.dataVencimento))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("fevereiro de ano bissexto é respeitado", () => {
    const gerar = faltantes({ primeiroVencimento: em("2024-01-31"), hoje: em("2024-01-01") });

    expect(isoDe(gerar[1].dataVencimento)).toBe("2024-02-29");
  });
});

describe("despesa fixa — bordas", () => {
  it("todo vencimento sai na meia-noite UTC", () => {
    // Senão cai de novo no bug do último dia do filtro de período.
    for (const parcela of faltantes()) {
      expect(parcela.dataVencimento.toISOString()).toMatch(/T00:00:00\.000Z$/);
    }
  });

  it("ano digitado errado não gera dezenas de milhares de linhas numa tela", () => {
    const gerar = faltantes({ primeiroVencimento: em("1996-01-10") });

    expect(gerar.length).toBeLessThanOrEqual(240);
    // E não perde nada: a próxima abertura continua de onde parou.
    expect(gerar.at(-1)!.numeroParcela).toBe(240);
  });

  it("a numeração nunca tem buraco nem repetição", () => {
    const gerar = faltantes({ ultimoNumeroParcelaExistente: 5 });
    const numeros = gerar.map((p) => p.numeroParcela);

    expect(numeros).toEqual(Array.from({ length: numeros.length }, (_, i) => 6 + i));
  });
});
