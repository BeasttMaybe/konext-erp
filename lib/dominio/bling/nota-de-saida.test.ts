import { describe, expect, it } from "vitest";

import {
  lerDataDoBling,
  lerDetalheDaNota,
  lerNotaDeSaidaDoBling,
  lerPaginaDeNotas,
  rotuloDaSituacaoDoBling,
  serieDaChave,
  statusDaSituacaoDoBling,
} from "./nota-de-saida";

/**
 * A resposta REAL do Bling, copiada de uma chamada de verdade feita pelo dono
 * da loja. Não é um exemplo inventado — e foi justamente por olhar para ela
 * que as três armadilhas apareceram.
 */
const NOTA_REAL_DO_BLING = {
  id: 27294877798,
  tipo: 1,
  situacao: 6,
  numero: "000079",
  dataEmissao: "2026-11-03 15:11:00",
  dataOperacao: "0000-00-00 00:00:00",
  chaveAcesso: "35261156902602000199550010000000791948777982",
  contato: {
    id: 18235191570,
    nome: "ANTONIO MIGUEL BICHARA E OUTRO",
    numeroDocumento: "07945562000157",
    ie: "371211196113",
  },
  naturezaOperacao: { id: 15109374977 },
  loja: { id: 205890523 },
};

describe("nota de saída do Bling — o registro real", () => {
  const nota = lerNotaDeSaidaDoBling(NOTA_REAL_DO_BLING)!;

  it("é lida inteira", () => {
    expect(nota).toEqual({
      blingId: "27294877798",
      numero: "000079",
      serie: "001",
      chaveAcesso: "35261156902602000199550010000000791948777982",
      status: "EMITIDA",
      situacaoBling: 6,
      dataEmissao: new Date("2026-11-03T00:00:00.000Z"),
      clienteNome: "ANTONIO MIGUEL BICHARA E OUTRO",
      clienteDocumento: "07945562000157",
    });
  });

  it("o id vira TEXTO, não número", () => {
    // 27294877798 cabe num double hoje, mas id de sistema externo não é
    // quantidade: guardar como número é aceitar que um dia ele estoure ou
    // perca precisão sem ninguém notar.
    expect(typeof nota.blingId).toBe("string");
  });

  it("os zeros à esquerda do número sobrevivem", () => {
    // "000079" virando 79 faria o número na tela deixar de bater com o
    // número impresso na nota.
    expect(nota.numero).toBe("000079");
  });

  it("a data de emissão é meia-noite UTC, sem a hora", () => {
    // `new Date("2026-11-03 15:11:00")` ancoraria no fuso de quem executa —
    // é a mesma classe de bug que tirou os boletos do dia 30 do filtro.
    expect(nota.dataEmissao?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });
});

describe("a data-zero do MySQL", () => {
  it('"0000-00-00 00:00:00" vira nulo, não data inválida', () => {
    // Apareceu em `dataOperacao` no primeiro registro real lido. Parece data,
    // e `new Date()` nela devolve Invalid Date.
    expect(lerDataDoBling("0000-00-00 00:00:00")).toBeNull();
    expect(lerDataDoBling("0000-00-00")).toBeNull();
  });

  it("mês ou dia zerados também", () => {
    expect(lerDataDoBling("2026-00-15")).toBeNull();
    expect(lerDataDoBling("2026-11-00")).toBeNull();
  });

  it("data ausente, vazia ou sem forma de data vira nulo", () => {
    for (const ruim of [null, undefined, "", "   ", "ontem", 0, {}, []]) {
      expect(lerDataDoBling(ruim), JSON.stringify(ruim)).toBeNull();
    }
  });

  it("data boa com e sem hora funciona", () => {
    expect(lerDataDoBling("2026-11-03")?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(lerDataDoBling("2026-11-03 23:59:59")?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });

  it("23:59 não empurra a data para o dia seguinte", () => {
    // Seria o efeito de somar fuso: 23:59 em São Paulo é 02:59 UTC do dia
    // seguinte. Como só a parte da data é lida, não acontece.
    expect(lerDataDoBling("2026-11-03 23:59:00")?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });
});

describe("situação do Bling", () => {
  it("as três situações válidas viram EMITIDA", () => {
    for (const situacao of [5, 6, 7]) {
      expect(statusDaSituacaoDoBling(situacao), String(situacao)).toBe("EMITIDA");
    }
  });

  it("cancelada e denegada viram CANCELADA", () => {
    // Denegada existe no SEFAZ e nunca vai produzir efeito: não há o que
    // corrigir, então é o fim da linha como cancelada.
    expect(statusDaSituacaoDoBling(2)).toBe("CANCELADA");
    expect(statusDaSituacaoDoBling(9)).toBe("CANCELADA");
  });

  it("REJEITADA fica em PENDENTE, não em cancelada", () => {
    // Uma nota rejeitada não virou nota nenhuma e ainda espera uma ação do
    // dono. Chamá-la de cancelada esconderia um problema a resolver.
    expect(statusDaSituacaoDoBling(4)).toBe("PENDENTE");
  });

  it("as demais ficam em PENDENTE", () => {
    for (const situacao of [1, 3, 8, 10, 11]) {
      expect(statusDaSituacaoDoBling(situacao), String(situacao)).toBe("PENDENTE");
    }
  });

  it("situação desconhecida não derruba nada", () => {
    expect(statusDaSituacaoDoBling(99)).toBe("PENDENTE");
    expect(rotuloDaSituacaoDoBling(99)).toBe("Situação 99");
  });

  it("o rótulo por extenso existe para a tela", () => {
    expect(rotuloDaSituacaoDoBling(6)).toBe("Emitida DANFE");
    expect(rotuloDaSituacaoDoBling(4)).toBe("Rejeitada");
    expect(rotuloDaSituacaoDoBling(null)).toBe("—");
  });
});

describe("série, tirada da chave de acesso", () => {
  it("lê as posições 22-24 da chave", () => {
    // A listagem não traz a série em campo próprio, e número sem série é
    // ambíguo para quem usa mais de uma.
    expect(serieDaChave("35261156902602000199550010000000791948777982")).toBe("001");
  });

  it("chave ausente ou malformada não inventa série", () => {
    for (const ruim of [null, "", "123", "x".repeat(44)]) {
      expect(serieDaChave(ruim), String(ruim)).toBeNull();
    }
  });
});

describe("o que NÃO deve ser importado", () => {
  it("nota de entrada é descartada", () => {
    // Entrada é compra, e compra tem o seu próprio caminho na Konext.
    expect(lerNotaDeSaidaDoBling({ ...NOTA_REAL_DO_BLING, tipo: 0 })).toBeNull();
  });

  it("registro sem id é descartado", () => {
    // Sem id não há como atualizar nem reconhecer na próxima sincronização:
    // seria uma linha órfã, duplicada a cada leitura.
    expect(lerNotaDeSaidaDoBling({ ...NOTA_REAL_DO_BLING, id: null })).toBeNull();
    expect(lerNotaDeSaidaDoBling({})).toBeNull();
  });

  it("lixo no lugar do registro não estoura", () => {
    for (const ruim of [null, undefined, "nota", 42, []]) {
      expect(lerNotaDeSaidaDoBling(ruim), JSON.stringify(ruim)).toBeNull();
    }
  });

  it("chave que não tem 44 dígitos não é guardada como chave", () => {
    const nota = lerNotaDeSaidaDoBling({ ...NOTA_REAL_DO_BLING, chaveAcesso: "352611" })!;

    expect(nota.chaveAcesso).toBeNull();
    expect(nota.serie).toBeNull();
  });
});

describe("a página inteira", () => {
  it("lê o envelope `data` e filtra as entradas", () => {
    const pagina = lerPaginaDeNotas({
      data: [
        NOTA_REAL_DO_BLING,
        { ...NOTA_REAL_DO_BLING, id: 2, tipo: 0 },
        { ...NOTA_REAL_DO_BLING, id: 3 },
      ],
    });

    expect(pagina.map((n) => n.blingId)).toEqual(["27294877798", "3"]);
  });

  it("resposta sem `data` devolve lista vazia em vez de estourar", () => {
    for (const ruim of [{}, { data: null }, { data: "x" }, null, []]) {
      expect(lerPaginaDeNotas(ruim), JSON.stringify(ruim)).toEqual([]);
    }
  });

  it("página vazia é página vazia", () => {
    expect(lerPaginaDeNotas({ data: [] })).toEqual([]);
  });
});

/**
 * O DETALHE real, de `/nfe/27294877798`, copiado de uma chamada de verdade.
 * É daqui que saem o valor (que a listagem não traz) e as parcelas.
 */
const DETALHE_REAL = {
  data: {
    ...NOTA_REAL_DO_BLING,
    dataOperacao: "2026-11-03 15:11:00",
    serie: 1,
    valorNota: 250,
    valorFrete: 0,
    xml: "https://www.bling.com.br/relatorios/nfe.xml.php?chaveAcesso=35261156902602000199550010000000791948777982&s&signature=c576006ccd",
    linkDanfe: "https://www.bling.com.br/doc.view.php?id=1e5c75ef&accessKey=MTc5NDQx",
    linkPDF: "https://www.bling.com.br/doc.view.php?PDF=true&id=1e5c75ef",
    numeroPedidoLoja: "",
    itens: [
      { codigo: "", descricao: "FRONTAL", unidade: "UN", quantidade: 1, valor: 250, valorTotal: 250 },
    ],
    parcelas: [
      { data: "2026-12-01", valor: 250, observacoes: "", formaPagamento: { id: 8939358 } },
    ],
  },
};

describe("detalhe da nota — o que a listagem não dá", () => {
  const detalhe = lerDetalheDaNota(DETALHE_REAL)!;

  it("traz o valor da nota", () => {
    // A listagem não tem campo de valor nenhum: é por isso que o detalhe
    // precisa ser buscado, uma requisição por nota.
    expect(detalhe.valorNotaReais).toBe(250);
  });

  it("traz a parcela com a data de vencimento", () => {
    // É daqui que sai a conta a receber, sem precisar bater na API de contas.
    expect(detalhe.parcelas).toEqual([
      { vencimento: new Date("2026-12-01T00:00:00.000Z"), valorReais: 250 },
    ]);
  });

  it("prefere a série da chave de acesso à do campo", () => {
    // No campo vem o número 1; na chave vem "001", que é o que o contador lê.
    expect(detalhe.serie).toBe("001");
  });

  it("cai no campo `serie` quando não há chave", () => {
    const semChave = { data: { ...DETALHE_REAL.data, chaveAcesso: "" } };

    expect(lerDetalheDaNota(semChave)?.serie).toBe("1");
  });

  it("guarda os links do XML e da DANFE", () => {
    expect(detalhe.linkXml).toContain("nfe.xml.php");
    expect(detalhe.linkDanfe).toContain("doc.view.php");
  });

  it("junta a descrição dos itens para a tela", () => {
    expect(detalhe.descricaoDosItens).toBe("FRONTAL");
  });
});

describe("detalhe — links que não devem virar botão", () => {
  it("recusa link que não é do Bling", () => {
    // Estes links são guardados e viram botão clicável. O campo ser do Bling
    // hoje não é razão para a tela abrir qualquer endereço amanhã.
    for (const hostil of [
      "https://bling.com.br.exemplo.net/x",
      "http://www.bling.com.br/x",
      "javascript:alert(1)",
      "https://evil.test/nfe.xml",
      "nao-e-url",
    ]) {
      const nota = { data: { ...DETALHE_REAL.data, xml: hostil } };
      expect(lerDetalheDaNota(nota)?.linkXml, hostil).toBeNull();
    }
  });

  it("aceita o domínio do Bling com e sem www", () => {
    for (const bom of ["https://bling.com.br/x", "https://www.bling.com.br/x"]) {
      const nota = { data: { ...DETALHE_REAL.data, xml: bom } };
      expect(lerDetalheDaNota(nota)?.linkXml, bom).toBe(bom);
    }
  });
});

describe("detalhe — parcelas incompletas", () => {
  it("parcela sem data ou sem valor é descartada", () => {
    // Ela não teria quando vencer nem quanto cobrar, e uma conta assim na
    // tela é pior que conta nenhuma.
    const nota = {
      data: {
        ...DETALHE_REAL.data,
        parcelas: [
          { data: "2026-12-01", valor: 250 },
          { data: "0000-00-00", valor: 100 },
          { data: "2026-12-15" },
          { valor: 50 },
          "lixo",
        ],
      },
    };

    expect(lerDetalheDaNota(nota)?.parcelas).toHaveLength(1);
  });

  it("nota sem parcelas não estoura", () => {
    for (const parcelas of [[], null, undefined, "x"]) {
      const nota = { data: { ...DETALHE_REAL.data, parcelas } };
      expect(lerDetalheDaNota(nota)?.parcelas, JSON.stringify(parcelas)).toEqual([]);
    }
  });

  it("várias parcelas viram várias contas", () => {
    const nota = {
      data: {
        ...DETALHE_REAL.data,
        parcelas: [
          { data: "2026-12-01", valor: 125 },
          { data: "2027-01-01", valor: 125 },
        ],
      },
    };

    expect(lerDetalheDaNota(nota)?.parcelas.map((p) => p.valorReais)).toEqual([125, 125]);
  });
});

describe("detalhe — bordas", () => {
  it("aceita o detalhe com e sem envelope `data`", () => {
    expect(lerDetalheDaNota(DETALHE_REAL.data)?.blingId).toBe("27294877798");
    expect(lerDetalheDaNota(DETALHE_REAL)?.blingId).toBe("27294877798");
  });

  it("sem id, não há detalhe", () => {
    expect(lerDetalheDaNota({ data: { valorNota: 250 } })).toBeNull();
    expect(lerDetalheDaNota(null)).toBeNull();
  });

  it("valor ausente vira nulo, nunca zero", () => {
    // Zero somaria errado no total da tela sem ninguém desconfiar.
    const nota = { data: { ...DETALHE_REAL.data, valorNota: undefined } };

    expect(lerDetalheDaNota(nota)?.valorNotaReais).toBeNull();
  });

  it("valor com centavos sobrevive", () => {
    const nota = { data: { ...DETALHE_REAL.data, valorNota: 1234.56 } };

    expect(lerDetalheDaNota(nota)?.valorNotaReais).toBe(1234.56);
  });
});
