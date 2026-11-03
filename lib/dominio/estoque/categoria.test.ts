import { describe, expect, it } from "vitest";

import { normalizarNome } from "@/lib/dominio/texto/chave-de-nome";

import {
  CATEGORIAS_HERDADAS_DO_ENUM,
  TAMANHO_MAXIMO_NOME_CATEGORIA,
  podeDesativarCategoria,
  validarNomeCategoria,
} from "./categoria";

describe("estoque/categoria — nome", () => {
  it("colapsa grafias da mesma categoria numa chave só", () => {
    // Sem isso, "Capas", "capas " e "CAPAS" coexistiriam e o filtro por
    // categoria mostraria três linhas para a mesma coisa.
    const variantes = ["Capas", "capas ", "  CAPAS", "Cápas"];
    const chaves = new Set(
      variantes.map((nome) => {
        const resultado = validarNomeCategoria(nome);
        return resultado.valido ? resultado.nomeNormalizado : "invalido";
      })
    );

    expect(chaves).toEqual(new Set(["capas"]));
  });

  it("preserva o acento na forma exibida", () => {
    const resultado = validarNomeCategoria("  Películas  de   vidro ");

    expect(resultado).toEqual({
      valido: true,
      nome: "Películas de vidro",
      nomeNormalizado: "peliculas de vidro",
    });
  });

  it("recusa vazio, só símbolo, e longo demais", () => {
    expect(validarNomeCategoria("   ").valido).toBe(false);
    expect(validarNomeCategoria("---").valido).toBe(false);
    expect(validarNomeCategoria("a".repeat(TAMANHO_MAXIMO_NOME_CATEGORIA + 1)).valido).toBe(false);
    expect(validarNomeCategoria("a".repeat(TAMANHO_MAXIMO_NOME_CATEGORIA)).valido).toBe(true);
  });
});

describe("estoque/categoria — as cinco herdadas do enum", () => {
  it("são cinco, e nenhuma colide com a outra na chave", () => {
    const chaves = CATEGORIAS_HERDADAS_DO_ENUM.map((categoria) => normalizarNome(categoria.nome));

    expect(chaves).toHaveLength(5);
    expect(new Set(chaves).size).toBe(5);
  });

  it("todos os nomes passam pela própria validação", () => {
    // Se uma delas não passasse, a migration semearia um valor que o cadastro
    // depois recusaria editar.
    for (const categoria of CATEGORIAS_HERDADAS_DO_ENUM) {
      expect(validarNomeCategoria(categoria.nome).valido, categoria.enum).toBe(true);
    }
  });
});

describe("estoque/categoria — desativar", () => {
  it("não desativa categoria com produto ativo", () => {
    // Desativar deixaria produto ativo com categoria fantasma: aparece na
    // lista, mas o filtro por categoria não acha mais.
    const decisao = podeDesativarCategoria({
      produtosAtivosNaCategoria: 3,
      categoriasAtivasNoTotal: 5,
    });

    expect(decisao.permitido).toBe(false);
    expect(decisao.permitido === false && decisao.erro).toContain("3 produtos");
  });

  it("o texto do erro concorda no singular", () => {
    const decisao = podeDesativarCategoria({
      produtosAtivosNaCategoria: 1,
      categoriasAtivasNoTotal: 5,
    });

    expect(decisao.permitido === false && decisao.erro).toContain("1 produto ativo");
  });

  it("não desativa a última ativa", () => {
    // Sem nenhuma, o cadastro de produto fica sem opção e ninguém cadastra nada.
    const decisao = podeDesativarCategoria({
      produtosAtivosNaCategoria: 0,
      categoriasAtivasNoTotal: 1,
    });

    expect(decisao.permitido).toBe(false);
    expect(decisao.permitido === false && decisao.erro).toContain("única categoria ativa");
  });

  it("desativa quando está vazia e há outras", () => {
    expect(
      podeDesativarCategoria({ produtosAtivosNaCategoria: 0, categoriasAtivasNoTotal: 4 })
    ).toEqual({ permitido: true });
  });
});
