import { describe, expect, it } from "vitest";

import {
  DIAS_PARA_ALERTA_DE_VALIDADE,
  calcularSituacao,
  calcularTaxaDeConversao,
  pesoDeUrgencia,
  podeMarcarComoEnviada,
  podeRegistrarResposta,
  type StatusProposta,
} from "./situacao";

/** Data de calendário: meia-noite UTC, como `comoDataDeCalendario` devolve. */
function dia(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

const HOJE = dia("2026-11-15");

function situacaoDe(parcial: {
  status?: StatusProposta;
  validade?: string;
  proximoContato?: string | null;
}) {
  return calcularSituacao({
    status: parcial.status ?? "ENVIADA",
    validade: dia(parcial.validade ?? "2026-12-15"),
    proximoContato: parcial.proximoContato ? dia(parcial.proximoContato) : null,
    hoje: HOJE,
  });
}

describe("propostas/situacao — o que o status não contava", () => {
  /**
   * O caso que motivou o módulo: as duas estão "ENVIADA" no banco e a tela
   * mostrava as duas exatamente iguais.
   */
  it("duas propostas ENVIADA ficam diferentes quando a validade entra na conta", () => {
    const vencida = situacaoDe({ validade: "2026-10-20" });
    const tranquila = situacaoDe({ validade: "2026-12-20" });

    expect(vencida.situacao).toBe("VENCIDA");
    expect(tranquila.situacao).toBe("AGUARDANDO");
  });

  it("vence hoje conta como vencendo, não como vencida", () => {
    const hoje = situacaoDe({ validade: "2026-11-15" });

    expect(hoje.situacao).toBe("VENCENDO");
    expect(hoje.diasParaVencer).toBe(0);
  });

  it("a janela de alerta é a do módulo, e um dia depois dela já é aguardando", () => {
    const dentro = situacaoDe({ validade: "2026-11-18" }); // +3
    const fora = situacaoDe({ validade: "2026-11-19" }); // +4

    expect(DIAS_PARA_ALERTA_DE_VALIDADE).toBe(3);
    expect(dentro.situacao).toBe("VENCENDO");
    expect(fora.situacao).toBe("AGUARDANDO");
  });

  it("rascunho não vence: a proposta nem saiu daqui", () => {
    const rascunho = situacaoDe({ status: "RASCUNHO", validade: "2026-01-01" });

    expect(rascunho.situacao).toBe("RASCUNHO");
    expect(rascunho.diasParaVencer).toBeNull();
  });

  it("proposta respondida ignora a validade e sai do aberto", () => {
    const aprovada = situacaoDe({ status: "APROVADA", validade: "2026-01-01" });
    const rejeitada = situacaoDe({ status: "REJEITADA", validade: "2026-01-01" });

    expect(aprovada.situacao).toBe("APROVADA");
    expect(aprovada.diasParaVencer).toBeNull();
    expect(aprovada.emAberto).toBe(false);
    expect(rejeitada.emAberto).toBe(false);
  });

  it("respondida não cobra follow-up, mesmo com contato marcado pra ontem", () => {
    const aprovada = situacaoDe({
      status: "APROVADA",
      proximoContato: "2026-11-01",
    });

    expect(aprovada.contatoAtrasado).toBe(false);
  });
});

describe("propostas/situacao — próximo contato", () => {
  it("contato marcado pra hoje ou pra trás está atrasado; pra frente não", () => {
    expect(situacaoDe({ proximoContato: "2026-11-15" }).contatoAtrasado).toBe(true);
    expect(situacaoDe({ proximoContato: "2026-11-10" }).contatoAtrasado).toBe(true);
    expect(situacaoDe({ proximoContato: "2026-11-16" }).contatoAtrasado).toBe(false);
  });

  it("sem contato marcado, nada está atrasado", () => {
    expect(situacaoDe({ proximoContato: null }).contatoAtrasado).toBe(false);
  });
});

describe("propostas/situacao — ordem de urgência", () => {
  it("vencendo vem antes de vencida, que vem antes de aguardando", () => {
    const vencendo = pesoDeUrgencia(situacaoDe({ validade: "2026-11-16" }));
    const vencida = pesoDeUrgencia(situacaoDe({ validade: "2026-11-10" }));
    const aguardando = pesoDeUrgencia(situacaoDe({ validade: "2026-12-20" }));

    expect(vencendo).toBeLessThan(vencida);
    expect(vencida).toBeLessThan(aguardando);
  });

  it("entre duas que vencem, a de prazo mais curto primeiro", () => {
    const hoje = pesoDeUrgencia(situacaoDe({ validade: "2026-11-15" }));
    const emTres = pesoDeUrgencia(situacaoDe({ validade: "2026-11-18" }));

    expect(hoje).toBeLessThan(emTres);
  });

  it("entre duas vencidas, a mais recente primeiro — ainda se resolve", () => {
    const ontem = pesoDeUrgencia(situacaoDe({ validade: "2026-11-14" }));
    const antiga = pesoDeUrgencia(situacaoDe({ validade: "2026-05-14" }));

    expect(ontem).toBeLessThan(antiga);
  });

  it("respondida sai do caminho, qualquer que seja a validade", () => {
    const aguardando = pesoDeUrgencia(situacaoDe({ validade: "2026-12-20" }));

    for (const status of ["APROVADA", "REJEITADA"] as const) {
      const respondida = pesoDeUrgencia(situacaoDe({ status, validade: "2026-01-01" }));
      expect(respondida, status).toBeGreaterThan(aguardando);
    }
  });

  it("contato atrasado sobe dentro da faixa, mas nunca passa a faixa de cima", () => {
    const aguardandoComContato = pesoDeUrgencia(
      situacaoDe({ validade: "2026-12-20", proximoContato: "2026-11-10" })
    );
    const aguardandoSemContato = pesoDeUrgencia(situacaoDe({ validade: "2026-12-20" }));
    const vencendoSemContato = pesoDeUrgencia(situacaoDe({ validade: "2026-11-18" }));

    expect(aguardandoComContato).toBeLessThan(aguardandoSemContato);
    expect(aguardandoComContato).toBeGreaterThan(vencendoSemContato);
  });
});

describe("propostas/situacao — as faixas não se invadem", () => {
  /**
   * A ordenação da lista roda em SQL a partir destas mesmas constantes. Se uma
   * faixa invadir a seguinte, a ordem fica errada nos dois lugares de uma vez —
   * e o jeito de invadir é justamente a proposta muito antiga.
   */
  it("nem a vencida mais antiga passa o rascunho", () => {
    const vencidaAntiquissima = pesoDeUrgencia(
      calcularSituacao({
        status: "ENVIADA",
        validade: dia("2019-01-01"),
        proximoContato: dia("2019-01-01"),
        hoje: HOJE,
      })
    );
    const rascunho = pesoDeUrgencia(situacaoDe({ status: "RASCUNHO" }));

    expect(vencidaAntiquissima).toBeLessThan(rascunho);
  });

  it("nem a aguardando mais distante passa o rascunho", () => {
    const aguardandoDistante = pesoDeUrgencia(situacaoDe({ validade: "2031-01-01" }));
    const rascunho = pesoDeUrgencia(situacaoDe({ status: "RASCUNHO" }));

    expect(aguardandoDistante).toBeLessThan(rascunho);
  });

  it("a faixa mais frouxa em aberto ainda vem antes de qualquer respondida", () => {
    const rascunhoSemContato = pesoDeUrgencia(situacaoDe({ status: "RASCUNHO" }));
    const aprovada = pesoDeUrgencia(situacaoDe({ status: "APROVADA" }));

    expect(rascunhoSemContato).toBeLessThan(aprovada);
  });
});

describe("propostas/situacao — o que pode ser feito", () => {
  it("só rascunho e enviada aceitam resposta do cliente", () => {
    expect(podeRegistrarResposta("RASCUNHO")).toBe(true);
    expect(podeRegistrarResposta("ENVIADA")).toBe(true);
    expect(podeRegistrarResposta("APROVADA")).toBe(false);
    expect(podeRegistrarResposta("REJEITADA")).toBe(false);
  });

  it("só rascunho pode ser marcada como enviada", () => {
    expect(podeMarcarComoEnviada("RASCUNHO")).toBe(true);
    expect(podeMarcarComoEnviada("ENVIADA")).toBe(false);
    expect(podeMarcarComoEnviada("APROVADA")).toBe(false);
  });
});

describe("propostas/situacao — taxa de conversão", () => {
  it("divide pelas respondidas, não pelo total", () => {
    // 3 aprovadas de 4 respondidas = 75%, independente de quantas estão em
    // aberto. Dividir pelo total faria a taxa cair a cada orçamento novo.
    expect(calcularTaxaDeConversao({ aprovadas: 3, rejeitadas: 1 })).toBe(75);
  });

  it("sem nenhuma resposta não existe taxa", () => {
    // Melhor não mostrar nada que mostrar "0%" pra quem nunca perdeu um
    // orçamento — seria o pior número possível, e é falso.
    expect(calcularTaxaDeConversao({ aprovadas: 0, rejeitadas: 0 })).toBeNull();
  });

  it("tudo aprovado é 100% e tudo rejeitado é 0%", () => {
    expect(calcularTaxaDeConversao({ aprovadas: 5, rejeitadas: 0 })).toBe(100);
    expect(calcularTaxaDeConversao({ aprovadas: 0, rejeitadas: 5 })).toBe(0);
  });
});
