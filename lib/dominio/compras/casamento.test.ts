import { describe, expect, it } from "vitest";

import {
  casarItem,
  SEMELHANCA_MINIMA,
  semelhancaDeNome,
  type ProdutoParaCasar,
} from "./casamento";

const CATALOGO: ProdutoParaCasar[] = [
  { id: "p1", nome: "Case iPhone 18 Pro", sku: "CAP-0001", codigoBarras: "7898123456789" },
  { id: "p2", nome: "Case iPhone 18 Pro Max", sku: "CAP-0002", codigoBarras: null },
  { id: "p3", nome: "Película de vidro 3D iPhone 18 Pro", sku: "PEL-0001", codigoBarras: null },
  { id: "p4", nome: "Fonte 20W USB-C", sku: "ACE-0001", codigoBarras: "7891234567890" },
  { id: "p5", nome: "Cabo USB-C para USB-C 1m", sku: "CB77", codigoBarras: null },
];

function linha(
  descricao: string,
  extras: Partial<{ ean: string; codigoFornecedor: string; grupo: string }> = {}
) {
  return {
    descricao,
    grupo: extras.grupo ?? null,
    ean: extras.ean ?? null,
    codigoFornecedor: extras.codigoFornecedor ?? null,
  };
}

describe("compras/casamento — identidade vem antes de semelhança", () => {
  it("código de barras vence qualquer nome", () => {
    // O nome não lembra nada do catálogo, mas o EAN é o mesmo número no
    // mundo inteiro. Não existe semelhança de nome que valha mais do que isso.
    const casamento = casarItem(
      linha("CS18P CAPINHA TRANSP APPLE", { ean: "7898123456789" }),
      CATALOGO
    );

    expect(casamento.escolhido).toMatchObject({ produtoId: "p1", motivo: "CODIGO_DE_BARRAS" });
    expect(casamento.certeza).toBe(true);
  });

  it("o EAN é comparado só pelos dígitos", () => {
    expect(casarItem(linha("qualquer", { ean: "789-8123.456789" }), CATALOGO).escolhido).toMatchObject({
      produtoId: "p1",
    });
  });

  it("código do fornecedor casa com o SKU de quem já controlava à mão", () => {
    const casamento = casarItem(
      linha("CABO AGOLD 20W CB77 - TPC", { codigoFornecedor: "CB77" }),
      CATALOGO
    );

    expect(casamento).toMatchObject({ certeza: true, escolhido: { produtoId: "p5", motivo: "SKU" } });
  });

  it("o prefixo do grupo não impede o nome de bater", () => {
    // O PDF agrupa por seção: a linha "FONTE H'MASTON 20W USB-C" fica
    // embaixo de "ACESSORIOS" e vira "ACESSORIOS FONTE H'MASTON 20W USB-C".
    // Ali o prefixo é ruído — a linha já nomeia o produto inteiro —, e sem
    // tentar as duas formas o item viraria uma dúvida pra pessoa resolver à
    // mão, toda vez, em toda nota daquele fornecedor.
    const casamento = casarItem(
      linha("ACESSORIOS FONTE 20W USB-C", { grupo: "ACESSORIOS" }),
      CATALOGO
    );

    expect(casamento).toMatchObject({
      certeza: true,
      escolhido: { produtoId: "p4", motivo: "NOME_IDENTICO" },
    });
  });

  it("mas onde o prefixo distingue, ele continua valendo", () => {
    // O lado oposto: aqui o prefixo é o produto. Sem ele, "IP 18 PRO" não
    // diz se é case, capa ou película — e as três existem no catálogo.
    const casamento = casarItem(
      linha("CASE IPHONE 18 PRO", { grupo: "CASE" }),
      CATALOGO
    );

    expect(casamento.escolhido?.produtoId).toBe("p1");
  });

  it("nome idêntico a menos de caixa e acento é identidade", () => {
    const casamento = casarItem(linha("PELICULA DE VIDRO 3D IPHONE 18 PRO"), CATALOGO);

    expect(casamento).toMatchObject({
      certeza: true,
      escolhido: { produtoId: "p3", motivo: "NOME_IDENTICO" },
    });
  });
});

describe("compras/casamento — sugestão nunca é certeza", () => {
  it("nome parecido sugere, mas não marca", () => {
    // O nome do fornecedor quase nunca é o nome do catálogo: "CASE DE IPHONE
    // IP 18 PRO" contra "Case iPhone 18 Pro".
    const casamento = casarItem(linha("CASE DE IPHONE IP 18 PRO"), CATALOGO);

    expect(casamento.escolhido?.produtoId).toBe("p1");
    expect(casamento.escolhido?.motivo).toBe("NOME_PARECIDO");
    expect(casamento.certeza).toBe(false);
  });

  it("oferece as alternativas sem obrigar a nova busca", () => {
    // "Pro" e "Pro Max" são dois produtos diferentes e parecidíssimos — é
    // exatamente onde a pessoa precisa trocar a escolha com um clique.
    const casamento = casarItem(linha("CASE DE IPHONE IP 18 PRO MAX"), CATALOGO);

    expect(casamento.escolhido?.produtoId).toBe("p2");
    expect(casamento.alternativas.map((alternativa) => alternativa.produtoId)).toContain("p1");
  });

  it("sem nada parecido, não inventa candidato", () => {
    const casamento = casarItem(linha("POWER BANK PINENG 5000mAh"), CATALOGO);

    expect(casamento.escolhido).toBeNull();
    expect(casamento.alternativas).toEqual([]);
  });

  it("catálogo vazio não quebra", () => {
    expect(casarItem(linha("qualquer coisa"), [])).toEqual({
      escolhido: null,
      certeza: false,
      alternativas: [],
    });
  });
});

describe("compras/casamento — semelhança de nome", () => {
  it("ignora preposição, acento e caixa", () => {
    expect(semelhancaDeNome("Película de vidro", "PELICULA VIDRO")).toBe(1);
  });

  it("produtos diferentes do mesmo aparelho ficam abaixo do piso", () => {
    // O erro que a penalidade de categoria existe pra evitar. Com Dice puro
    // estas duas dão 0,67 — dois termos em comum de três — e casariam.
    // Quase todo produto do ramo termina no mesmo modelo de aparelho, então
    // o modelo não distingue nada.
    expect(semelhancaDeNome("Capa iPhone 13", "Película iPhone 13")).toBeLessThan(SEMELHANCA_MINIMA);
    expect(semelhancaDeNome("Cabo USB-C 1m", "Fonte USB-C 1m")).toBeLessThan(SEMELHANCA_MINIMA);
  });

  it("mas o aparelho na frente do nome continua casando", () => {
    // Quem cadastra "iPhone 13 capa silicone" não pode ser punido por isso:
    // a conferência é nos dois sentidos e por presença em qualquer posição.
    expect(semelhancaDeNome("iPhone 13 capa", "Capa iPhone 13")).toBe(1);
    expect(semelhancaDeNome("CASE DE IPHONE IP 18 PRO", "Case iPhone 18 Pro")).toBeGreaterThan(
      SEMELHANCA_MINIMA
    );
  });

  it("texto sem termo útil não casa com nada", () => {
    expect(semelhancaDeNome("de da do", "Capa iPhone")).toBe(0);
    expect(semelhancaDeNome("", "Capa")).toBe(0);
  });
});
