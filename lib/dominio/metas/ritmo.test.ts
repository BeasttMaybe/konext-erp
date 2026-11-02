import { describe, expect, it } from "vitest";

import { calcularRitmo, pesoDeUrgencia } from "./ritmo";

const DIA = 86_400_000;

function emDias(base: Date, dias: number) {
  return new Date(base.getTime() + dias * DIA);
}

const HOJE = new Date("2026-11-15T12:00:00.000Z");

describe("lib/dominio/metas/ritmo — progresso esperado", () => {
  it("na metade do prazo, espera metade do progresso", () => {
    const r = calcularRitmo({
      progresso: 50,
      inicio: emDias(HOJE, -10),
      prazo: emDias(HOJE, 10),
      agora: HOJE,
    });

    expect(r.progressoEsperado).toBeCloseTo(50, 5);
    expect(r.folga).toBeCloseTo(0, 5);
    expect(r.situacao).toBe("NO_RITMO");
  });

  /**
   * O caso que motivou o módulo: 42% é ótimo no dia 5 e ruim no dia 28, e a
   * tela mostrava os dois como "42%".
   */
  it("o MESMO progresso é no ritmo no começo e atrasado no fim", () => {
    const comeco = calcularRitmo({
      progresso: 42,
      inicio: emDias(HOJE, -2),
      prazo: emDias(HOJE, 28),
      agora: HOJE,
    });
    const fim = calcularRitmo({
      progresso: 42,
      inicio: emDias(HOJE, -28),
      prazo: emDias(HOJE, 2),
      agora: HOJE,
    });

    expect(comeco.situacao).toBe("NO_RITMO");
    expect(fim.situacao).toBe("ATRASADO");
    expect(fim.folga).toBeLessThan(comeco.folga!);
  });

  it("adiantado conta como no ritmo, e a folga é positiva", () => {
    const r = calcularRitmo({
      progresso: 80,
      inicio: emDias(HOJE, -5),
      prazo: emDias(HOJE, 15),
      agora: HOJE,
    });

    expect(r.situacao).toBe("NO_RITMO");
    expect(r.folga).toBeGreaterThan(0);
  });

  it("tolera 5 pontos antes de chamar de atrasado", () => {
    // Sazonalidade existe; 4 pontos atrás no meio do mês não é alarme.
    const dentro = calcularRitmo({
      progresso: 46,
      inicio: emDias(HOJE, -10),
      prazo: emDias(HOJE, 10),
      agora: HOJE,
    });
    const fora = calcularRitmo({
      progresso: 40,
      inicio: emDias(HOJE, -10),
      prazo: emDias(HOJE, 10),
      agora: HOJE,
    });

    expect(dentro.situacao).toBe("NO_RITMO");
    expect(fora.situacao).toBe("ATRASADO");
  });
});

