import { describe, expect, it } from "vitest";

import { dataDeCalendario } from "@/lib/datas";

import {
  chaveDoAviso,
  DIAS_DE_AVISO,
  montarAvisosDeVencimento,
  type ContaParaAviso,
} from "./avisos-de-vencimento";

const HOJE = dataDeCalendario("2026-11-07")!;
const em = (iso: string) => dataDeCalendario(iso)!;

function conta(parcial: Partial<ContaParaAviso> = {}): ContaParaAviso {
  return {
    id: "c1",
    tipo: "PAGAR",
    descricao: "Internet Fibra 500MB",
    contraparte: "VIVO",
    valorCentavos: 12_990,
    dataVencimento: em("2026-11-10"),
    ...parcial,
  };
}

function avisos(contas: ContaParaAviso[], jaAvisadas: string[] = []) {
  return montarAvisosDeVencimento({
    contas,
    hoje: HOJE,
    chavesJaAvisadas: new Set(jaAvisadas),
  });
}

describe("avisos de vencimento — os quatro toques", () => {
  it("avisa a 3, 2, 1 e 0 dias", () => {
    for (const dias of DIAS_DE_AVISO) {
      const vencimento = em(`2026-11-${String(7 + dias).padStart(2, "0")}`);
      const resultado = avisos([conta({ dataVencimento: vencimento })]);

      expect(resultado, `${dias} dias`).toHaveLength(1);
      expect(resultado[0].diasDeAntecedencia, `${dias} dias`).toBe(dias);
    }
  });

  it("não avisa a 4 dias — ainda não é hora", () => {
    expect(avisos([conta({ dataVencimento: em("2026-11-11") })])).toEqual([]);
  });

  it("não avisa conta já vencida", () => {
    // Escolha, não omissão: depois do atraso quem avisa é a tela, todo dia,
    // em vermelho. Mandar "venceu há 14 dias" toda manhã é o caminho mais
    // curto pra pessoa silenciar o bot — e perder os avisos que importam.
    for (const atrasada of ["2026-11-06", "2026-10-20", "2026-01-01"]) {
      expect(avisos([conta({ dataVencimento: em(atrasada) })]), atrasada).toEqual([]);
    }
  });
});

describe("avisos de vencimento — não repetir", () => {
  it("o marco já avisado não volta", () => {
    // Crons rodam duas vezes: redeploy, retry da plataforma, alguém abrindo
    // a URL. O aviso de hoje não pode sair duas vezes.
    const chave = chaveDoAviso("PAGAR", "c1", 3);

    expect(avisos([conta()])).toHaveLength(1);
    expect(avisos([conta()], [chave])).toEqual([]);
  });

  it("avisar o marco de 3 dias não cala o de 2", () => {
    const resultado = avisos(
      [conta({ dataVencimento: em("2026-11-09") })],
      [chaveDoAviso("PAGAR", "c1", 3)]
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0].diasDeAntecedencia).toBe(2);
  });

  it("a chave separa pagar de receber com o mesmo id", () => {
    // Ids vêm de tabelas diferentes e podem coincidir. Se a chave não
    // distinguisse, avisar a despesa calaria o recebível.
    const resultado = avisos(
      [conta({ id: "mesmo" }), conta({ id: "mesmo", tipo: "RECEBER" })],
      [chaveDoAviso("PAGAR", "mesmo", 3)]
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0].conta.tipo).toBe("RECEBER");
  });

  it("conta nova que vence em 2 dias recebe só o marco de 2", () => {
    // O marco de 3 dias já passou e não é remontado: cada um existe no seu
    // dia ou não existe.
    const resultado = avisos([conta({ dataVencimento: em("2026-11-09") })]);

    expect(resultado.map((a) => a.diasDeAntecedencia)).toEqual([2]);
  });
});

