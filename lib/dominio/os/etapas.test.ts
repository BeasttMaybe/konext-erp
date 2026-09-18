import { describe, expect, it } from "vitest";

import type { StatusOS } from "./maquina-estados";
import { STATUS_OS_SEQUENCIA } from "./maquina-estados";
import { normalizarSituacao, paraEstagio, paraStatusLegado } from "./etapas";

describe("paraEstagio", () => {
  it("mapeia cada status legado pra etapa+situacao, cobrindo todo o enum", () => {
    expect(paraEstagio("AGUARDANDO_ORCAMENTO")).toEqual({ etapa: "ORCAMENTO", situacao: null });
    expect(paraEstagio("AGUARDANDO_APROVACAO")).toEqual({ etapa: "ORCAMENTO", situacao: "AGUARDANDO_APROVACAO" });
    expect(paraEstagio("APROVADO")).toEqual({ etapa: "CONSERTO", situacao: null });
    expect(paraEstagio("EM_MANUTENCAO")).toEqual({ etapa: "CONSERTO", situacao: null });
    expect(paraEstagio("AGUARDANDO_PECA")).toEqual({ etapa: "CONSERTO", situacao: "AGUARDANDO_PECA" });
    expect(paraEstagio("GARANTIA_RETORNO")).toEqual({ etapa: "CONSERTO", situacao: null });
    expect(paraEstagio("PRONTO")).toEqual({ etapa: "PRONTO", situacao: null });
    expect(paraEstagio("ENTREGUE")).toEqual({ etapa: "ENTREGUE", situacao: null });
  });

  it("cobre literalmente todo StatusOS sem cair no default do switch", () => {
    for (const status of STATUS_OS_SEQUENCIA as readonly StatusOS[]) {
      expect(() => paraEstagio(status)).not.toThrow();
    }
  });
});

describe("paraStatusLegado", () => {
  it("OS normal: ORCAMENTO sem situacao -> AGUARDANDO_ORCAMENTO", () => {
    expect(paraStatusLegado({ etapa: "ORCAMENTO", situacao: null }, false)).toBe("AGUARDANDO_ORCAMENTO");
  });

  it("OS normal: ORCAMENTO + AGUARDANDO_APROVACAO -> AGUARDANDO_APROVACAO", () => {
    expect(paraStatusLegado({ etapa: "ORCAMENTO", situacao: "AGUARDANDO_APROVACAO" }, false)).toBe(
      "AGUARDANDO_APROVACAO"
    );
  });

  it("OS normal: CONSERTO sem situacao -> EM_MANUTENCAO", () => {
    expect(paraStatusLegado({ etapa: "CONSERTO", situacao: null }, false)).toBe("EM_MANUTENCAO");
  });

  it("OS normal: CONSERTO + AGUARDANDO_PECA -> AGUARDANDO_PECA", () => {
    expect(paraStatusLegado({ etapa: "CONSERTO", situacao: "AGUARDANDO_PECA" }, false)).toBe("AGUARDANDO_PECA");
  });

  it("retorno de garantia: CONSERTO sem situacao -> GARANTIA_RETORNO (nunca APROVADO)", () => {
    expect(paraStatusLegado({ etapa: "CONSERTO", situacao: null }, true)).toBe("GARANTIA_RETORNO");
  });

  it("retorno de garantia: CONSERTO + AGUARDANDO_PECA -> AGUARDANDO_PECA, igual a uma OS normal", () => {
    expect(paraStatusLegado({ etapa: "CONSERTO", situacao: "AGUARDANDO_PECA" }, true)).toBe("AGUARDANDO_PECA");
  });

  it("PRONTO e ENTREGUE nao dependem de retorno de garantia nem de situacao", () => {
    expect(paraStatusLegado({ etapa: "PRONTO", situacao: null }, false)).toBe("PRONTO");
    expect(paraStatusLegado({ etapa: "PRONTO", situacao: null }, true)).toBe("PRONTO");
    expect(paraStatusLegado({ etapa: "ENTREGUE", situacao: null }, false)).toBe("ENTREGUE");
    expect(paraStatusLegado({ etapa: "ENTREGUE", situacao: null }, true)).toBe("ENTREGUE");
  });

  it("situacao invalida pra etapa (ex.: AGUARDANDO_PECA em ORCAMENTO) e ignorada, nao propagada", () => {
    expect(paraStatusLegado({ etapa: "ORCAMENTO", situacao: "AGUARDANDO_PECA" }, false)).toBe(
      "AGUARDANDO_ORCAMENTO"
    );
    expect(paraStatusLegado({ etapa: "CONSERTO", situacao: "AGUARDANDO_APROVACAO" }, false)).toBe("EM_MANUTENCAO");
  });
});

describe("normalizarSituacao", () => {
  it("mantem a situacao quando ela e valida pra etapa", () => {
    expect(normalizarSituacao("ORCAMENTO", "AGUARDANDO_APROVACAO")).toBe("AGUARDANDO_APROVACAO");
    expect(normalizarSituacao("CONSERTO", "AGUARDANDO_PECA")).toBe("AGUARDANDO_PECA");
  });

  it("zera a situacao quando ela nao pertence a etapa", () => {
    expect(normalizarSituacao("ORCAMENTO", "AGUARDANDO_PECA")).toBeNull();
    expect(normalizarSituacao("CONSERTO", "AGUARDANDO_APROVACAO")).toBeNull();
    expect(normalizarSituacao("PRONTO", "AGUARDANDO_PECA")).toBeNull();
    expect(normalizarSituacao("ENTREGUE", "AGUARDANDO_APROVACAO")).toBeNull();
  });

  it("null/undefined permanece null", () => {
    expect(normalizarSituacao("ORCAMENTO", null)).toBeNull();
    expect(normalizarSituacao("ORCAMENTO", undefined)).toBeNull();
  });
});

describe("ida e volta", () => {
  it("todo status legado, convertido pra estagio e de volta com o ehRetornoGarantia correspondente, e estavel — exceto o colapso conhecido APROVADO -> EM_MANUTENCAO", () => {
    const statusQueColapsam: readonly StatusOS[] = ["APROVADO"];

    for (const status of STATUS_OS_SEQUENCIA as readonly StatusOS[]) {
      const ehRetornoGarantia = status === "GARANTIA_RETORNO";
      const estagio = paraEstagio(status);
      const statusDeVolta = paraStatusLegado(estagio, ehRetornoGarantia);

      if (statusQueColapsam.includes(status)) {
        expect(statusDeVolta).toBe("EM_MANUTENCAO");
      } else {
        expect(statusDeVolta).toBe(status);
      }
    }
  });
});
