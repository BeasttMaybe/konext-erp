import { describe, expect, it } from "vitest";

import {
  montarDadosDaOSRapida,
  RASCUNHO_VAZIO,
  tocarPontoDoDesenho,
  totalDoPreOrcamento,
  validarOSRapida,
  type RascunhoDaOSRapida,
} from "./os-rapida";

const completo: RascunhoDaOSRapida = {
  ...RASCUNHO_VAZIO,
  clienteId: "c1",
  aparelho: "  iPhone 13 ",
  defeito: " Tela quebrada ",
};

describe("validarOSRapida", () => {
  it("exige cliente, aparelho e defeito", () => {
    expect(validarOSRapida(RASCUNHO_VAZIO)).toEqual({
      cliente: expect.any(String),
      aparelho: expect.any(String),
      defeito: expect.any(String),
    });
  });

  it("espaco em branco nao conta como preenchido", () => {
    expect(validarOSRapida({ ...completo, aparelho: "   " }).aparelho).toBeDefined();
  });

  it("passa sem nada opcional", () => {
    expect(validarOSRapida(completo)).toEqual({});
  });

  it("acusa item com descricao e sem valor", () => {
    const erros = validarOSRapida({
      ...completo,
      itens: [{ tipo: "TELA", descricao: "Tela original", valorCentavos: 0 }],
    });
    expect(erros.itens).toBeDefined();
  });
});

describe("montarDadosDaOSRapida", () => {
  it("apara os textos e abre aguardando orcamento", () => {
    expect(montarDadosDaOSRapida(completo)).toEqual({
      clienteId: "c1",
      equipamento: "iPhone 13",
      relatoCliente: "Tela quebrada",
      status: "AGUARDANDO_ORCAMENTO",
      itensOrcamento: [],
    });
  });

  it("grava so a senha do modo escolhido", () => {
    const base = { ...completo, senha: "1234", desenho: [1, 2, 3, 6] };
    const caracteres = montarDadosDaOSRapida({ ...base, modoDaSenha: "CARACTERES" });
    expect(caracteres.senha).toBe("1234");
    expect(caracteres.senhaDesenho).toBeUndefined();

    const desenho = montarDadosDaOSRapida({ ...base, modoDaSenha: "DESENHO" });
    expect(desenho.senha).toBeUndefined();
    expect(desenho.senhaDesenho).toBe("1-2-3-6");
  });

  it("descarta desenho com menos de 4 pontos", () => {
    const dados = montarDadosDaOSRapida({ ...completo, modoDaSenha: "DESENHO", desenho: [1, 2, 3] });
    expect(dados.senhaDesenho).toBeUndefined();
  });

  it("converte centavos em reais, zera o custo e nomeia item sem descricao", () => {
    const dados = montarDadosDaOSRapida({
      ...completo,
      itens: [
        { tipo: "TELA", descricao: "", valorCentavos: 45000 },
        { tipo: "OUTROS", descricao: "", valorCentavos: 0 },
      ],
    });
    expect(dados.itensOrcamento).toEqual([{ tipo: "TELA", descricao: "Tela", custoPeca: 0, valorCobrado: 450 }]);
  });

  it("recusa montar sem cliente", () => {
    expect(() => montarDadosDaOSRapida(RASCUNHO_VAZIO)).toThrow();
  });
});

describe("desenho e total", () => {
  it("nao repete ponto nem aceita ponto fora da grade", () => {
    expect(tocarPontoDoDesenho([1, 2], 2)).toEqual([1, 2]);
    expect(tocarPontoDoDesenho([1], 10)).toEqual([1]);
    expect(tocarPontoDoDesenho([1], 5)).toEqual([1, 5]);
  });

  it("soma os valores", () => {
    expect(
      totalDoPreOrcamento([
        { tipo: "TELA", descricao: "", valorCentavos: 45000 },
        { tipo: "BATERIA", descricao: "", valorCentavos: 12050 },
      ])
    ).toBe(57050);
  });
});
