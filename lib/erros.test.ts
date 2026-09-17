import { describe, expect, it } from "vitest";

import { ErroNegocio, ErroPermissao, ErroSessao, mensagemDeErroConhecido, paraMensagemSegura } from "./erros";

describe("paraMensagemSegura", () => {
  it("preserva a mensagem de ErroPermissao (Fase 1B-UI, Parte 1)", () => {
    const erro = new ErroPermissao("USUARIO", "os.excluir");
    expect(paraMensagemSegura(erro)).toBe(erro.message);
    expect(paraMensagemSegura(erro)).toContain("não tem permissão");
  });

  it("preserva a mensagem de ErroNegocio", () => {
    const erro = new ErroNegocio("Estoque insuficiente para o produto X.");
    expect(paraMensagemSegura(erro)).toBe("Estoque insuficiente para o produto X.");
  });

  it("preserva a mensagem de ErroSessao", () => {
    const erro = new ErroSessao();
    expect(paraMensagemSegura(erro)).toBe(erro.message);
  });

  it("oculta um erro do Prisma atras da mensagem generica", () => {
    const erro = new Error("Unknown argument `foo`. Did you mean `bar`?");
    expect(paraMensagemSegura(erro)).toBe("Não foi possível concluir a operação. Tente novamente em instantes.");
  });

  it("devolve a mensagem de um Error comum, sem cara de erro interno", () => {
    const erro = new Error("Pedido de venda não encontrado.");
    expect(paraMensagemSegura(erro)).toBe("Pedido de venda não encontrado.");
  });

  it("devolve a mensagem generica para um valor que nao e Error", () => {
    expect(paraMensagemSegura("algo lancado sem ser Error")).toBe(
      "Não foi possível concluir a operação. Tente novamente em instantes."
    );
  });
});

describe("mensagemDeErroConhecido", () => {
  it("devolve a mensagem para ErroPermissao, ErroNegocio e ErroSessao", () => {
    expect(mensagemDeErroConhecido(new ErroPermissao("GESTOR", "configuracoes.empresa"))).toContain(
      "não tem permissão"
    );
    expect(mensagemDeErroConhecido(new ErroNegocio("Falha de negocio."))).toBe("Falha de negocio.");
    expect(mensagemDeErroConhecido(new ErroSessao("Sessao expirada."))).toBe("Sessao expirada.");
  });

  it("devolve null para qualquer outro erro", () => {
    expect(mensagemDeErroConhecido(new Error("erro qualquer"))).toBeNull();
    expect(mensagemDeErroConhecido("string qualquer")).toBeNull();
    expect(mensagemDeErroConhecido(null)).toBeNull();
  });
});
