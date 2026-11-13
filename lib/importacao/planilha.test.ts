import { describe, expect, it } from "vitest";

import {
  COLUNAS_CLIENTE,
  COLUNAS_PRODUTO,
  converterCliente,
  converterProduto,
  lerCsv,
  modeloCsv,
  registrosDaPlanilha,
} from "./planilha";

describe("lerCsv", () => {
  it("Excel pt-BR: ponto e virgula, BOM, aspas e CRLF", () => {
    const texto = '﻿Nome;Telefone;Obs\r\n"Silva; João";11987654321;"diz ""oi"""\r\n\r\nAna;1133334444;\r\n';
    expect(lerCsv(texto)).toEqual([
      ["Nome", "Telefone", "Obs"],
      ["Silva; João", "11987654321", 'diz "oi"'],
      ["Ana", "1133334444", ""],
    ]);
  });

  it("Google Planilhas: virgula e quebra de linha entre aspas", () => {
    expect(lerCsv('a,b\n"x\ny",2')).toEqual([["a", "b"], ["x\ny", "2"]]);
  });

  it("o modelo le de volta", () => {
    const linhas = lerCsv(modeloCsv(COLUNAS_PRODUTO));
    expect(linhas[0]).toEqual(COLUNAS_PRODUTO.map((c) => c.titulo));
  });
});

describe("clientes", () => {
  it("titulos por apelido e sem acento; linha numerada como na planilha", () => {
    const { registros, faltando } = registrosDaPlanilha(
      [["NOME COMPLETO", "Celular", "cpf"], ["Maria Souza", "(11) 98765-4321", "123.456.789-09"]],
      COLUNAS_CLIENTE
    );
    expect(faltando).toEqual([]);
    expect(registros[0].numero).toBe(2);
    const r = converterCliente(registros[0].registro);
    expect(r).toMatchObject({ ok: true, dados: { nomeRazaoSocial: "Maria Souza", telefone: "11987654321", documento: "12345678909", tipoPessoa: "FISICA" } });
  });

  it("aponta coluna obrigatoria que falta", () => {
    expect(registrosDaPlanilha([["Nome"], ["A"]], COLUNAS_CLIENTE).faltando).toEqual(["Telefone"]);
  });

  it("recusa telefone curto, documento torto, e-mail e UF invalidos; CNPJ vira juridica; tira o 55", () => {
    const base = Object.fromEntries(COLUNAS_CLIENTE.map((c) => [c.campo, ""])) as Parameters<typeof converterCliente>[0];
    expect(converterCliente({ ...base, nome: "Ana Lima", telefone: "98765" }).ok).toBe(false);
    expect(converterCliente({ ...base, nome: "Ana Lima", telefone: "11987654321", documento: "123" }).ok).toBe(false);
    expect(converterCliente({ ...base, nome: "Ana Lima", telefone: "11987654321", email: "x@" }).ok).toBe(false);
    expect(converterCliente({ ...base, nome: "Ana Lima", telefone: "11987654321", estado: "São Paulo" }).ok).toBe(false);
    expect(converterCliente({ ...base, nome: "Loja X", telefone: "+55 11 98765-4321", documento: "12.345.678/0001-90" })).toMatchObject({
      ok: true,
      dados: { tipoPessoa: "JURIDICA", telefone: "11987654321" },
    });
  });
});

describe("produtos", () => {
  const base = Object.fromEntries(COLUNAS_PRODUTO.map((c) => [c.campo, ""])) as Parameters<typeof converterProduto>[0];

  it("dinheiro em pt-BR, padroes de quantidade/minimo/unidade", () => {
    expect(converterProduto({ ...base, nome: "Película 3D", categoria: "Películas", precoVenda: "R$ 1.234,50", custo: "8,5" })).toEqual({
      ok: true,
      dados: { nome: "Película 3D", categoria: "Películas", precoVenda: 1234.5, custo: 8.5, quantidadeEstoque: 0, estoqueMinimo: 3, unidade: "UN" },
    });
  });

  it("recusa preco, quantidade fracionada e unidade desconhecida", () => {
    expect(converterProduto({ ...base, nome: "Capa X", categoria: "Capas", precoVenda: "abc" }).ok).toBe(false);
    expect(converterProduto({ ...base, nome: "Capa X", categoria: "Capas", precoVenda: "10", quantidade: "1,5" }).ok).toBe(false);
    expect(converterProduto({ ...base, nome: "Capa X", categoria: "Capas", precoVenda: "10", unidade: "DZ" }).ok).toBe(false);
    expect(converterProduto({ ...base, nome: "Capa X", categoria: "", precoVenda: "10" }).ok).toBe(false);
  });
});
