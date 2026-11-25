import { describe, expect, it } from "vitest";

import { apurarCaixa, type ContaCaixa } from "./caixa";

const HOJE = new Date("2026-11-25T00:00:00Z");

function conta(parcial: Partial<ContaCaixa>): ContaCaixa {
  return {
    valorCentavos: 100_00,
    recebida: false,
    estornada: false,
    vencimento: new Date("2026-12-10T00:00:00Z"),
    recebimento: null,
    ...parcial,
  };
}

describe("apurarCaixa", () => {
  it("separa a receber em aberto entre vencido e a vencer", () => {
    const r = apurarCaixa(
      [
        conta({ valorCentavos: 100_00, vencimento: new Date("2026-12-10T00:00:00Z") }), // a vencer
        conta({ valorCentavos: 50_00, vencimento: new Date("2026-11-20T00:00:00Z") }), // vencido
      ],
      HOJE
    );
    expect(r.aReceberAbertoCentavos).toBe(150_00);
    expect(r.aVencerCentavos).toBe(100_00);
    expect(r.vencidoCentavos).toBe(50_00);
    expect(r.qtdAberto).toBe(2);
    expect(r.qtdVencido).toBe(1);
  });

  it("soma o recebido e ignora estornadas", () => {
    const r = apurarCaixa(
      [
        conta({ valorCentavos: 80_00, recebida: true, recebimento: new Date("2026-11-15T00:00:00Z") }),
        conta({ valorCentavos: 999_00, estornada: true }),
      ],
      HOJE
    );
    expect(r.recebidoCentavos).toBe(80_00);
    expect(r.aReceberAbertoCentavos).toBe(0);
  });

  it("prazo médio = média de dias entre vencimento e recebimento das pagas", () => {
    const r = apurarCaixa(
      [
        // venceu 01/11, pago 11/11 -> +10 dias
        conta({ recebida: true, vencimento: new Date("2026-11-01T00:00:00Z"), recebimento: new Date("2026-11-11T00:00:00Z") }),
        // venceu 01/11, pago 21/11 -> +20 dias
        conta({ recebida: true, vencimento: new Date("2026-11-01T00:00:00Z"), recebimento: new Date("2026-11-21T00:00:00Z") }),
      ],
      HOJE
    );
    expect(r.prazoMedioDias).toBe(15);
  });

  it("sem contas pagas, prazo médio é nulo", () => {
    expect(apurarCaixa([conta({})], HOJE).prazoMedioDias).toBeNull();
  });

  it("lista vazia não quebra", () => {
    const r = apurarCaixa([], HOJE);
    expect(r.aReceberAbertoCentavos).toBe(0);
    expect(r.prazoMedioDias).toBeNull();
  });
});
