import { describe, expect, it } from "vitest";

import {
  ABAS_DE_GARANTIA,
  DIAS_PARA_VENCIMENTO_PROXIMO,
  ajudaDaSituacao,
  descricaoDeVencimento,
  urgenciaDoVencimento,
} from "./garantias";

describe("os/garantias — frase do vencimento", () => {
  it("o caso de um dia tem forma própria, nos dois sentidos", () => {
    // "1 dia(s)" é a marca de texto que ninguém escreveu de verdade.
    expect(descricaoDeVencimento(1)).toBe("Vence amanhã");
    expect(descricaoDeVencimento(-1)).toBe("Venceu ontem");
  });

  it("hoje é hoje", () => {
    expect(descricaoDeVencimento(0)).toBe("Vence hoje");
  });

  it("plural normal nos dois sentidos", () => {
    expect(descricaoDeVencimento(12)).toBe("Faltam 12 dias");
    expect(descricaoDeVencimento(-44)).toBe("Venceu há 44 dias");
  });
});

describe("os/garantias — urgência do vencimento", () => {
  it("vencida, perto e tranquila", () => {
    expect(urgenciaDoVencimento(-1)).toBe("VENCIDA");
    expect(urgenciaDoVencimento(0)).toBe("PERTO");
    expect(urgenciaDoVencimento(DIAS_PARA_VENCIMENTO_PROXIMO)).toBe("PERTO");
    expect(urgenciaDoVencimento(DIAS_PARA_VENCIMENTO_PROXIMO + 1)).toBe("TRANQUILA");
  });

  it("a janela é de uma semana", () => {
    // Menos avisa tarde demais pro cliente conseguir voltar; mais transforma
    // metade da lista em alerta.
    expect(DIAS_PARA_VENCIMENTO_PROXIMO).toBe(7);
  });
});

describe("os/garantias — abas de triagem", () => {
  it("vencidas têm aba própria", () => {
    // É o pedido direto do dono: separar o que expirou do que ainda vale.
    expect(ABAS_DE_GARANTIA.some((aba) => aba.valor === "VENCIDAS")).toBe(true);
  });

  it("toda aba tem rótulo e explicação", () => {
    for (const aba of ABAS_DE_GARANTIA) {
      expect(aba.rotulo.length, aba.valor).toBeGreaterThan(0);
      expect(ajudaDaSituacao(aba.valor).length, aba.valor).toBeGreaterThan(0);
    }
  });

  it("a explicação de 'vencendo' acompanha a constante", () => {
    // Se a janela mudar, o texto da tela não pode continuar dizendo sete.
    expect(ajudaDaSituacao("VENCENDO")).toContain(String(DIAS_PARA_VENCIMENTO_PROXIMO));
  });

  it("situação desconhecida não quebra o texto", () => {
    expect(ajudaDaSituacao("INVENTADA" as never)).toBe("");
  });
});