describe("avisos de vencimento — o texto que a pessoa lê", () => {
  it("diz o que é, quando, com quem e quanto", () => {
    const [aviso] = avisos([conta({ dataVencimento: em("2026-11-07") })]);

    expect(aviso.mensagem).toBe("A pagar — vence hoje\nVIVO: Internet Fibra 500MB\nR$ 129,90 · 07/11");
  });

  it("'amanhã' em vez de 'em 1 dias'", () => {
    const [aviso] = avisos([conta({ dataVencimento: em("2026-11-08") })]);

    expect(aviso.mensagem).toContain("vence amanhã");
    expect(aviso.mensagem).not.toContain("1 dias");
  });

  it("'hoje' em vez de 'em 0 dias'", () => {
    const [aviso] = avisos([conta({ dataVencimento: em("2026-11-07") })]);

    expect(aviso.mensagem).toContain("vence hoje");
    expect(aviso.mensagem).not.toContain("0 dias");
  });

  it("conta a receber não é anunciada como a pagar", () => {
    const [aviso] = avisos([conta({ tipo: "RECEBER", contraparte: "João da Silva" })]);

    expect(aviso.mensagem).toContain("A receber");
    expect(aviso.titulo).toBe("Conta a receber vence em 3 dias");
  });

  it("sem contraparte, mostra só a descrição — nunca 'null:'", () => {
    for (const vazia of [null, "", "   "]) {
      const [aviso] = avisos([conta({ contraparte: vazia })]);

      expect(aviso.mensagem, JSON.stringify(vazia)).toContain("Internet Fibra 500MB");
      expect(aviso.mensagem, JSON.stringify(vazia)).not.toContain("null");
      expect(aviso.mensagem, JSON.stringify(vazia)).not.toMatch(/^\s*:/m);
    }
  });

  it("o valor sai em reais, não em centavos", () => {
    const [aviso] = avisos([conta({ valorCentavos: 250_000 })]);

    expect(aviso.mensagem).toContain("R$ 2.500,00");
    expect(aviso.mensagem).not.toContain("250000");
  });

  it("a data sai no formato brasileiro, sem deslocar o dia", () => {
    // O vencimento é data de calendário em meia-noite UTC: formatar com
    // getters locais mostraria o dia anterior em qualquer fuso negativo.
    const [aviso] = avisos([conta({ dataVencimento: em("2026-11-10") })]);

    expect(aviso.mensagem).toContain("10/11");
  });
});

describe("avisos de vencimento — ordem na tela do celular", () => {
  it("o mais urgente primeiro", () => {
    const resultado = avisos([
      conta({ id: "tres", dataVencimento: em("2026-11-10") }),
      conta({ id: "hoje", dataVencimento: em("2026-11-07") }),
      conta({ id: "amanha", dataVencimento: em("2026-11-08") }),
    ]);

    expect(resultado.map((a) => a.conta.id)).toEqual(["hoje", "amanha", "tres"]);
  });

  it("no mesmo dia, pagar antes de receber", () => {
    // Entre dois "vence hoje", o que dói é o que precisa ser pago.
    const resultado = avisos([
      conta({ id: "r", tipo: "RECEBER", dataVencimento: em("2026-11-07") }),
      conta({ id: "p", tipo: "PAGAR", dataVencimento: em("2026-11-07") }),
    ]);

    expect(resultado.map((a) => a.conta.id)).toEqual(["p", "r"]);
  });

  it("no mesmo dia e tipo, o maior valor primeiro", () => {
    const resultado = avisos([
      conta({ id: "pequena", valorCentavos: 1_000 }),
      conta({ id: "grande", valorCentavos: 500_000 }),
    ]);

    expect(resultado.map((a) => a.conta.id)).toEqual(["grande", "pequena"]);
  });
});

describe("avisos de vencimento — bordas", () => {
  it("lista vazia não estoura", () => {
    expect(avisos([])).toEqual([]);
  });

  it("virada de mês é contada por dia de calendário, não por número do dia", () => {
    const resultado = montarAvisosDeVencimento({
      contas: [conta({ dataVencimento: em("2026-12-01") })],
      hoje: em("2026-11-30"),
      chavesJaAvisadas: new Set(),
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0].diasDeAntecedencia).toBe(1);
  });

  it("virada de ano também", () => {
    const resultado = montarAvisosDeVencimento({
      contas: [conta({ dataVencimento: em("2027-01-01") })],
      hoje: em("2026-12-29"),
      chavesJaAvisadas: new Set(),
    });

    expect(resultado[0].diasDeAntecedencia).toBe(3);
  });
});
