import { describe, expect, it } from "vitest";

import { montarEnderecoEmpresa } from "./configuracoes-documentos";

/**
 * Qual endereço sai nos documentos.
 *
 * O dono preenchia seis campos — CEP, logradouro, número, bairro, cidade e
 * estado — e nenhum deles aparecia em documento algum, porque o campo de
 * texto livre "Endereço" ganhava sempre. O CEP, que só existe no formato
 * estruturado, nunca aparecia em lugar nenhum.
 */

const completo = {
  cep: "18045000",
  logradouro: "Rua das Palmeiras",
  numero: "320",
  bairro: "Centro",
  cidade: "Sorocaba",
  estado: "SP",
};

describe("montarEnderecoEmpresa", () => {
  it("os campos separados ganham do texto livre", () => {
    const endereco = montarEnderecoEmpresa({
      ...completo,
      endereco: "Endereço antigo digitado à mão",
    });

    expect(endereco).toContain("Rua das Palmeiras, 320");
    expect(endereco).toContain("CEP 18045-000");
    expect(endereco).not.toContain("antigo");
  });

  it("sem logradouro, o texto livre continua mandando", () => {
    // Um endereço montado só de "Sorocaba - SP" é pior que um texto livre
    // completo. Quem nunca preencheu os campos separados não pode ver o
    // endereço do seu documento encolher sozinho.
    const endereco = montarEnderecoEmpresa({
      cidade: "Sorocaba",
      estado: "SP",
      endereco: "Av. Brasil, 1000 - Sala 2 - Sorocaba/SP",
    });

    expect(endereco).toBe("Av. Brasil, 1000 - Sala 2 - Sorocaba/SP");
  });

  it("o CEP aparece, que era o campo perdido", () => {
    expect(montarEnderecoEmpresa(completo)).toContain("CEP 18045-000");
  });

  it("sem nada, diz que não foi informado em vez de ficar em branco", () => {
    expect(montarEnderecoEmpresa({})).toBe("Endereço não informado");
    expect(montarEnderecoEmpresa(null)).toBe("Endereço não informado");
  });

  it("texto livre sozinho continua funcionando", () => {
    expect(montarEnderecoEmpresa({ endereco: "Rua X, 1" })).toBe("Rua X, 1");
  });
});
