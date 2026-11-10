import { describe, expect, it } from "vitest";

import {
  caixasAtrasados,
  decidirFechamentoAutomatico,
  lerHorarioDeFechamento,
  ultimaPassagemPeloHorario,
} from "./fechamento-automatico";

const SP = "America/Sao_Paulo";

/** Um instante em São Paulo, escrito como se lê no relógio da loja. */
function emSaoPaulo(iso: string): Date {
  // -03:00 é o offset de São Paulo desde o fim do horário de verão (2019).
  return new Date(`${iso}-03:00`);
}

describe("lerHorarioDeFechamento", () => {
  it("aceita HH:MM", () => {
    expect(lerHorarioDeFechamento("23:59")).toEqual({ hora: 23, minuto: 59 });
    expect(lerHorarioDeFechamento("08:00")).toEqual({ hora: 8, minuto: 0 });
    expect(lerHorarioDeFechamento("8:30")).toEqual({ hora: 8, minuto: 30 });
  });

  it("recusa o que não é horário, em vez de inventar meia-noite", () => {
    // Horário inválido tem que DESLIGAR o fechamento, não fechar o caixa às
    // 00:00 por engano — fechar na hora errada é pior que não fechar.
    expect(lerHorarioDeFechamento("")).toBeNull();
    expect(lerHorarioDeFechamento(null)).toBeNull();
    expect(lerHorarioDeFechamento("24:00")).toBeNull();
    expect(lerHorarioDeFechamento("23:60")).toBeNull();
    expect(lerHorarioDeFechamento("meia-noite")).toBeNull();
    expect(lerHorarioDeFechamento("23h59")).toBeNull();
  });
});

describe("ultimaPassagemPeloHorario", () => {
  it("já passou hoje: é hoje", () => {
    const limite = ultimaPassagemPeloHorario(
      emSaoPaulo("2026-11-10T23:00:00"),
      { hora: 18, minuto: 0 },
      SP
    );

    expect(limite.toISOString()).toBe(emSaoPaulo("2026-11-10T18:00:00").toISOString());
  });

  it("ainda não passou hoje: é ontem", () => {
    // É isto que faz o caixa de ontem fechar na execução da manhã, em vez de
    // esperar a noite seguinte.
    const limite = ultimaPassagemPeloHorario(
      emSaoPaulo("2026-11-10T07:00:00"),
      { hora: 23, minuto: 59 },
      SP
    );

    expect(limite.toISOString()).toBe(emSaoPaulo("2026-11-09T23:59:00").toISOString());
  });

  it("no instante exato, conta como passado", () => {
    const limite = ultimaPassagemPeloHorario(
      emSaoPaulo("2026-11-10T18:00:00"),
      { hora: 18, minuto: 0 },
      SP
    );

    expect(limite.toISOString()).toBe(emSaoPaulo("2026-11-10T18:00:00").toISOString());
  });

  it("usa o relógio da loja, não o do servidor", () => {
    // 01:00 UTC do dia 11 é 22:00 do dia 10 em São Paulo. Com fechamento às
    // 23:59, a última passagem é a do dia 9 — não a do dia 10, que ainda não
    // aconteceu na loja.
    const limite = ultimaPassagemPeloHorario(
      new Date("2026-11-11T01:00:00Z"),
      { hora: 23, minuto: 59 },
      SP
    );

    expect(limite.toISOString()).toBe(emSaoPaulo("2026-11-09T23:59:00").toISOString());
  });
});

describe("caixasAtrasados", () => {
  const limite = emSaoPaulo("2026-11-10T23:59:00");

  it("fecha o aberto antes do limite", () => {
    const atrasados = caixasAtrasados(
      [{ id: "a", dataAbertura: emSaoPaulo("2026-11-10T08:00:00") }],
      limite
    );

    expect(atrasados.map((c) => c.id)).toEqual(["a"]);
  });

  it("não fecha o aberto depois do limite", () => {
    // Esse é o expediente em curso. Fechá-lo seria interromper a venda de
    // alguém que está atendendo agora.
    const atrasados = caixasAtrasados(
      [{ id: "b", dataAbertura: emSaoPaulo("2026-11-11T08:00:00") }],
      limite
    );

    expect(atrasados).toEqual([]);
  });

  it("pega o caixa esquecido aberto há dias", () => {
    const atrasados = caixasAtrasados(
      [{ id: "antigo", dataAbertura: emSaoPaulo("2026-11-07T09:00:00") }],
      limite
    );

    expect(atrasados.map((c) => c.id)).toEqual(["antigo"]);
  });
});

describe("decidirFechamentoAutomatico", () => {
  const base = {
    fusoHorario: SP,
    agora: emSaoPaulo("2026-11-10T07:00:00"),
    caixasAbertos: [{ id: "a", dataAbertura: emSaoPaulo("2026-11-09T08:00:00") }],
  };

  it("desligado não fecha nada", () => {
    expect(
      decidirFechamentoAutomatico({ ...base, ativo: false, horarioTexto: "23:59" })
    ).toBeNull();
  });

  it("horário inválido não fecha nada", () => {
    expect(decidirFechamentoAutomatico({ ...base, ativo: true, horarioTexto: "abc" })).toBeNull();
  });

  it("sem caixa atrasado devolve null, e não lista vazia", () => {
    // Quem chama precisa distinguir "não devia rodar" de "rodou e não achou
    // nada" — as duas coisas aparecem igual numa lista vazia.
    const decisao = decidirFechamentoAutomatico({
      ...base,
      ativo: true,
      horarioTexto: "23:59",
      caixasAbertos: [{ id: "novo", dataAbertura: emSaoPaulo("2026-11-10T06:00:00") }],
    });

    expect(decisao).toBeNull();
  });

  it("ligado, com horário válido e caixa atrasado, manda fechar", () => {
    const decisao = decidirFechamentoAutomatico({ ...base, ativo: true, horarioTexto: "23:59" });

    expect(decisao).not.toBeNull();
    expect(decisao?.aFechar.map((c) => c.id)).toEqual(["a"]);
    expect(decisao?.limite.toISOString()).toBe(emSaoPaulo("2026-11-09T23:59:00").toISOString());
  });
});
