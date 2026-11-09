import { describe, expect, it } from "vitest";

import { dataDeCalendario } from "@/lib/datas";

import {
  casarNotaComVenda,
  documentoComparavel,
  explicarNaoCasamento,
  type NotaParaCasar,
  type VendaCandidata,
} from "./casamento-de-venda";

const em = (iso: string) => dataDeCalendario(iso)!;

const NOTA: NotaParaCasar = {
  clienteDocumento: "07945562000157",
  valorCentavos: 25_000,
  dataEmissao: em("2026-11-03"),
};

function venda(parcial: Partial<VendaCandidata> = {}): VendaCandidata {
  return {
    id: "venda-1",
    clienteDocumento: "07945562000157",
    valorCentavos: 25_000,
    data: em("2026-11-01"),
    ...parcial,
  };
}

const casar = (candidatas: VendaCandidata[], nota: NotaParaCasar = NOTA) =>
  casarNotaComVenda({ nota, candidatas });

describe("casar nota do Bling com venda do Konext", () => {
  it("casa quando cliente, valor e data batem", () => {
    expect(casar([venda()])).toEqual({ casou: true, vendaId: "venda-1" });
  });

  it("casa com a nota emitida antes ou depois da venda", () => {
    // Emitir no dia seguinte é rotina; lançar a venda depois de emitir também.
    for (const dia of ["2026-10-28", "2026-11-03", "2026-11-10"]) {
      expect(casar([venda({ data: em(dia) })]), dia).toEqual({ casou: true, vendaId: "venda-1" });
    }
  });

  it("escolhe a única compatível no meio de várias vendas", () => {
    const resultado = casar([
      venda({ id: "outro-cliente", clienteDocumento: "11222333000181" }),
      venda({ id: "certa" }),
      venda({ id: "outro-valor", valorCentavos: 25_001 }),
    ]);

    expect(resultado).toEqual({ casou: true, vendaId: "certa" });
  });
});

describe("quando NÃO casar é a resposta certa", () => {
  it("DOIS candidatos iguais não casam nenhum", () => {
    // É a regra que mais importa. Mesmo cliente, mesmo valor, mesma semana:
    // não existe informação para escolher, e escolher seria gravar um
    // palpite como fato — num vínculo que aparece no histórico dos dois
    // clientes e no financeiro.
    const resultado = casar([venda({ id: "a" }), venda({ id: "b", data: em("2026-11-02") })]);

    expect(resultado).toEqual({ casou: false, motivo: "MAIS_DE_UM_CANDIDATO" });
  });

  it("documento diferente não casa", () => {
    expect(casar([venda({ clienteDocumento: "11222333000181" })])).toEqual({
      casou: false,
      motivo: "NENHUM_CANDIDATO",
    });
  });

  it("UM CENTAVO de diferença não casa", () => {
    // Tolerância aqui convidaria duas vendas próximas a se confundirem.
    for (const centavos of [24_999, 25_001]) {
      expect(casar([venda({ valorCentavos: centavos })]), String(centavos)).toEqual({
        casou: false,
        motivo: "NENHUM_CANDIDATO",
      });
    }
  });

  it("fora da janela de dias não casa", () => {
    for (const dia of ["2026-10-26", "2026-11-11"]) {
      expect(casar([venda({ data: em(dia) })]), dia).toEqual({
        casou: false,
        motivo: "NENHUM_CANDIDATO",
      });
    }
  });

  it("nota sem documento NUNCA casa, mesmo com uma só candidata", () => {
    // Nome não serve: "João da Silva" é muitos Joões.
    const resultado = casar([venda()], { ...NOTA, clienteDocumento: null });

    expect(resultado).toEqual({ casou: false, motivo: "NOTA_SEM_DOCUMENTO" });
  });

  it("nota sem valor não casa — o valor ainda não foi lido do Bling", () => {
    expect(casar([venda()], { ...NOTA, valorCentavos: null })).toEqual({
      casou: false,
      motivo: "NOTA_SEM_VALOR",
    });
  });

  it("nota sem data não casa", () => {
    expect(casar([venda()], { ...NOTA, dataEmissao: null })).toEqual({
      casou: false,
      motivo: "NOTA_SEM_DATA",
    });
  });

  it("sem candidata nenhuma, não casa", () => {
    expect(casar([])).toEqual({ casou: false, motivo: "NENHUM_CANDIDATO" });
  });

  it("venda sem documento não entra como candidata", () => {
    expect(casar([venda({ clienteDocumento: null })])).toEqual({
      casou: false,
      motivo: "NENHUM_CANDIDATO",
    });
  });
});

describe("documento comparável", () => {
  it("ignora pontuação", () => {
    // O Bling manda só dígitos, mas o Konext guarda formatado — comparar
    // texto cru faria nenhuma nota casar nunca.
    expect(documentoComparavel("07.945.562/0001-57")).toBe("07945562000157");
    expect(documentoComparavel("123.456.789-09")).toBe("12345678909");
  });

  it("casa documento formatado com documento cru", () => {
    expect(casar([venda({ clienteDocumento: "07.945.562/0001-57" })])).toEqual({
      casou: true,
      vendaId: "venda-1",
    });
  });

  it("recusa o que não tem tamanho de CPF nem de CNPJ", () => {
    for (const ruim of [null, undefined, "", "123", "0".repeat(20), "abc"]) {
      expect(documentoComparavel(ruim), String(ruim)).toBeNull();
    }
  });

  it("CPF de 11 e CNPJ de 14 dígitos passam", () => {
    expect(documentoComparavel("12345678909")).toBe("12345678909");
    expect(documentoComparavel("07945562000157")).toBe("07945562000157");
  });
});

describe("explicação do não-casamento", () => {
  it("todo motivo tem texto, e nenhum é genérico", () => {
    const motivos = [
      "NOTA_SEM_DOCUMENTO",
      "NOTA_SEM_VALOR",
      "NOTA_SEM_DATA",
      "NENHUM_CANDIDATO",
      "MAIS_DE_UM_CANDIDATO",
    ] as const;

    const textos = motivos.map(explicarNaoCasamento);

    expect(new Set(textos).size).toBe(motivos.length);
    for (const texto of textos) expect(texto.length).toBeGreaterThan(20);
  });

  it("o caso ambíguo diz o que fazer", () => {
    expect(explicarNaoCasamento("MAIS_DE_UM_CANDIDATO")).toContain("à mão");
  });
});