describe("lib/dominio/metas/ritmo — casos de borda", () => {
  it("sem prazo não tem ritmo", () => {
    const r = calcularRitmo({ progresso: 30, inicio: HOJE, prazo: null, agora: HOJE });

    expect(r.situacao).toBe("SEM_PRAZO");
    expect(r.progressoEsperado).toBeNull();
    expect(r.diasRestantes).toBeNull();
  });

  it("100% é concluída, mesmo com prazo no futuro", () => {
    const r = calcularRitmo({
      progresso: 100,
      inicio: emDias(HOJE, -10),
      prazo: emDias(HOJE, 10),
      agora: HOJE,
    });

    expect(r.situacao).toBe("CONCLUIDA");
  });

  it("prazo passado e progresso incompleto é prazo vencido", () => {
    const r = calcularRitmo({
      progresso: 70,
      inicio: emDias(HOJE, -30),
      prazo: emDias(HOJE, -1),
      agora: HOJE,
    });

    expect(r.situacao).toBe("PRAZO_VENCIDO");
    expect(r.folga).toBe(-30);
    expect(r.diasRestantes).toBeLessThan(0);
  });

  it("prazo que ainda não começou não é atrasado", () => {
    const r = calcularRitmo({
      progresso: 0,
      inicio: emDias(HOJE, 5),
      prazo: emDias(HOJE, 35),
      agora: HOJE,
    });

    expect(r.situacao).toBe("NAO_COMECOU");
  });

  it("sem início, o prazo ainda vale: vencido continua vencido", () => {
    const vencido = calcularRitmo({
      progresso: 10,
      inicio: null,
      prazo: emDias(HOJE, -3),
      agora: HOJE,
    });
    const futuro = calcularRitmo({
      progresso: 10,
      inicio: null,
      prazo: emDias(HOJE, 3),
      agora: HOJE,
    });

    expect(vencido.situacao).toBe("PRAZO_VENCIDO");
    expect(futuro.situacao).toBe("SEM_PRAZO");
  });

  it("início e prazo no mesmo instante: a meta é pra hoje", () => {
    const quaseLa = calcularRitmo({ progresso: 96, inicio: HOJE, prazo: HOJE, agora: HOJE });
    const longe = calcularRitmo({ progresso: 20, inicio: HOJE, prazo: HOJE, agora: HOJE });

    expect(quaseLa.situacao).toBe("NO_RITMO");
    expect(longe.situacao).toBe("ATRASADO");
  });

  it("nunca espera mais que 100%", () => {
    const r = calcularRitmo({
      progresso: 50,
      inicio: emDias(HOJE, -100),
      prazo: emDias(HOJE, 1),
      agora: HOJE,
    });

    expect(r.progressoEsperado).toBeLessThanOrEqual(100);
  });
});

describe("lib/dominio/metas/ritmo — ordem de urgência", () => {
  const base = {
    situacao: "NO_RITMO" as const,
    status: "EM_ANDAMENTO",
    folga: 0,
    diasRestantes: 30,
    temErroSincronizacao: false,
  };

  it("sincronização quebrada vem antes de tudo", () => {
    // O número na tela não é confiável, e decisão tomada sobre ele não vale.
    const quebrada = pesoDeUrgencia({ ...base, temErroSincronizacao: true });
    const vencida = pesoDeUrgencia({ ...base, situacao: "PRAZO_VENCIDO" });

    expect(quebrada).toBeLessThan(vencida);
  });

  it("vencida vem antes de atrasada, e atrasada antes de no ritmo", () => {
    const vencida = pesoDeUrgencia({ ...base, situacao: "PRAZO_VENCIDO" });
    const atrasada = pesoDeUrgencia({ ...base, situacao: "ATRASADO", folga: -20 });
    const noRitmo = pesoDeUrgencia(base);

    expect(vencida).toBeLessThan(atrasada);
    expect(atrasada).toBeLessThan(noRitmo);
  });

  it("entre duas atrasadas, a de prazo mais curto vem primeiro", () => {
    // É onde ainda dá pra reagir.
    const curta = pesoDeUrgencia({ ...base, situacao: "ATRASADO", folga: -20, diasRestantes: 3 });
    const longa = pesoDeUrgencia({ ...base, situacao: "ATRASADO", folga: -20, diasRestantes: 60 });

    expect(curta).toBeLessThan(longa);
  });

  it("concluída, cancelada e pausada saem do caminho", () => {
    const noRitmo = pesoDeUrgencia(base);

    for (const status of ["CONCLUIDA", "CANCELADA", "PAUSADA"]) {
      expect(pesoDeUrgencia({ ...base, status }), status).toBeGreaterThan(noRitmo);
    }
  });

  it("meta encerrada nao sobe por ritmo ruim", () => {
    // Uma concluída com prazo vencido não deve brigar por atenção.
    const concluidaVencida = pesoDeUrgencia({
      ...base,
      status: "CONCLUIDA",
      situacao: "PRAZO_VENCIDO",
    });

    expect(concluidaVencida).toBeGreaterThan(pesoDeUrgencia(base));
  });
});
