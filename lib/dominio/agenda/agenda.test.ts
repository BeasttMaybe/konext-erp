import { describe, expect, it } from "vitest";

import {
  agruparPorDia,
  compromissosParaAvisar,
  ordenarEventos,
  rotuloDaAntecedencia,
  textoDoAviso,
  validarCompromisso,
} from "./agenda";

const base = {
  avisadoEm: null,
  concluidoEm: null,
  canceladoEm: null,
  diaInteiro: false,
};

describe("compromissosParaAvisar", () => {
  const inicio = new Date("2026-11-13T17:00:00Z");
  const c = { ...base, id: "a", inicio, avisarMinutosAntes: 60 };

  it("avisa dentro da janela", () => {
    expect(compromissosParaAvisar([c], new Date("2026-11-13T16:00:00Z"))).toHaveLength(1);
    expect(compromissosParaAvisar([c], new Date("2026-11-13T17:30:00Z"))).toHaveLength(1);
  });

  it("nao avisa antes da antecedencia", () => {
    expect(compromissosParaAvisar([c], new Date("2026-11-13T15:59:00Z"))).toHaveLength(0);
  });

  it("nao avisa o que ja passou ha mais de 6h", () => {
    expect(compromissosParaAvisar([c], new Date("2026-11-13T23:01:00Z"))).toHaveLength(0);
  });

  it("nao avisa de novo, nem sem aviso, nem cancelado ou concluido", () => {
    const agora = new Date("2026-11-13T16:30:00Z");
    expect(compromissosParaAvisar([{ ...c, avisadoEm: agora }], agora)).toHaveLength(0);
    expect(compromissosParaAvisar([{ ...c, avisarMinutosAntes: null }], agora)).toHaveLength(0);
    expect(compromissosParaAvisar([{ ...c, canceladoEm: agora }], agora)).toHaveLength(0);
    expect(compromissosParaAvisar([{ ...c, concluidoEm: agora }], agora)).toHaveLength(0);
  });

  it("dia inteiro vale o dia todo", () => {
    const dia = { ...c, diaInteiro: true, inicio: new Date("2026-11-13T03:00:00Z"), avisarMinutosAntes: 0 };
    expect(compromissosParaAvisar([dia], new Date("2026-11-13T22:00:00Z"))).toHaveLength(1);
    expect(compromissosParaAvisar([dia], new Date("2026-11-14T03:01:00Z"))).toHaveLength(0);
  });
});

describe("validarCompromisso", () => {
  it("aceita compromisso com hora", () => {
    const r = validarCompromisso({ titulo: " Retirar peça ", data: "2026-11-20", horaInicio: "09:30", horaFim: "10:00", avisarMinutosAntes: "30" });
    expect(r).toEqual({
      ok: true,
      dados: { titulo: "Retirar peça", descricao: null, data: "2026-11-20", horaInicio: "09:30", horaFim: "10:00", avisarMinutosAntes: 30, clienteId: null },
    });
  });

  it("dia inteiro ignora horas", () => {
    const r = validarCompromisso({ titulo: "Inventário", data: "2026-11-20", diaInteiro: "on", horaInicio: "lixo", avisarMinutosAntes: "nenhum" });
    expect(r.ok && r.dados.horaInicio).toBe(null);
    expect(r.ok && r.dados.avisarMinutosAntes).toBe(null);
  });

  it("recusa entradas ruins", () => {
    expect(validarCompromisso({ titulo: "", data: "2026-11-20", horaInicio: "09:00" }).ok).toBe(false);
    expect(validarCompromisso({ titulo: "x", data: "2026-02-30", horaInicio: "09:00" }).ok).toBe(false);
    expect(validarCompromisso({ titulo: "x", data: "2026-11-20", horaInicio: "25:00" }).ok).toBe(false);
    expect(validarCompromisso({ titulo: "x", data: "2026-11-20", horaInicio: "10:00", horaFim: "09:00" }).ok).toBe(false);
    expect(validarCompromisso({ titulo: "x", data: "2026-11-20", horaInicio: "10:00", avisarMinutosAntes: "7" }).ok).toBe(false);
  });
});

describe("ordenar e agrupar", () => {
  it("dia inteiro antes, depois por hora", () => {
    const ev = (dia: string, h: string, diaInteiro = false, titulo = h) => ({ dia, diaInteiro, inicio: new Date(`${dia}T${h}:00Z`), titulo });
    const lista = ordenarEventos([ev("2026-11-14", "10:00"), ev("2026-11-13", "15:00"), ev("2026-11-13", "00:00", true, "Prazo"), ev("2026-11-13", "09:00")]);
    expect(lista.map((e) => `${e.dia} ${e.titulo}`)).toEqual(["2026-11-13 Prazo", "2026-11-13 09:00", "2026-11-13 15:00", "2026-11-14 10:00"]);
    expect([...agruparPorDia(lista).keys()]).toEqual(["2026-11-13", "2026-11-14"]);
  });
});

describe("textos", () => {
  it("antecedencia e aviso", () => {
    expect(rotuloDaAntecedencia(null)).toBe("Sem aviso");
    expect(rotuloDaAntecedencia(0)).toBe("Na hora");
    expect(rotuloDaAntecedencia(15)).toBe("15 min antes");
    expect(rotuloDaAntecedencia(120)).toBe("2 horas antes");
    expect(rotuloDaAntecedencia(1440)).toBe("1 dia antes");
    expect(textoDoAviso("Ligar fornecedor", "14:30", "hoje", "13/11").mensagem).toBe("Hoje às 14:30: Ligar fornecedor");
    expect(textoDoAviso("Inventário", null, "amanha", "14/11").mensagem).toBe("Amanhã (dia inteiro): Inventário");
  });
});
