import { describe, expect, it } from "vitest";

import { encontrarEntregaAuditada, type EventoAuditoriaOS } from "./entrega-auditada";

type EntradaEvento = Partial<Omit<EventoAuditoriaOS, "id" | "criadoEm">> & { id: string; criadoEm: string };

function evento(sobrescritas: EntradaEvento): EventoAuditoriaOS {
  return {
    statusAntes: null,
    statusDepois: null,
    tipoFinalizacao: null,
    ...sobrescritas,
    criadoEm: new Date(sobrescritas.criadoEm),
  };
}

describe("encontrarEntregaAuditada", () => {
  it("entrega real: uma transicao PRONTO -> ENTREGUE", () => {
    const resultado = encontrarEntregaAuditada([
      evento({ id: "log-1", criadoEm: "2026-06-26T03:49:44.000Z", statusAntes: "PRONTO", statusDepois: "ENTREGUE" }),
    ]);

    expect(resultado).toEqual({ encontrada: true, momento: new Date("2026-06-26T03:49:44.000Z"), logId: "log-1" });
  });

  it("eco de resgate depois da entrega: a entrega real continua vencendo", () => {
    const resultado = encontrarEntregaAuditada([
      evento({ id: "log-1", criadoEm: "2026-06-26T03:49:44.000Z", statusAntes: "PRONTO", statusDepois: "ENTREGUE" }),
      // Arquivar OS meses depois: a OS ja estava ENTREGUE, so completa o resgate.
      evento({
        id: "log-2",
        criadoEm: "2026-09-18T03:47:43.000Z",
        statusAntes: "ENTREGUE",
        statusDepois: "ENTREGUE",
        tipoFinalizacao: "RESGATE",
      }),
    ]);

    expect(resultado).toEqual({ encontrada: true, momento: new Date("2026-06-26T03:49:44.000Z"), logId: "log-1" });
  });

  it("eco de resgate identificado so por statusAntes (sem tipoFinalizacao gravado)", () => {
    const resultado = encontrarEntregaAuditada([
      evento({ id: "log-1", criadoEm: "2026-06-26T03:49:44.000Z", statusAntes: "PRONTO", statusDepois: "ENTREGUE" }),
      evento({ id: "log-2", criadoEm: "2026-09-18T03:47:43.000Z", statusAntes: "ENTREGUE", statusDepois: "ENTREGUE" }),
    ]);

    expect(resultado).toEqual({ encontrada: true, momento: new Date("2026-06-26T03:49:44.000Z"), logId: "log-1" });
  });

  it("reabertura seguida de uma segunda entrega: prevalece a primeira, nao a mais recente", () => {
    const resultado = encontrarEntregaAuditada([
      evento({ id: "log-1", criadoEm: "2026-07-01T10:00:00.000Z", statusAntes: "PRONTO", statusDepois: "ENTREGUE" }),
      // Reabertura: statusDepois nao e ENTREGUE, nunca poderia ser confundida com entrega.
      evento({ id: "log-2", criadoEm: "2026-07-05T10:00:00.000Z", statusAntes: "ENTREGUE", statusDepois: "PRONTO" }),
      evento({ id: "log-3", criadoEm: "2026-07-06T10:00:00.000Z", statusAntes: "PRONTO", statusDepois: "ENTREGUE" }),
    ]);

    expect(resultado).toEqual({ encontrada: true, momento: new Date("2026-07-01T10:00:00.000Z"), logId: "log-1" });
  });

  it("nenhuma entrega auditada", () => {
    expect(encontrarEntregaAuditada([])).toEqual({ encontrada: false });

    const soResgate = encontrarEntregaAuditada([
      evento({ id: "log-1", criadoEm: "2026-07-01T10:00:00.000Z", statusAntes: "ENTREGUE", statusDepois: "ENTREGUE", tipoFinalizacao: "RESGATE" }),
    ]);
    expect(soResgate).toEqual({ encontrada: false });
  });
});
