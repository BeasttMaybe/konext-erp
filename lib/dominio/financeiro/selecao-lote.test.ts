import { describe, expect, it } from "vitest";
import {
  alternarSelecaoLinha,
  resumirSelecao,
  selecionarTodosFiltrados,
  type ItemSelecionavelLote,
} from "./selecao-lote";

function item(id: string, jaLiquidado = false): ItemSelecionavelLote {
  return { id, jaLiquidado };
}

describe("alternarSelecaoLinha", () => {
  it("marca um item nao selecionado", () => {
    const resultado = alternarSelecaoLinha(new Set(), item("a"));
    expect(resultado.has("a")).toBe(true);
  });

  it("desmarca um item ja selecionado", () => {
    const resultado = alternarSelecaoLinha(new Set(["a"]), item("a"));
    expect(resultado.has("a")).toBe(false);
  });

  it("nunca marca um item ja liquidado", () => {
    const resultado = alternarSelecaoLinha(new Set(), item("a", true));
    expect(resultado.has("a")).toBe(false);
  });

  it("nao remove outros itens selecionados", () => {
    const resultado = alternarSelecaoLinha(new Set(["a", "b"]), item("c"));
    expect([...resultado].sort()).toEqual(["a", "b", "c"]);
  });

  it("nao muta o Set original", () => {
    const original = new Set(["a"]);
    alternarSelecaoLinha(original, item("b"));
    expect(original.has("b")).toBe(false);
  });
});

describe("selecionarTodosFiltrados", () => {
  it("marca todos os itens selecionaveis do conjunto filtrado", () => {
    const filtrados = [item("a"), item("b"), item("c")];
    const resultado = selecionarTodosFiltrados(new Set(), filtrados);
    expect([...resultado].sort()).toEqual(["a", "b", "c"]);
  });

  it("pula itens ja liquidados mesmo estando no conjunto filtrado", () => {
    const filtrados = [item("a"), item("b", true), item("c")];
    const resultado = selecionarTodosFiltrados(new Set(), filtrados);
    expect([...resultado].sort()).toEqual(["a", "c"]);
  });

  it("so seleciona o que esta no conjunto filtrado passado, nunca ids de fora dele", () => {
    // "todasAsContas=1" tinha 50 contas; o filtro atual (Em aberto, por ex.) so mostra 3 —
    // "selecionar todos" so pode pegar essas 3, nunca as outras 47 que nao estao na tela.
    const filtrados = [item("x"), item("y")];
    const resultado = selecionarTodosFiltrados(new Set(), filtrados);
    expect(resultado.size).toBe(2);
    expect(resultado.has("nao-listado")).toBe(false);
  });

  it("desmarca o conjunto filtrado quando todos ja estavam marcados (toggle)", () => {
    const filtrados = [item("a"), item("b")];
    const resultado = selecionarTodosFiltrados(new Set(["a", "b"]), filtrados);
    expect(resultado.size).toBe(0);
  });

  it("preserva selecao de itens fora do filtro atual ao desmarcar o filtrado", () => {
    // usuario selecionou "z" com um filtro antes, trocou de filtro (agora ve so a/b) e clica "selecionar todos" duas vezes
    const filtrados = [item("a"), item("b")];
    const comTudoSelecionado = selecionarTodosFiltrados(new Set(["z"]), filtrados);
    expect([...comTudoSelecionado].sort()).toEqual(["a", "b", "z"]);

    const desmarcandoFiltrado = selecionarTodosFiltrados(comTudoSelecionado, filtrados);
    expect([...desmarcandoFiltrado]).toEqual(["z"]);
  });

  it("marca de novo (nao desmarca) quando o conjunto filtrado esta parcialmente selecionado", () => {
    const filtrados = [item("a"), item("b"), item("c")];
    const resultado = selecionarTodosFiltrados(new Set(["a"]), filtrados);
    expect([...resultado].sort()).toEqual(["a", "b", "c"]);
  });

  it("conjunto filtrado vazio nao muda a selecao", () => {
    const resultado = selecionarTodosFiltrados(new Set(["a"]), []);
    expect([...resultado]).toEqual(["a"]);
  });

  it("conjunto filtrado onde tudo esta liquidado nao seleciona nada", () => {
    const filtrados = [item("a", true), item("b", true)];
    const resultado = selecionarTodosFiltrados(new Set(), filtrados);
    expect(resultado.size).toBe(0);
  });
});

describe("resumirSelecao", () => {
  it("soma valor e conta so os itens selecionados presentes na lista", () => {
    const itens = [
      { id: "a", valor: 100 },
      { id: "b", valor: 50.5 },
      { id: "c", valor: 20 },
    ];
    const resumo = resumirSelecao(new Set(["a", "b"]), itens);
    expect(resumo).toEqual({ quantidade: 2, total: 150.5 });
  });

  it("ignora ids selecionados que nao existem mais na lista atual (refiltro/troca de mes)", () => {
    const itens = [{ id: "a", valor: 100 }];
    const resumo = resumirSelecao(new Set(["a", "id-de-outro-mes"]), itens);
    expect(resumo).toEqual({ quantidade: 1, total: 100 });
  });

  it("selecao vazia soma zero", () => {
    const itens = [{ id: "a", valor: 100 }];
    const resumo = resumirSelecao(new Set(), itens);
    expect(resumo).toEqual({ quantidade: 0, total: 0 });
  });

  it("soma em centavos evita erro de ponto flutuante", () => {
    const itens = [
      { id: "a", valor: 0.1 },
      { id: "b", valor: 0.2 },
    ];
    const resumo = resumirSelecao(new Set(["a", "b"]), itens);
    expect(resumo.total).toBe(0.3);
  });
});

describe("resumirSelecao — valor que não é número", () => {
  // O bug real: `valor` chegava como string (Decimal do Prisma serializado), a
  // conta virava NaN e a tela mostrava "R$ 0,00" com 20 itens selecionados.
  // Total de dinheiro errado em silêncio é pior que erro visível.
  it("soma certo quando o valor chega como texto, em vez de virar NaN", () => {
    // Era aqui que a tela quebrava: `Math.round(("110" + EPSILON) * 100)`
    // concatenava e virava NaN, e o total aparecia como "R$ 0,00" com os itens
    // todos selecionados. `deDecimal` entende texto numérico e devolve o valor.
    const selecionados = new Set(["a", "b"]);
    const itens = [
      { id: "a", valor: "110" as unknown as number },
      { id: "b", valor: "10" as unknown as number },
    ];

    expect(resumirSelecao(selecionados, itens)).toEqual({ quantidade: 2, total: 120 });
  });

  it("levanta erro quando o valor não é um decimal de jeito nenhum", () => {
    const selecionados = new Set(["a"]);
    const itens = [{ id: "a", valor: "cento e dez" as unknown as number }];

    // Erro visível, não zero silencioso: total de dinheiro errado sem aviso é
    // o pior resultado possível aqui.
    expect(() => resumirSelecao(selecionados, itens)).toThrowError(/deDecimal/);
  });

  it("soma em centavos exatos, sem erro de ponto flutuante", () => {
    const selecionados = new Set(["a", "b", "c"]);
    const itens = [
      { id: "a", valor: 1409.89 },
      { id: "b", valor: 0.1 },
      { id: "c", valor: 0.2 },
    ];

    // 0.1 + 0.2 em ponto flutuante daria 0.30000000000000004.
    expect(resumirSelecao(selecionados, itens)).toEqual({ quantidade: 3, total: 1410.19 });
  });
});
