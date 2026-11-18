import { describe, expect, it } from "vitest";

import { lerPedido, montarMensagens, separarVariacoes, type ContextoDaLoja } from "./gerador-de-texto";

const loja: ContextoDaLoja = { nome: "Konext Tech", cidade: "São Paulo", telefone: "(11) 90000-0000", segmento: "Conserto de celulares." };

describe("lerPedido", () => {
  it("lê e normaliza", () => {
    const r = lerPedido({ tema: " Promoção de película ", tom: "PROMOCIONAL", canais: ["INSTAGRAM", "INSTAGRAM", "x"], referencias: "curto e com emoji", variacoes: "9" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pedido.tema).toBe("Promoção de película");
      expect(r.pedido.tom).toBe("PROMOCIONAL");
      expect(r.pedido.canais).toEqual(["INSTAGRAM"]);
      expect(r.pedido.variacoes).toBe(3); // teto
    }
  });
  it("tom inválido cai no padrão; tema vazio recusa", () => {
    expect(lerPedido({ tema: "oi", tom: "ZOEIRA" }).ok && (lerPedido({ tema: "oi", tom: "ZOEIRA" }) as { ok: true; pedido: { tom: string } }).pedido.tom).toBe("ANIMADO");
    expect(lerPedido({ tema: "   " }).ok).toBe(false);
  });
});

describe("montarMensagens", () => {
  it("inclui contexto da loja, tema, referências e pede o separador", () => {
    const [sistema, usuario] = montarMensagens(loja, { tema: "Troca de bateria", tom: "ANIMADO", canais: ["INSTAGRAM", "FACEBOOK"], referencias: "estilo curto", variacoes: 2 });
    expect(sistema.papel).toBe("system");
    expect(sistema.conteudo).toContain("português do Brasil");
    expect(usuario.conteudo).toContain("Konext Tech");
    expect(usuario.conteudo).toContain("Troca de bateria");
    expect(usuario.conteudo).toContain("estilo curto");
    expect(usuario.conteudo).toContain("---");
    expect(usuario.conteudo).toContain("Instagram, Facebook");
  });
  it("uma variação não pede separador", () => {
    const [, usuario] = montarMensagens(loja, { tema: "x", tom: "ANIMADO", canais: [], referencias: "", variacoes: 1 });
    expect(usuario.conteudo).toContain("apenas a legenda");
  });
});

describe("separarVariacoes", () => {
  it("quebra por --- e limpa numeração/títulos", () => {
    const bruto = "Opção 1: Primeira legenda 🔧\n---\n2) Segunda legenda\n---\nVersão 3 - Terceira";
    expect(separarVariacoes(bruto)).toEqual(["Primeira legenda 🔧", "Segunda legenda", "Terceira"]);
  });
  it("texto único vira uma variação", () => {
    expect(separarVariacoes("  Só uma legenda  ")).toEqual(["Só uma legenda"]);
    expect(separarVariacoes("   ")).toEqual([]);
  });
});
