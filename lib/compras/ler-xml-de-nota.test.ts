import { describe, expect, it } from "vitest";

import { conferirDestinatario } from "@/lib/dominio/compras/leitura-xml";
import { conferirNota } from "@/lib/dominio/compras/nota";

import { lerXmlDeNota } from "./ler-xml-de-nota";

/**
 * A NF-e aqui é escrita à mão no layout 4.00 oficial, com os mesmos valores
 * do orçamento real da EA CENTRAL — mesmos itens, mesmo frete, mesmo total.
 *
 * É de propósito: as duas portas de entrada têm que chegar no mesmo lugar, e
 * ter o mesmo documento nos dois formatos é o que mostra que chegam.
 */
const CHAVE = "35261000111222000133550010000001231000001239";

function nfe({
  itens,
  totais,
  emitenteCnpj = "00111222000133",
  destinatarioCnpj = "99888777000166",
}: {
  itens: string;
  totais: string;
  emitenteCnpj?: string;
  destinatarioCnpj?: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${CHAVE}" versao="4.00">
      <ide>
        <nNF>123</nNF>
        <serie>1</serie>
        <dhEmi>2026-10-22T10:35:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>${emitenteCnpj}</CNPJ>
        <xNome>EA CENTRAL COMERCIO DE ACESSORIOS LTDA</xNome>
        <xFant>EA CENTRAL</xFant>
      </emit>
      <dest>
        <CNPJ>${destinatarioCnpj}</CNPJ>
        <xNome>KONEXT TECH</xNome>
      </dest>
${itens}
      <total><ICMSTot>${totais}</ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe>
</nfeProc>`;
}

function item(
  n: number,
  { cProd, xProd, uCom = "UN", qCom, vUnCom, vProd, cEAN = "SEM GTIN", ncm = "39269090" }: {
    cProd: string;
    xProd: string;
    uCom?: string;
    qCom: string;
    vUnCom: string;
    vProd: string;
    cEAN?: string;
    ncm?: string;
  }
): string {
  return `      <det nItem="${n}">
        <prod>
          <cProd>${cProd}</cProd>
          <cEAN>${cEAN}</cEAN>
          <xProd>${xProd}</xProd>
          <NCM>${ncm}</NCM>
          <CFOP>6102</CFOP>
          <uCom>${uCom}</uCom>
          <qCom>${qCom}</qCom>
          <vUnCom>${vUnCom}</vUnCom>
          <vProd>${vProd}</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto><ICMS><ICMS00><orig>0</orig></ICMS00></ICMS></imposto>
      </det>`;
}

const NOTA_COMPLETA = nfe({
  itens: [
    item(1, { cProd: "CS18P", xProd: "CASE DE IPHONE IP 18 PRO", qCom: "4.0000", vUnCom: "6.5000000000", vProd: "26.00", cEAN: "7898123456789" }),
    item(2, { cProd: "CS18PM", xProd: "CASE DE IPHONE IP 18 PRO MAX", qCom: "4.0000", vUnCom: "6.5000000000", vProd: "26.00" }),
    item(3, { cProd: "FT20W", xProd: "FONTE H'MASTON 20W USB-C", qCom: "5.0000", vUnCom: "16.0000000000", vProd: "80.00" }),
  ].join("\n"),
  totais: `
        <vProd>132.00</vProd>
        <vFrete>25.00</vFrete>
        <vDesc>0.00</vDesc>
        <vNF>157.00</vNF>`,
});

describe("compras/ler-xml-de-nota", () => {
  it("a chave de acesso sobrevive inteira, com os 44 dígitos", () => {
    // É a armadilha nº 1 do formato: 44 dígitos passam MUITO do inteiro
    // exato do JavaScript, e um parser que converte tag em número devolve
    // 3.526...e+43, com os dígitos finais perdidos e nenhum erro.
    const nota = lerXmlDeNota(NOTA_COMPLETA);

    expect(nota.chaveAcesso).toBe(CHAVE);
    expect(nota.chaveAcesso).toHaveLength(44);
  });

  it("lê emitente, número e data", () => {
    const nota = lerXmlDeNota(NOTA_COMPLETA);

    expect(nota.emitenteNome).toBe("EA CENTRAL COMERCIO DE ACESSORIOS LTDA");
    expect(nota.emitenteCnpj).toBe("00111222000133");
    expect(nota.numero).toBe("123");
    expect(nota.serie).toBe("1");
    expect(nota.emitidaEm).toBe("2026-10-22");
  });

  it("lê os itens com código do fornecedor, NCM e unidade", () => {
    const nota = lerXmlDeNota(NOTA_COMPLETA);

    expect(nota.itens).toHaveLength(3);
    expect(nota.itens[0]).toMatchObject({
      descricao: "CASE DE IPHONE IP 18 PRO",
      codigoFornecedor: "CS18P",
      ean: "7898123456789",
      ncm: "39269090",
      unidade: "UN",
      quantidade: 4,
      valorUnitarioCentavos: 650,
      valorTotalCentavos: 2_600,
    });
  });

  it('"SEM GTIN" não vira código de barras', () => {
    // Se virasse, todo produto sem GTIN do catálogo colidiria no mesmo
    // código de barras — e `Produto.codigoBarras` é único.
    const nota = lerXmlDeNota(NOTA_COMPLETA);
    expect(nota.itens[1].ean).toBeNull();
  });

  it("a conta da nota fecha", () => {
    const conferencia = conferirNota(lerXmlDeNota(NOTA_COMPLETA));

    expect(conferencia.problemas).toEqual([]);
    expect(conferencia.somaDosItensCentavos).toBe(13_200);
    expect(conferencia.fecha).toBe(true);
  });

  it("nota de um item só não vira nota de zero itens", () => {
    // `det` vira OBJETO quando há um item e ARRAY a partir de dois. Tratar
    // só o array é o jeito mais fácil de perder a nota inteira em silêncio.
    const nota = lerXmlDeNota(
      nfe({
        itens: item(1, { cProd: "UNICO", xProd: "CABO USB-C 1M", qCom: "10.0000", vUnCom: "6.5000000000", vProd: "65.00" }),
        totais: "<vProd>65.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vNF>65.00</vNF>",
      })
    );

    expect(nota.itens).toHaveLength(1);
    expect(nota.itens[0].descricao).toBe("CABO USB-C 1M");
  });

  it("unitário com dez casas decimais não reprova a linha", () => {
    // `vUnCom` tem até 10 casas; `vProd`, duas. 3 × 1,6666666667 arredondado
    // ao centavo dá 5,01, e a nota declara 5,00 — um centavo de diferença
    // que é matemática do formato, não erro de leitura.
    const nota = lerXmlDeNota(
      nfe({
        itens: item(1, { cProd: "DZ", xProd: "PARAFUSO", qCom: "3.0000", vUnCom: "1.6666666667", vProd: "5.00" }),
        totais: "<vProd>5.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vNF>5.00</vNF>",
      })
    );

    expect(conferirNota(nota).fecha).toBe(true);
  });

  it("coluna trocada continua reprovando", () => {
    // O lado oposto do teste acima: a tolerância não pode ser tão larga que
    // deixe passar o erro que ela existe pra pegar.
    const nota = lerXmlDeNota(
      nfe({
        itens: item(1, { cProd: "X", xProd: "ITEM", qCom: "4.0000", vUnCom: "26.0000000000", vProd: "26.00" }),
        totais: "<vProd>26.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vNF>26.00</vNF>",
      })
    );

    expect(conferirNota(nota).itens[0].problemas).toContain("TOTAL_NAO_BATE");
  });

  it("aceita a NFe sem o invólucro de autorização", () => {
    // É comum o fornecedor mandar só o miolo por e-mail, sem o `nfeProc`.
    const comProtocolo = lerXmlDeNota(NOTA_COMPLETA);
    const semProtocolo = lerXmlDeNota(
      NOTA_COMPLETA.replace(/<nfeProc[^>]*>/, "")
        .replace("</nfeProc>", "")
        .replace(/<protNFe>[\s\S]*?<\/protNFe>/, "")
    );

    expect(semProtocolo.itens).toHaveLength(comProtocolo.itens.length);
    expect(semProtocolo.chaveAcesso).toBe(CHAVE);
  });

  it("recusa um arquivo que não é NF-e, dizendo o que fazer", () => {
    expect(() => lerXmlDeNota("<evento><infEvento><tpEvento>110111</tpEvento></infEvento></evento>")).toThrow(
      /não é uma NF-e/i
    );
    expect(() => lerXmlDeNota("")).toThrow(/vazio/i);
  });
});

describe("compras/ler-xml-de-nota — de quem é esta nota", () => {
  const CNPJ_DA_LOJA = "99888777000166";

  it("nota destinada à loja passa", () => {
    expect(conferirDestinatario(lerXmlDeNota(NOTA_COMPLETA), CNPJ_DA_LOJA)).toBeNull();
    // Aceita o CNPJ formatado, que é como ele costuma estar cadastrado.
    expect(conferirDestinatario(lerXmlDeNota(NOTA_COMPLETA), "99.888.777/0001-66")).toBeNull();
  });

  it("nota que a própria loja emitiu é barrada", () => {
    // Importar uma venda como compra SOMA no estoque o que deveria subtrair.
    const minhaVenda = nfe({
      itens: item(1, { cProd: "A", xProd: "PELICULA", qCom: "1.0000", vUnCom: "20.00", vProd: "20.00" }),
      totais: "<vProd>20.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vNF>20.00</vNF>",
      emitenteCnpj: CNPJ_DA_LOJA,
      destinatarioCnpj: "11222333000144",
    });

    expect(conferirDestinatario(lerXmlDeNota(minhaVenda), CNPJ_DA_LOJA)).toBe("EMITIDA_PELA_LOJA");
  });

  it("nota de outra empresa é barrada", () => {
    expect(conferirDestinatario(lerXmlDeNota(NOTA_COMPLETA), "11222333000144")).toBe(
      "DESTINADA_A_OUTRO_CNPJ"
    );
  });

  it("sem CNPJ cadastrado, fica quieto em vez de inventar alerta", () => {
    expect(conferirDestinatario(lerXmlDeNota(NOTA_COMPLETA), "")).toBeNull();
    expect(conferirDestinatario(lerXmlDeNota(NOTA_COMPLETA), null)).toBeNull();
  });
});
