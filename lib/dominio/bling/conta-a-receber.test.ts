import { describe, expect, it } from "vitest";

import {
  lerContaDoBling,
  lerPaginaDeContas,
  referenciaDaConta,
  statusDaSituacaoDaConta,
} from "./conta-a-receber";

/**
 * A resposta REAL de `/contas/receber`, copiada de uma chamada de verdade.
 *
 * Repare no `situacao: 2`. Ele sempre esteve aqui, nesta amostra, desde a
 * primeira vez — e a primeira versão da importação o ignorou, criando tudo
 * como pendente. Foi assim que notas de janeiro, já pagas, viraram dívida
 * atrasada na tela do dono.
 */
const CONTA_REAL = {
  id: 24786292671,
  idOrigem: 24786284190,
  situacao: 2,
  vencimento: "2026-01-08",
  valor: 40,
  dataEmissao: "2026-01-08",
  contato: {
    id: 17886588890,
    nome: "CONDOMINIO THE CLUB RESIDENCIAL",
    numeroDocumento: "62378367000109",
    tipo: "J",
  },
  formaPagamento: { id: 8939363, codigoFiscal: 20 },
  origem: {
    id: 24786284190,
    tipoOrigem: "venda",
    numero: "1",
    dataEmissao: "2026-01-08",
    valor: 40,
    situacao: 1,
  },
};

describe("conta do Bling — o registro real", () => {
  const conta = lerContaDoBling(CONTA_REAL)!;

  it("vem RECEBIDA, não pendente", () => {
    // O defeito em uma linha: esta conta é de janeiro e já foi baixada no
    // Bling. Criada como pendente, ela aparecia como dívida atrasada.
    expect(conta.status).toBe("RECEBIDO");
  });

  it("carrega o cliente, não só a nota", () => {
    // O dono pediu: "ao clicar na conta, gostaria que mostrasse de qual
    // cliente seria, hoje mostra apenas de qual nota fiscal faz parte".
    expect(conta.clienteNome).toBe("CONDOMINIO THE CLUB RESIDENCIAL");
    expect(conta.clienteDocumento).toBe("62378367000109");
    expect(conta.descricao).toContain("CONDOMINIO THE CLUB RESIDENCIAL");
  });

  it("diz de onde veio, logo no começo do nome", () => {
    expect(conta.descricao.startsWith("(Bling)")).toBe(true);
    expect(conta.descricao).toContain("venda 1");
  });

  it("lê vencimento e valor", () => {
    expect(conta.vencimento.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(conta.valorReais).toBe(40);
  });
});

describe("tradução da situação", () => {
  it("recebido vira RECEBIDO", () => {
    expect(statusDaSituacaoDaConta(2)).toBe("RECEBIDO");
  });

  it("em aberto vira PENDENTE", () => {
    expect(statusDaSituacaoDaConta(1)).toBe("PENDENTE");
  });

  it("PARCIALMENTE recebido fica PENDENTE, não recebido", () => {
    // Ainda há saldo. Uma conta que aparece como devida e já foi parcialmente
    // paga se corrige ao dar baixa; uma que some por ter sido chamada de
    // recebida não volta sozinha.
    expect(statusDaSituacaoDaConta(3)).toBe("PENDENTE");
  });

  it("devolvido e cancelado viram ESTORNADO", () => {
    expect(statusDaSituacaoDaConta(4)).toBe("ESTORNADO");
    expect(statusDaSituacaoDaConta(5)).toBe("ESTORNADO");
  });

  it("situação desconhecida cai em PENDENTE, que é o lado visível", () => {
    // Conta que aparece devendo sem estar é corrigida; conta que some, não.
    expect(statusDaSituacaoDaConta(99)).toBe("PENDENTE");
  });

  it("situação ausente também", () => {
    expect(lerContaDoBling({ ...CONTA_REAL, situacao: undefined })?.status).toBe("PENDENTE");
  });
});

describe("o que não vira conta", () => {
  it("sem id, sem vencimento ou sem valor é descartada", () => {
    // Nenhum dos três é opcional numa linha que vai somar no total a receber.
    for (const quebrada of [
      { ...CONTA_REAL, id: null },
      { ...CONTA_REAL, vencimento: "" },
      { ...CONTA_REAL, vencimento: "0000-00-00" },
      { ...CONTA_REAL, valor: null },
    ]) {
      expect(lerContaDoBling(quebrada), JSON.stringify(Object.keys(quebrada))).toBeNull();
    }
  });

  it("lixo no lugar da conta não estoura", () => {
    for (const ruim of [null, undefined, "conta", 42, []]) {
      expect(lerContaDoBling(ruim), JSON.stringify(ruim)).toBeNull();
    }
  });

  it("conta sem contato ainda é importada, sem inventar cliente", () => {
    const conta = lerContaDoBling({ ...CONTA_REAL, contato: undefined })!;

    expect(conta.clienteNome).toBeNull();
    expect(conta.clienteDocumento).toBeNull();
    expect(conta.descricao).not.toContain("null");
  });
});

describe("página e idempotência", () => {
  it("lê o envelope `data`", () => {
    const pagina = lerPaginaDeContas({ data: [CONTA_REAL, { ...CONTA_REAL, id: 2 }] });

    expect(pagina.map((c) => c.blingId)).toEqual(["24786292671", "2"]);
  });

  it("resposta sem `data` devolve lista vazia", () => {
    for (const ruim of [{}, { data: null }, null, []]) {
      expect(lerPaginaDeContas(ruim), JSON.stringify(ruim)).toEqual([]);
    }
  });

  it("a referência é estável e distingue da parcela de nota", () => {
    // A chave antiga era "<idDaNota>:<indice>". Esta é "conta:<id>" — o
    // prefixo deixa claro de qual fonte a linha veio, e impede que as duas
    // se confundam.
    expect(referenciaDaConta("24786292671")).toBe("conta:24786292671");
    expect(referenciaDaConta("24786292671")).toBe(referenciaDaConta("24786292671"));
  });
});
