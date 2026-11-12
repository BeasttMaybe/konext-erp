import { describe, expect, it } from "vitest";

import { filtrarClientes, filtrarProdutos, normalizarParaBusca, pendenciaDaVendaNoCelular } from "./pdv-celular";

const clientes = [
  { id: "1", nomeRazaoSocial: "José da Silva", documento: "123.456.789-00", telefone: "(11) 98765-4321" },
  { id: "2", nomeRazaoSocial: "Maria Souza", documento: null, telefone: "11 91234-0000" },
];

describe("busca de cliente", () => {
  it("ignora acento, maiuscula e pontuacao", () => {
    expect(normalizarParaBusca("José (11) 9")).toBe("jose119");
    expect(filtrarClientes(clientes, "jose").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarClientes(clientes, "98765-4321").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarClientes(clientes, "12345678900").map((c) => c.id)).toEqual(["1"]);
  });

  it("cliente sem documento nao quebra a busca", () => {
    expect(filtrarClientes(clientes, "souza").map((c) => c.id)).toEqual(["2"]);
  });

  it("menos de 2 caracteres nao lista ninguem", () => {
    expect(filtrarClientes(clientes, "j")).toEqual([]);
  });
});

describe("busca de produto", () => {
  const produtos = [
    { nome: "Película 3D iPhone 13", codigoBarras: "7891234567895" },
    { nome: "Cabo USB-C", codigoBarras: null },
  ];
  it("acha por nome ou codigo", () => {
    expect(filtrarProdutos(produtos, "pelí")).toHaveLength(1);
    expect(filtrarProdutos(produtos, "78912")).toHaveLength(1);
    expect(filtrarProdutos(produtos, "cabo")).toHaveLength(1);
  });
});

describe("pendenciaDaVendaNoCelular", () => {
  const pronta = { clienteId: "c", quantidadeItens: 1, temOS: false, caixaAberto: true, pagamentoFechado: true };

  it("libera quando esta tudo certo", () => {
    expect(pendenciaDaVendaNoCelular(pronta)).toBeNull();
  });

  it("aponta o primeiro problema, na ordem da tela", () => {
    expect(pendenciaDaVendaNoCelular({ ...pronta, clienteId: "", quantidadeItens: 0 })).toBe("cliente");
    expect(pendenciaDaVendaNoCelular({ ...pronta, quantidadeItens: 0 })).toBe("itens");
    expect(pendenciaDaVendaNoCelular({ ...pronta, caixaAberto: false })).toBe("caixa");
    expect(pendenciaDaVendaNoCelular({ ...pronta, pagamentoFechado: false })).toBe("pagamento");
  });

  it("OS vinculada conta como item", () => {
    expect(pendenciaDaVendaNoCelular({ ...pronta, quantidadeItens: 0, temOS: true })).toBeNull();
  });
});
