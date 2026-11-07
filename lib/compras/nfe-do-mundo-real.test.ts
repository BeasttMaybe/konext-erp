import { describe, expect, it } from "vitest";

import { calcularCustos } from "@/lib/dominio/compras/custo";
import { conferirNota } from "@/lib/dominio/compras/nota";
import { somar } from "@/lib/dinheiro";

import { lerXmlDeNota } from "./ler-xml-de-nota";

/**
 * NF-e como ela chega de verdade, e não como o exemplo do manual.
 *
 * O leitor de XML passava na nota que eu mesmo escrevi — e, como todo
 * parser, passava justamente porque eu a escrevi. Estas são as formas que
 * uma nota brasileira de acessório toma na prática, e três delas chegavam
 * MARCADAS sem ter nada de errado.
 *
 * Alarme falso é pior que alarme nenhum: ele ensina quem confere a ignorar
 * o aviso, e aí o aviso verdadeiro passa junto.
 */

function nfe(dets: string, icmsTot: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe35261000111222000133550010000001231000001239" versao="4.00">
<ide><nNF>700</nNF><serie>1</serie><dhEmi>2026-11-05T09:00:00-03:00</dhEmi></ide>
<emit><CNPJ>00111222000133</CNPJ><xNome>FORNECEDOR TESTE LTDA</xNome></emit>
${dets}
<total><ICMSTot>${icmsTot}</ICMSTot></total>
</infNFe></NFe></nfeProc>`;
}

function det({
  n,
  xProd,
  q,
  vu,
  vp,
  imposto = "<ICMS><ICMS00><orig>0</orig></ICMS00></ICMS>",
  indTot = "1",
}: {
  n: number;
  xProd: string;
  q: string;
  vu: string;
  vp: string;
  imposto?: string;
  indTot?: string;
}) {
  return `<det nItem="${n}"><prod><cProd>P${n}</cProd><cEAN>SEM GTIN</cEAN><xProd>${xProd}</xProd><NCM>85171231</NCM><CFOP>6404</CFOP><uCom>UN</uCom><qCom>${q}</qCom><vUnCom>${vu}</vUnCom><vProd>${vp}</vProd><indTot>${indTot}</indTot></prod><imposto>${imposto}</imposto></det>`;
}

const ST = (valor: string) =>
  `<ICMS><ICMS10><orig>0</orig><vBCST>130.00</vBCST><vICMSST>${valor}</vICMSST></ICMS10></ICMS>`;

describe("NF-e com ICMS-ST — que em acessório de celular é a regra", () => {
  const xml = nfe(
    det({ n: 1, xProd: "CAPA SILICONE", q: "10.0000", vu: "10.0000000000", vp: "100.00", imposto: ST("23.40") }) +
      det({ n: 2, xProd: "PELICULA 3D", q: "20.0000", vu: "5.0000000000", vp: "100.00", imposto: ST("23.40") }),
    "<vProd>200.00</vProd><vST>46.80</vST><vFrete>20.00</vFrete><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vNF>266.80</vNF>"
  );

  it("fecha, em vez de reprovar uma nota correta", () => {
    // O total de uma NF-e não é `produtos + frete − desconto`: a fórmula do
    // layout soma ST, IPI, seguro e outras despesas. Sem elas, TODA nota com
    // substituição tributária chegava marcada.
    expect(conferirNota(lerXmlDeNota(xml)).problemas).toEqual([]);
    expect(conferirNota(lerXmlDeNota(xml)).fecha).toBe(true);
  });

  it("o ST entra no custo do produto, porque é dinheiro que saiu", () => {
    // Numa empresa do Simples a substituição tributária da compra é custo,
    // não crédito. A capa comprada a R$ 10,00 custou R$ 13,34 de verdade:
    // R$ 100,00 da linha + R$ 10,00 de frete rateado + R$ 23,40 de ST, em
    // 10 unidades.
    const nota = lerXmlDeNota(xml);
    const custos = calcularCustos({
      itens: nota.itens,
      freteCentavos: nota.valorFreteCentavos,
      descontoCentavos: nota.valorDescontoCentavos,
      criterio: "VALOR",
    });

    expect(custos[0].impostosCentavos).toBe(2_340);
    expect(custos[0].custoUnitarioCentavos).toBe(1_334);
    expect(custos[0].custoUnitarioCentavos).toBeGreaterThan(1_000);
  });

  it("o custo total da compra bate com o que a nota cobrou", () => {
    const nota = lerXmlDeNota(xml);
    const custos = calcularCustos({
      itens: nota.itens,
      freteCentavos: nota.valorFreteCentavos,
      descontoCentavos: nota.valorDescontoCentavos,
      criterio: "VALOR",
    });

    expect(somar(...custos.map((custo) => custo.custoTotalCentavos))).toBe(26_680);
    expect(nota.valorTotalCentavos).toBe(26_680);
  });

  it("acha o ST onde quer que ele esteja pendurado", () => {
    // O nó do ICMS tem nome variável conforme a tributação — ICMS00, ICMS10,
    // ICMS60, ICMSSN201 e mais uma dúzia. Procurar por caminho fixo é
    // escrever a lista inteira e errar a próxima que o layout inventar.
    for (const no of ["ICMS60", "ICMSSN201", "ICMSST", "ICMS70"]) {
      const comOutroNo = nfe(
        det({
          n: 1,
          xProd: "ITEM",
          q: "1.0000",
          vu: "10.0000000000",
          vp: "10.00",
          imposto: `<ICMS><${no}><orig>0</orig><vICMSST>2.50</vICMSST></${no}></ICMS>`,
        }),
        "<vProd>10.00</vProd><vST>2.50</vST><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vNF>12.50</vNF>"
      );

      expect(lerXmlDeNota(comOutroNo).itens[0].impostosCentavos, no).toBe(250);
    }
  });

  it("ST já retido antes não é cobrado de novo", () => {
    // `vICMSSTRet` é substituição recolhida numa operação anterior: o
    // emitente informa, mas não cobra nesta nota. Somá-lo inflaria o custo.
    const comRetido = nfe(
      det({
        n: 1,
        xProd: "ITEM",
        q: "1.0000",
        vu: "10.0000000000",
        vp: "10.00",
        imposto: "<ICMS><ICMS60><orig>0</orig><vICMSSTRet>3.00</vICMSSTRet></ICMS60></ICMS>",
      }),
      "<vProd>10.00</vProd><vST>0.00</vST><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vNF>10.00</vNF>"
    );

    expect(lerXmlDeNota(comRetido).itens[0].impostosCentavos).toBe(0);
  });
});

describe("NF-e com IPI", () => {
  const xml = nfe(
    det({
      n: 1,
      xProd: "FONTE 20W",
      q: "5.0000",
      vu: "20.0000000000",
      vp: "100.00",
      imposto: "<ICMS><ICMS00><orig>0</orig></ICMS00></ICMS><IPI><IPITrib><vIPI>5.00</vIPI></IPITrib></IPI>",
    }),
    "<vProd>100.00</vProd><vST>0.00</vST><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vIPI>5.00</vIPI><vNF>105.00</vNF>"
  );

  it("fecha e o IPI vai pro custo", () => {
    expect(conferirNota(lerXmlDeNota(xml)).fecha).toBe(true);
    expect(lerXmlDeNota(xml).itens[0].impostosCentavos).toBe(500);
  });
});

describe("item que não compõe o total (indTot = 0)", () => {
  const xml = nfe(
    det({ n: 1, xProd: "KIT COMPLETO", q: "1.0000", vu: "50.0000000000", vp: "50.00" }) +
      det({ n: 2, xProd: "BRINDE INCLUSO NO KIT", q: "1.0000", vu: "10.0000000000", vp: "10.00", indTot: "0" }),
    "<vProd>50.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vNF>50.00</vNF>"
  );

  it("o brinde entra no estoque, mas fica de fora da soma", () => {
    // Ele CHEGOU na loja — tem que entrar. Mas o valor dele não está no que
    // foi pago, e contá-lo fazia a soma nunca bater com o total declarado.
    const nota = lerXmlDeNota(xml);

    expect(nota.itens).toHaveLength(2);
    expect(nota.itens[1].compoeTotal).toBe(false);
    expect(conferirNota(nota).problemas).toEqual([]);
  });

  it("`indTot` ausente vale 1, como manda o layout", () => {
    expect(lerXmlDeNota(xml).itens[0].compoeTotal).toBe(true);
  });
});

describe("blocos que podem faltar", () => {
  it("nota sem destinatário é lida igual", () => {
    const xml = nfe(
      det({ n: 1, xProd: "CABO USB-C", q: "3.0000", vu: "7.0000000000", vp: "21.00" }),
      "<vProd>21.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vNF>21.00</vNF>"
    );

    const nota = lerXmlDeNota(xml);
    expect(nota.destinatarioCnpj).toBeNull();
    expect(conferirNota(nota).fecha).toBe(true);
  });

  it("seguro e outras despesas também somam ao total", () => {
    const xml = nfe(
      det({ n: 1, xProd: "ITEM", q: "1.0000", vu: "100.0000000000", vp: "100.00" }),
      "<vProd>100.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vSeg>7.00</vSeg><vOutro>3.00</vOutro><vNF>110.00</vNF>"
    );

    expect(conferirNota(lerXmlDeNota(xml)).fecha).toBe(true);
  });
});

describe("o que a tela envia pro servidor", () => {
  /**
   * O custo é recalculado no servidor de propósito — número que vai pro
   * cadastro do produto não pode ter passado pelo navegador. Só que o
   * recálculo depende dos campos CHEGAREM lá.
   *
   * `impostosCentavos` e `compoeTotal` não estavam na lista do envio, e um
   * `as ItemLidoDaNota[]` no servidor calava o erro de tipo que apontaria
   * isso. Resultado: o leitor lia o ICMS-ST certo, a tela mostrava certo, e
   * o custo gravado no banco saía sem imposto. Este teste monta o envio com
   * o MESMO recorte de campos que a tela usa e refaz a conta do servidor.
   */
  const xml = nfe(
    det({ n: 1, xProd: "CAPA", q: "10.0000", vu: "10.0000000000", vp: "100.00", imposto: ST("23.40") }) +
      det({ n: 2, xProd: "BRINDE", q: "1.0000", vu: "5.0000000000", vp: "5.00", indTot: "0" }),
    "<vProd>100.00</vProd><vST>23.40</vST><vFrete>20.00</vFrete><vDesc>0.00</vDesc><vNF>143.40</vNF>"
  );

  const nota = lerXmlDeNota(xml);

  // Exatamente os campos que `pagina-entrada-de-nota.tsx` manda.
  const enviados = nota.itens.map((item) => ({
    ordem: item.ordem,
    quantidade: item.quantidade,
    compoeTotal: item.compoeTotal,
    impostosCentavos: item.impostosCentavos,
    valorTotalCentavos: item.valorTotalCentavos,
  }));

  it("o envio carrega o imposto de cada item", () => {
    expect(enviados[0].impostosCentavos).toBe(2_340);
  });

  it("o envio carrega quem compõe o total", () => {
    expect(enviados.map((item) => item.compoeTotal)).toEqual([true, false]);
  });

  it("a conta do servidor com o que foi enviado dá o total da nota", () => {
    const produtos = somar(
      ...enviados.filter((item) => item.compoeTotal).map((item) => item.valorTotalCentavos)
    );
    const impostos = somar(...enviados.map((item) => item.impostosCentavos));

    expect(produtos + nota.valorFreteCentavos + impostos - nota.valorDescontoCentavos).toBe(
      nota.valorTotalCentavos
    );
    expect(nota.valorTotalCentavos).toBe(14_340);
  });

  it("o custo do servidor sai com imposto quando o envio o carrega", () => {
    const custos = calcularCustos({
      itens: enviados,
      freteCentavos: nota.valorFreteCentavos,
      descontoCentavos: nota.valorDescontoCentavos,
      criterio: "VALOR",
    });

    // R$ 100,00 da linha + R$ 19,05 de frete rateado + R$ 23,40 de ST, em 10.
    expect(custos[0].custoUnitarioCentavos).toBe(1_425);
  });
});
