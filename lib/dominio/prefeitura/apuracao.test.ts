import { describe, expect, it } from "vitest";

import { apurarNota, apurarPeriodo, custoDaNota, diasDePrazo, type NotaApuracao } from "./apuracao";

function nota(parcial: Partial<NotaApuracao>): NotaApuracao {
  return {
    receitaCentavos: 100_00,
    modoCusto: "ITENS",
    custoTotalInformadoCentavos: null,
    impostosCentavos: null,
    itens: [],
    recebida: false,
    dataEmissao: null,
    dataVencimento: null,
    ...parcial,
  };
}

describe("custoDaNota", () => {
  it("soma os custos dos itens e marca completo quando todos têm custo", () => {
    const c = custoDaNota(
      nota({ itens: [{ valorVendaCentavos: 60_00, custoCentavos: 40_00 }, { valorVendaCentavos: 40_00, custoCentavos: 25_00 }] })
    );
    expect(c.custoCentavos).toBe(65_00);
    expect(c.completo).toBe(true);
    expect(c.temBase).toBe(true);
    expect(c.itensSemCusto).toBe(0);
  });

  it("marca incompleto e conta os itens sem custo", () => {
    const c = custoDaNota(
      nota({ itens: [{ valorVendaCentavos: 60_00, custoCentavos: 40_00 }, { valorVendaCentavos: 40_00, custoCentavos: null }] })
    );
    expect(c.custoCentavos).toBe(40_00);
    expect(c.completo).toBe(false);
    expect(c.itensSemCusto).toBe(1);
  });

  it("sem itens não tem base de custo", () => {
    const c = custoDaNota(nota({ itens: [] }));
    expect(c.temBase).toBe(false);
    expect(c.completo).toBe(false);
  });

  it("modo TOTAL usa o custo informado", () => {
    const c = custoDaNota(nota({ modoCusto: "TOTAL", custoTotalInformadoCentavos: 70_00, itens: [] }));
    expect(c.custoCentavos).toBe(70_00);
    expect(c.completo).toBe(true);
  });

  it("modo TOTAL sem valor informado fica incompleto", () => {
    const c = custoDaNota(nota({ modoCusto: "TOTAL", custoTotalInformadoCentavos: null }));
    expect(c.completo).toBe(false);
    expect(c.temBase).toBe(false);
    expect(c.custoCentavos).toBe(0);
  });
});

describe("diasDePrazo", () => {
  it("conta os dias entre emissão e vencimento", () => {
    expect(diasDePrazo(nota({ dataEmissao: new Date("2026-01-01"), dataVencimento: new Date("2026-01-31") }))).toBe(30);
  });
  it("é nulo quando falta data", () => {
    expect(diasDePrazo(nota({ dataEmissao: new Date("2026-01-01"), dataVencimento: null }))).toBeNull();
  });
  it("nunca é negativo", () => {
    expect(diasDePrazo(nota({ dataEmissao: new Date("2026-02-10"), dataVencimento: new Date("2026-02-01") }))).toBe(0);
  });
});

describe("apurarNota", () => {
  it("calcula lucro bruto, margem e líquido com impostos conhecidos", () => {
    const a = apurarNota(
      nota({
        receitaCentavos: 100_00,
        itens: [{ valorVendaCentavos: 100_00, custoCentavos: 60_00 }],
        impostosCentavos: 10_00,
      })
    );
    expect(a.lucroBrutoCentavos).toBe(40_00);
    expect(a.margemBrutaPct).toBeCloseTo(40);
    expect(a.impostosConhecidos).toBe(true);
    expect(a.lucroLiquidoCentavos).toBe(30_00);
  });

  it("impostos desconhecidos entram como zero mas ficam sinalizados", () => {
    const a = apurarNota(nota({ receitaCentavos: 100_00, itens: [{ valorVendaCentavos: 100_00, custoCentavos: 60_00 }] }));
    expect(a.impostosConhecidos).toBe(false);
    expect(a.lucroLiquidoCentavos).toBe(40_00);
  });

  it("margem é nula quando a receita é zero", () => {
    expect(apurarNota(nota({ receitaCentavos: 0, itens: [] })).margemBrutaPct).toBeNull();
  });

  it("consome caixa quando não recebida; zera quando recebida", () => {
    const base = { receitaCentavos: 100_00, itens: [{ valorVendaCentavos: 100_00, custoCentavos: 60_00 }] };
    expect(apurarNota(nota({ ...base, recebida: false })).caixaConsumidoCentavos).toBe(60_00);
    expect(apurarNota(nota({ ...base, recebida: true })).caixaConsumidoCentavos).toBe(0);
  });
});

describe("apurarPeriodo", () => {
  it("agrega receita, custo e lucro só das notas com custo completo", () => {
    const r = apurarPeriodo([
      nota({ receitaCentavos: 100_00, itens: [{ valorVendaCentavos: 100_00, custoCentavos: 60_00 }], recebida: true }),
      // custo pendente: entra na receita total, mas não na apurada
      nota({ receitaCentavos: 50_00, itens: [{ valorVendaCentavos: 50_00, custoCentavos: null }] }),
    ]);
    expect(r.notas).toBe(2);
    expect(r.receitaTotalCentavos).toBe(150_00);
    expect(r.custoLancadoCentavos).toBe(60_00);
    expect(r.notasComCustoPendente).toBe(1);
    expect(r.receitaApuradaCentavos).toBe(100_00);
    expect(r.lucroBrutoApuradoCentavos).toBe(40_00);
    expect(r.margemBrutaPct).toBeCloseTo(40);
  });

  it("a receber em aberto e caixa consumido contam só as não recebidas", () => {
    const r = apurarPeriodo([
      nota({ receitaCentavos: 100_00, itens: [{ valorVendaCentavos: 100_00, custoCentavos: 60_00 }], recebida: false }),
      nota({ receitaCentavos: 80_00, itens: [{ valorVendaCentavos: 80_00, custoCentavos: 50_00 }], recebida: true }),
    ]);
    expect(r.aReceberAbertoCentavos).toBe(100_00);
    expect(r.caixaConsumidoCentavos).toBe(60_00);
  });

  it("prazo médio é ponderado pela receita", () => {
    const r = apurarPeriodo([
      nota({ receitaCentavos: 100_00, dataEmissao: new Date("2026-01-01"), dataVencimento: new Date("2026-01-31") }), // 30d, peso 100
      nota({ receitaCentavos: 300_00, dataEmissao: new Date("2026-01-01"), dataVencimento: new Date("2026-03-02") }), // 60d, peso 300
    ]);
    // (30*100 + 60*300) / 400 = 52,5 -> 53 (arredonda)
    expect(r.prazoMedioDias).toBe(53);
  });

  it("período vazio não quebra", () => {
    const r = apurarPeriodo([]);
    expect(r.notas).toBe(0);
    expect(r.margemBrutaPct).toBeNull();
    expect(r.prazoMedioDias).toBeNull();
  });
});
