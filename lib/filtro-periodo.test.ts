import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aplicarMascaraDataDigitada,
  calcularIntervaloMesEspecifico,
  calcularPresetEstaSemana,
  calcularPresetEsteMes,
  calcularPresetHoje,
  calcularPresetMesPassado,
  calcularPresetSemanaPassada,
  deSearchParams,
  formatarDataExibicao,
  formatarRotuloIntervalo,
  identificarMesEspecifico,
  identificarPresetAtivo,
  interpretarDataDigitada,
  mesDeCalendarioAnterior,
  mesDeCalendarioAtual,
  mesDeCalendarioSeguinte,
  paraSearchParams,
  validarIntervalo,
} from "./filtro-periodo";

const FUSO_LOJA = "America/Sao_Paulo";

/** 22:30 no horário local (America/Sao_Paulo, UTC-3) do dia 14/01/2026 é 01:30 UTC de 15/01 — o processo (Vercel, UTC) já está no dia seguinte. Toda a suíte roda com o relógio parado aqui, exatamente pra pegar esse caso de fronteira. */
function fixarRelogioAs2230DoDia14() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T01:30:00.000Z"));
}

describe("lib/filtro-periodo — presets, calculados às 22:30 no horário local", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('"Hoje" é o dia 14 (fuso da loja), não o 15 (fuso do processo)', () => {
    fixarRelogioAs2230DoDia14();

    const { inicio, fim } = calcularPresetHoje(FUSO_LOJA);
    expect(inicio.toISOString()).toBe("2026-01-14T00:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-01-14T00:00:00.000Z");
  });

  it('"Esta semana" (domingo a sábado) contém o dia 14, não desliza pro dia 15', () => {
    fixarRelogioAs2230DoDia14();

    // 14/01/2026 é quarta-feira; domingo daquela semana é 11/01, sábado é 17/01.
    const { inicio, fim } = calcularPresetEstaSemana(FUSO_LOJA);
    expect(inicio.toISOString()).toBe("2026-01-11T00:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-01-17T00:00:00.000Z");
  });

  it('"Semana passada" é a semana anterior à que contém o dia 14', () => {
    fixarRelogioAs2230DoDia14();

    const { inicio, fim } = calcularPresetSemanaPassada(FUSO_LOJA);
    expect(inicio.toISOString()).toBe("2026-01-04T00:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-01-10T00:00:00.000Z");
  });

  it('"Este mês" é janeiro inteiro, mesmo às 22:30 do último instante do dia 14', () => {
    fixarRelogioAs2230DoDia14();

    const { inicio, fim } = calcularPresetEsteMes(FUSO_LOJA);
    expect(inicio.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it('"Este mês" na virada do mês (22:00 do dia 31/01) continua janeiro, não fevereiro', () => {
    // 22:00 de 31/01/2026 em America/Sao_Paulo é 01:00 UTC de 01/02 — o
    // processo já mudou de mês em UTC, a loja ainda não.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T01:00:00.000Z"));

    const { inicio, fim } = calcularPresetEsteMes(FUSO_LOJA);
    expect(inicio.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-01-31T00:00:00.000Z");

    expect(calcularPresetHoje(FUSO_LOJA).inicio.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it('"Mês passado" é dezembro/2025 quando "hoje" é janeiro/2026', () => {
    fixarRelogioAs2230DoDia14();

    const { inicio, fim } = calcularPresetMesPassado(FUSO_LOJA);
    expect(inicio.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(fim.toISOString()).toBe("2025-12-31T00:00:00.000Z");
  });

  it("identificarPresetAtivo reconhece cada preset computado, e só esses", () => {
    fixarRelogioAs2230DoDia14();

    expect(identificarPresetAtivo(calcularPresetHoje(FUSO_LOJA), FUSO_LOJA)).toBe("hoje");
    expect(identificarPresetAtivo(calcularPresetEstaSemana(FUSO_LOJA), FUSO_LOJA)).toBe("esta-semana");
    expect(identificarPresetAtivo(calcularPresetSemanaPassada(FUSO_LOJA), FUSO_LOJA)).toBe(
      "semana-passada"
    );
    expect(identificarPresetAtivo(calcularPresetEsteMes(FUSO_LOJA), FUSO_LOJA)).toBe("este-mes");
    expect(identificarPresetAtivo(calcularPresetMesPassado(FUSO_LOJA), FUSO_LOJA)).toBe("mes-passado");

    const intervaloCustomizado = { inicio: new Date("2026-01-05T00:00:00.000Z"), fim: new Date("2026-01-09T00:00:00.000Z") };
    expect(identificarPresetAtivo(intervaloCustomizado, FUSO_LOJA)).toBeNull();
  });
});

describe("lib/filtro-periodo — mês específico (preset 'Selecionar mês')", () => {
  it("calcularIntervaloMesEspecifico devolve o dia 1 ao último dia do mês", () => {
    const fevereiro2026 = calcularIntervaloMesEspecifico({ ano: 2026, mesIndiceZero: 1 });
    expect(fevereiro2026.inicio.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    // 2026 não é bissexto — fevereiro tem 28 dias.
    expect(fevereiro2026.fim.toISOString()).toBe("2026-02-28T00:00:00.000Z");

    const dezembro2025 = calcularIntervaloMesEspecifico({ ano: 2025, mesIndiceZero: 11 });
    expect(dezembro2025.inicio.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(dezembro2025.fim.toISOString()).toBe("2025-12-31T00:00:00.000Z");
  });

  it("mesDeCalendarioSeguinte/Anterior atravessam a virada de ano", () => {
    expect(mesDeCalendarioSeguinte({ ano: 2025, mesIndiceZero: 11 })).toEqual({ ano: 2026, mesIndiceZero: 0 });
    expect(mesDeCalendarioAnterior({ ano: 2026, mesIndiceZero: 0 })).toEqual({ ano: 2025, mesIndiceZero: 11 });
  });

  it("identificarMesEspecifico reconhece um mês inteiro e rejeita um intervalo parcial", () => {
    const mesInteiro = calcularIntervaloMesEspecifico({ ano: 2026, mesIndiceZero: 7 });
    expect(identificarMesEspecifico(mesInteiro)).toEqual({ ano: 2026, mesIndiceZero: 7 });

    const parteDoMes = { inicio: new Date("2026-08-05T00:00:00.000Z"), fim: new Date("2026-08-20T00:00:00.000Z") };
    expect(identificarMesEspecifico(parteDoMes)).toBeNull();
  });

  it("mesDeCalendarioAtual usa o fuso da loja, não o do processo, às 22:30", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T01:30:00.000Z"));
    expect(mesDeCalendarioAtual(FUSO_LOJA)).toEqual({ ano: 2026, mesIndiceZero: 0 });
    vi.useRealTimers();
  });
});

describe("lib/filtro-periodo — validação: fim antes do início é recusado", () => {
  it("recusa fim antes do início, com mensagem em pt-BR", () => {
    const resultado = validarIntervalo(
      new Date("2026-09-21T00:00:00.000Z"),
      new Date("2026-08-22T00:00:00.000Z")
    );
    expect(resultado.valido).toBe(false);
    expect(resultado.mensagemErro).toBe("O fim do período não pode ser antes do início.");
  });

  it("aceita início igual a fim (um único dia) e início antes do fim", () => {
    const mesmoDia = validarIntervalo(new Date("2026-08-22T00:00:00.000Z"), new Date("2026-08-22T00:00:00.000Z"));
    expect(mesmoDia.valido).toBe(true);

    const intervaloNormal = validarIntervalo(
      new Date("2026-08-22T00:00:00.000Z"),
      new Date("2026-09-21T00:00:00.000Z")
    );
    expect(intervaloNormal.valido).toBe(true);
  });
});

describe("lib/filtro-periodo — digitação (dd/mm/aaaa)", () => {
  it("aplicarMascaraDataDigitada insere as barras conforme o usuário digita", () => {
    expect(aplicarMascaraDataDigitada("2")).toBe("2");
    expect(aplicarMascaraDataDigitada("22")).toBe("22");
    expect(aplicarMascaraDataDigitada("2208")).toBe("22/08");
    expect(aplicarMascaraDataDigitada("22082026")).toBe("22/08/2026");
    // Ignora qualquer coisa que não seja dígito e trava em 8 dígitos.
    expect(aplicarMascaraDataDigitada("22/08/2026999")).toBe("22/08/2026");
  });

  it("interpretarDataDigitada só aceita dd/mm/aaaa completo e uma data real", () => {
    expect(interpretarDataDigitada("22/08/2026")?.toISOString()).toBe("2026-08-22T00:00:00.000Z");
    expect(interpretarDataDigitada("22/08")).toBeNull(); // incompleto
    expect(interpretarDataDigitada("31/02/2026")).toBeNull(); // 31 de fevereiro não existe
    expect(interpretarDataDigitada("não é data")).toBeNull();
  });
});

describe("lib/filtro-periodo — exibição", () => {
  it("formatarDataExibicao/formatarRotuloIntervalo usam dd/MM/yyyy, ancorado em UTC", () => {
    const intervalo = {
      inicio: new Date("2026-08-22T00:00:00.000Z"),
      fim: new Date("2026-09-21T00:00:00.000Z"),
    };
    expect(formatarDataExibicao(intervalo.inicio)).toBe("22/08/2026");
    expect(formatarRotuloIntervalo(intervalo)).toBe("22/08/2026 até 21/09/2026");
    expect(formatarRotuloIntervalo(intervalo, "Vencimento")).toBe(
      "Vencimento: 22/08/2026 até 21/09/2026"
    );
  });
});

describe("lib/filtro-periodo — round-trip da URL", () => {
  it("paraSearchParams → deSearchParams devolve o mesmo intervalo e campo", () => {
    const intervaloOriginal = {
      inicio: new Date("2026-08-22T00:00:00.000Z"),
      fim: new Date("2026-09-21T00:00:00.000Z"),
    };

    const params = paraSearchParams(intervaloOriginal, "vencimento", new URLSearchParams());
    expect(params.get("campo")).toBe("vencimento");
    expect(params.get("inicio")).toBe("2026-08-22");
    expect(params.get("fim")).toBe("2026-09-21");

    const lido = deSearchParams(params);
    expect(lido.campo).toBe("vencimento");
    expect(lido.intervalo).not.toBeNull();
    expect(lido.intervalo!.inicio.toISOString()).toBe(intervaloOriginal.inicio.toISOString());
    expect(lido.intervalo!.fim.toISOString()).toBe(intervaloOriginal.fim.toISOString());
  });

  it("preserva outros params já presentes na URL (busca, página...) ao escrever o período", () => {
    const paramsExistentes = new URLSearchParams("busca=fulano&pagina=3");
    const params = paraSearchParams(
      { inicio: new Date("2026-01-01T00:00:00.000Z"), fim: new Date("2026-01-31T00:00:00.000Z") },
      undefined,
      paramsExistentes
    );

    expect(params.get("busca")).toBe("fulano");
    expect(params.get("pagina")).toBe("3");
    expect(params.has("campo")).toBe(false); // sem campo selecionado, nenhum "campo" é escrito
  });

  it("deSearchParams devolve intervalo null quando os params estão ausentes ou descrevem fim < início", () => {
    expect(deSearchParams(new URLSearchParams()).intervalo).toBeNull();

    const paramsInvalidos = new URLSearchParams({ inicio: "2026-09-21", fim: "2026-08-22" });
    expect(deSearchParams(paramsInvalidos).intervalo).toBeNull();

    const paramsDataInexistente = new URLSearchParams({ inicio: "2026-02-31", fim: "2026-03-01" });
    expect(deSearchParams(paramsDataInexistente).intervalo).toBeNull();
  });

  it("respeita nomes de params customizados", () => {
    const nomes = { campo: "c", inicio: "i", fim: "f" };
    const params = paraSearchParams(
      { inicio: new Date("2026-01-01T00:00:00.000Z"), fim: new Date("2026-01-02T00:00:00.000Z") },
      "pagamento",
      new URLSearchParams(),
      nomes
    );
    expect(params.get("c")).toBe("pagamento");
    expect(params.get("i")).toBe("2026-01-01");

    const lido = deSearchParams(params, nomes);
    expect(lido.campo).toBe("pagamento");
    expect(lido.intervalo?.inicio.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
