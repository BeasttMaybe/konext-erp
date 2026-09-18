import { describe, expect, it } from "vitest";
import { CATALOGO_PERMISSOES } from "./permissoes";
import { GRADE_PERMISSOES, PERMISSOES_ESCOPO, PERMISSOES_ESPECIAIS, catalogoTotalmenteMapeado, localizarPermissao } from "./grade-permissoes";

describe("grade-permissoes", () => {
  it("mapeia toda permissao do catalogo em exatamente um lugar (grade, especial ou escopo)", () => {
    expect(catalogoTotalmenteMapeado()).toBe(true);
  });

  it("nao repete nenhuma permissao entre grade, especiais e escopo", () => {
    const permissoesDaGrade = GRADE_PERMISSOES.flatMap((linha) => Object.values(linha.colunas));
    const permissoesDoEscopo = PERMISSOES_ESCOPO.map((item) => item.permissao);
    const todas = [...permissoesDaGrade, ...PERMISSOES_ESPECIAIS, ...permissoesDoEscopo];

    expect(todas.length).toBe(new Set(todas).size);
  });

  it("cobre exatamente o catalogo atual, nem a mais nem a menos", () => {
    const permissoesDaGrade = GRADE_PERMISSOES.flatMap((linha) => Object.values(linha.colunas));
    const permissoesDoEscopo = PERMISSOES_ESCOPO.map((item) => item.permissao);
    const mapeadas = new Set([...permissoesDaGrade, ...PERMISSOES_ESPECIAIS, ...permissoesDoEscopo]);

    expect(mapeadas.size).toBe(CATALOGO_PERMISSOES.length);
    for (const permissao of CATALOGO_PERMISSOES) {
      expect(mapeadas.has(permissao)).toBe(true);
    }
  });

  it("localizarPermissao classifica corretamente cada categoria", () => {
    expect(localizarPermissao("os.criar")).toBe("grade");
    expect(localizarPermissao("os.ver_custos")).toBe("especial");
    expect(localizarPermissao("os.ver_todas")).toBe("escopo");
  });

  it("as 6 permissoes especiais explicitamente pedidas na Fase 1D-3 estao no bloco especial", () => {
    const exigidas = [
      "os.ver_custos",
      "estoque.ver_custos",
      "pdv.aplicar_desconto_acima_limite",
      "os.reabrir",
      "financeiro.baixar",
      "auditoria.ver",
    ] as const;

    for (const permissao of exigidas) {
      expect(PERMISSOES_ESPECIAIS).toContain(permissao);
    }
  });

  it("as 3 permissoes de escopo pedidas na Fase 1D-3 estao no bloco de escopo, com os rotulos certos", () => {
    const porPermissao = new Map(PERMISSOES_ESCOPO.map((item) => [item.permissao, item]));

    for (const permissao of ["os.ver_todas", "caixa.ver_todos", "financeiro.ver_todos"] as const) {
      const item = porPermissao.get(permissao);
      expect(item).toBeDefined();
      expect(item?.rotuloAtivo).toBe("Vê de todos");
      expect(item?.rotuloInativo).toBe("Vê apenas os seus");
    }
  });
});
