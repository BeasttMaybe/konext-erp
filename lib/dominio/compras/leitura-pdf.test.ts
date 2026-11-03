import { describe, expect, it } from "vitest";

import { formatarReais } from "@/lib/dinheiro";

import { PALAVRAS_EA_CENTRAL } from "./amostras/ea-central";
import { agruparEmLinhas, lerNotaDePalavras, textoDaLinha } from "./leitura-pdf";
import { conferirNota } from "./nota";

/**
 * O teste central é o orçamento real da EA CENTRAL, inteiro.
 *
 * Uma nota de fornecedor só é interpretada corretamente quando as contas
 * dela fecham — e as contas deste documento fecham no centavo: 501,00 de
 * mercadoria, 25,00 de frete, 526,00 de total geral. É isso que torna esta
 * amostra um teste e não uma demonstração: se o parser trocar uma coluna,
 * inventar um item ou perder uma linha, a soma deixa de dar 501,00.
 */

describe("compras/leitura-pdf — orçamento real da EA CENTRAL", () => {
  const nota = lerNotaDePalavras(PALAVRAS_EA_CENTRAL);

  it("lê os quinze itens do documento", () => {
    expect(nota.itens).toHaveLength(15);
  });

  it("junta o cabeçalho do grupo ao nome do item", () => {
    // A nota escreve "CASE DE IPHONE" numa linha e "IP 18 PRO" na seguinte.
    // Lido isolado, o produto se chamaria "IP 18 PRO" — e o MESMO "IP 18 PRO"
    // aparece sob case, capa, película 3D e película de privacidade, o que
    // criaria quatro produtos de nome idêntico e custo diferente.
    expect(nota.itens[0].descricao).toBe("CASE DE IPHONE IP 18 PRO");
    expect(nota.itens[2].descricao).toBe("CAPA SPACE COLORIDA IP 18 PRO");
    expect(nota.itens[6].descricao).toBe("PELICULA DE VIDRO 3D FINA IP 18 PRO");
    expect(nota.itens[8].descricao).toBe("PELICULA DE PIRVACIDADE IP 18 PRO");
  });

  it("os nomes ficam distintos entre si", () => {
    const nomes = new Set(nota.itens.map((item) => item.descricao));
    expect(nomes.size).toBe(nota.itens.length);
  });

  it("separa quantidade, unitário e total na linha", () => {
    expect(nota.itens[0]).toMatchObject({
      quantidade: 4,
      valorUnitarioCentavos: 650,
      valorTotalCentavos: 2600,
    });

    // A linha mais cara da nota, com unitário de dois dígitos.
    const fonte = nota.itens.find((item) => item.descricao.includes("FONTE"));
    expect(fonte).toMatchObject({
      quantidade: 5,
      valorUnitarioCentavos: 1600,
      valorTotalCentavos: 8000,
    });
  });

  it("lê o fechamento: mercadoria, frete e total geral", () => {
    expect(nota.valorProdutosCentavos).toBe(50_100);
    expect(nota.valorFreteCentavos).toBe(2_500);
    expect(nota.valorTotalCentavos).toBe(52_600);
  });

  it("não confunde a linha de frete com um item", () => {
    // "FRETE - SEDEX / 1 DIA UTIL  R$ 25,00" tem texto e dinheiro, e o "1"
    // de "1 DIA UTIL" é um número no meio da linha.
    expect(nota.itens.some((item) => /SEDEX|FRETE/i.test(item.descricao))).toBe(false);
  });

  it("não deixa o rodapé virar nome de grupo", () => {
    expect(nota.itens.every((item) => !/TOTAL|SUBTOTAL/i.test(item.descricao))).toBe(true);
  });

  it("identifica o fornecedor sem o tipo do documento colado", () => {
    expect(nota.emitenteNome).toBe("EA CENTRAL");
    expect(nota.emitidaEm).toBe("2026-10-22");
  });

  it("não perde nenhuma linha com dinheiro pelo caminho", () => {
    expect(nota.linhasIgnoradas).toEqual([]);
  });

  it("A CONTA FECHA — é isso que prova que a leitura está certa", () => {
    const conferencia = conferirNota(nota);

    expect(
      conferencia.problemas,
      `soma lida: ${formatarReais(conferencia.somaDosItensCentavos)}`
    ).toEqual([]);
    expect(conferencia.itensConferidos).toBe(15);
    expect(conferencia.somaDosItensCentavos).toBe(50_100);
    expect(conferencia.fecha).toBe(true);
  });
});

describe("compras/leitura-pdf — agrupamento em linhas", () => {
  it("junta palavras desalinhadas por poucos pontos", () => {
    // Neste orçamento, a descrição e o preço de um item saíram com um ponto
    // de diferença no Y. Com tolerância zero a linha se parte em duas: uma
    // sem preço e outra sem descrição, e o item some.
    const linhas = agruparEmLinhas([
      { texto: "POWER BANK", x: 198, y: 336 },
      { texto: "2", x: 142, y: 335 },
      { texto: "R$ 22,00", x: 441, y: 335 },
    ]);

    expect(linhas).toHaveLength(1);
    expect(textoDaLinha(linhas[0])).toBe("2 POWER BANK R$ 22,00");
  });

  it("não junta linhas realmente distintas", () => {
    const linhas = agruparEmLinhas([
      { texto: "primeira", x: 50, y: 300 },
      { texto: "segunda", x: 50, y: 286 },
    ]);

    expect(linhas).toHaveLength(2);
  });

  it("entrega de cima pra baixo, não na ordem do arquivo", () => {
    // Y cresce pra cima no PDF, e a ordem em que o emissor desenha o texto
    // não tem relação nenhuma com a ordem de leitura.
    const linhas = agruparEmLinhas([
      { texto: "rodapé", x: 50, y: 100 },
      { texto: "topo", x: 50, y: 700 },
      { texto: "meio", x: 50, y: 400 },
    ]);

    expect(linhas.map((linha) => textoDaLinha(linha))).toEqual(["topo", "meio", "rodapé"]);
  });
});

describe("compras/leitura-pdf — o que ele se recusa a adivinhar", () => {
  const cabecalho: Parameters<typeof lerNotaDePalavras>[0] = [
    { texto: "QNTD", x: 132, y: 643 },
    { texto: "DESCRIÇÃO", x: 275, y: 643 },
    { texto: "PREÇO UNI", x: 413, y: 643 },
    { texto: "TOTAL", x: 493, y: 643 },
  ];

  it("quantidade fracionária de nota por peso não vira coluna de dinheiro", () => {
    const nota = lerNotaDePalavras([
      ...cabecalho,
      { texto: "1,5", x: 140, y: 600 },
      { texto: "FITA ADESIVA", x: 198, y: 600 },
      { texto: "R$", x: 408, y: 600 },
      { texto: "10,00", x: 446, y: 600 },
      { texto: "R$", x: 474, y: 600 },
      { texto: "15,00", x: 514, y: 600 },
    ]);

    expect(nota.itens[0]).toMatchObject({
      quantidade: 1.5,
      valorUnitarioCentavos: 1_000,
      valorTotalCentavos: 1_500,
    });
  });

  it("linha com um valor só não finge que conferiu", () => {
    // Sem a segunda coluna não há o que comparar: o total vira o calculado,
    // e a conferência passa porque não existe divergência possível — mas o
    // número não veio do documento, veio da multiplicação.
    const nota = lerNotaDePalavras([
      ...cabecalho,
      { texto: "3", x: 142, y: 600 },
      { texto: "CABO USB-C", x: 198, y: 600 },
      { texto: "R$", x: 408, y: 600 },
      { texto: "7,00", x: 446, y: 600 },
    ]);

    expect(nota.itens[0]).toMatchObject({
      quantidade: 3,
      valorUnitarioCentavos: 700,
      valorTotalCentavos: 2_100,
    });
  });

  it("linha com dinheiro mas sem quantidade vira aviso, não some", () => {
    const nota = lerNotaDePalavras([
      ...cabecalho,
      { texto: "3", x: 142, y: 600 },
      { texto: "CABO USB-C", x: 198, y: 600 },
      { texto: "R$", x: 408, y: 600 },
      { texto: "7,00", x: 446, y: 600 },
      { texto: "R$", x: 474, y: 600 },
      { texto: "21,00", x: 514, y: 600 },
      { texto: "ACRESCIMO DE EMBALAGEM", x: 198, y: 580 },
      { texto: "R$", x: 474, y: 580 },
      { texto: "4,00", x: 514, y: 580 },
    ]);

    expect(nota.itens).toHaveLength(1);
    expect(nota.linhasIgnoradas).toEqual(["ACRESCIMO DE EMBALAGEM R$ 4,00"]);
  });

  it("documento sem nenhum item não inventa nenhum", () => {
    const nota = lerNotaDePalavras([
      { texto: "RECIBO", x: 50, y: 700 },
      { texto: "Obrigado pela preferência", x: 50, y: 600 },
    ]);

    expect(nota.itens).toEqual([]);
    expect(conferirNota(nota).problemas).toContain("SEM_ITENS");
  });

  it("página em branco não quebra", () => {
    expect(() => lerNotaDePalavras([])).not.toThrow();
    expect(lerNotaDePalavras([]).itens).toEqual([]);
  });
});
