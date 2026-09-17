import { describe, expect, it } from "vitest";

import {
  STATUS_OS_EM_ANDAMENTO,
  STATUS_OS_SEQUENCIA,
  destinosPermitidos,
  ehStatusOS,
  motivoTransicaoNegada,
  podeTransicionar,
  statusPermitidosParaTipo,
  type StatusOS,
} from "./maquina-estados";

const OS_NORMAL = { ehRetornoGarantia: false } as const;
const OS_GARANTIA = { ehRetornoGarantia: true } as const;

/** Matriz esperada para OS normal: de -> destinos permitidos. */
const MATRIZ_NORMAL: Readonly<Record<StatusOS, StatusOS[]>> = {
  AGUARDANDO_ORCAMENTO: ["AGUARDANDO_APROVACAO", "APROVADO", "AGUARDANDO_PECA", "EM_MANUTENCAO", "PRONTO"],
  AGUARDANDO_APROVACAO: ["AGUARDANDO_ORCAMENTO", "APROVADO", "AGUARDANDO_PECA", "EM_MANUTENCAO", "PRONTO"],
  APROVADO: ["AGUARDANDO_ORCAMENTO", "AGUARDANDO_APROVACAO", "AGUARDANDO_PECA", "EM_MANUTENCAO", "PRONTO"],
  AGUARDANDO_PECA: ["AGUARDANDO_ORCAMENTO", "AGUARDANDO_APROVACAO", "APROVADO", "EM_MANUTENCAO", "PRONTO"],
  EM_MANUTENCAO: ["AGUARDANDO_ORCAMENTO", "AGUARDANDO_APROVACAO", "APROVADO", "AGUARDANDO_PECA", "PRONTO"],
  GARANTIA_RETORNO: [],
  PRONTO: ["AGUARDANDO_PECA", "EM_MANUTENCAO"],
  ENTREGUE: [],
};

/** Matriz esperada para OS de retorno de garantia. */
const MATRIZ_GARANTIA: Readonly<Record<StatusOS, StatusOS[]>> = {
  AGUARDANDO_ORCAMENTO: [],
  AGUARDANDO_APROVACAO: [],
  APROVADO: [],
  AGUARDANDO_PECA: ["EM_MANUTENCAO", "GARANTIA_RETORNO", "PRONTO"],
  EM_MANUTENCAO: ["AGUARDANDO_PECA", "GARANTIA_RETORNO", "PRONTO"],
  GARANTIA_RETORNO: ["AGUARDANDO_PECA", "EM_MANUTENCAO", "PRONTO"],
  PRONTO: ["AGUARDANDO_PECA", "EM_MANUTENCAO"],
  ENTREGUE: [],
};

function ordenarPelaSequencia(status: readonly StatusOS[]): StatusOS[] {
  return STATUS_OS_SEQUENCIA.filter((item) => status.includes(item));
}

describe("ehStatusOS", () => {
  it("aceita todos os status da sequencia", () => {
    for (const status of STATUS_OS_SEQUENCIA) {
      expect(ehStatusOS(status)).toBe(true);
    }
  });

  it("rejeita valores fora do enum", () => {
    expect(ehStatusOS("CANCELADO")).toBe(false);
    expect(ehStatusOS("")).toBe(false);
    expect(ehStatusOS("entregue")).toBe(false);
  });
});

describe("podeTransicionar — matriz completa da OS normal", () => {
  for (const de of STATUS_OS_SEQUENCIA) {
    for (const para of STATUS_OS_SEQUENCIA) {
      const esperado = MATRIZ_NORMAL[de].includes(para);

      it(`${de} -> ${para} = ${esperado}`, () => {
        expect(podeTransicionar(de, para, OS_NORMAL)).toBe(esperado);
      });
    }
  }
});

describe("podeTransicionar — matriz completa da OS de retorno de garantia", () => {
  for (const de of STATUS_OS_SEQUENCIA) {
    for (const para of STATUS_OS_SEQUENCIA) {
      const esperado = MATRIZ_GARANTIA[de].includes(para);

      it(`${de} -> ${para} = ${esperado}`, () => {
        expect(podeTransicionar(de, para, OS_GARANTIA)).toBe(esperado);
      });
    }
  }
});

describe("invariantes do ciclo de vida", () => {
  it("ENTREGUE nunca e alcancavel por mudanca generica de status", () => {
    for (const de of STATUS_OS_SEQUENCIA) {
      expect(podeTransicionar(de, "ENTREGUE", OS_NORMAL)).toBe(false);
      expect(podeTransicionar(de, "ENTREGUE", OS_GARANTIA)).toBe(false);
    }
  });

  it("ENTREGUE nunca sai por mudanca generica de status", () => {
    for (const para of STATUS_OS_SEQUENCIA) {
      expect(podeTransicionar("ENTREGUE", para, OS_NORMAL)).toBe(false);
      expect(podeTransicionar("ENTREGUE", para, OS_GARANTIA)).toBe(false);
    }
  });

  it("nenhum status transiciona para si mesmo", () => {
    for (const status of STATUS_OS_SEQUENCIA) {
      expect(podeTransicionar(status, status, OS_NORMAL)).toBe(false);
      expect(podeTransicionar(status, status, OS_GARANTIA)).toBe(false);
    }
  });

  it("GARANTIA_RETORNO e inacessivel para OS normal nos dois sentidos", () => {
    for (const outro of STATUS_OS_SEQUENCIA) {
      expect(podeTransicionar(outro, "GARANTIA_RETORNO", OS_NORMAL)).toBe(false);
      expect(podeTransicionar("GARANTIA_RETORNO", outro, OS_NORMAL)).toBe(false);
    }
  });

  it("OS normal pode pular etapas dentro de EM_ANDAMENTO", () => {
    expect(podeTransicionar("AGUARDANDO_ORCAMENTO", "EM_MANUTENCAO", OS_NORMAL)).toBe(true);
    expect(podeTransicionar("AGUARDANDO_ORCAMENTO", "PRONTO", OS_NORMAL)).toBe(true);
  });

  it("OS normal volta de PRONTO apenas para retrabalho", () => {
    expect(podeTransicionar("PRONTO", "AGUARDANDO_PECA", OS_NORMAL)).toBe(true);
    expect(podeTransicionar("PRONTO", "EM_MANUTENCAO", OS_NORMAL)).toBe(true);
    expect(podeTransicionar("PRONTO", "APROVADO", OS_NORMAL)).toBe(false);
    expect(podeTransicionar("PRONTO", "AGUARDANDO_ORCAMENTO", OS_NORMAL)).toBe(false);
  });

  it("OS de garantia nao usa os status de orcamento", () => {
    for (const status of ["AGUARDANDO_ORCAMENTO", "AGUARDANDO_APROVACAO", "APROVADO"] as const) {
      expect(podeTransicionar("GARANTIA_RETORNO", status, OS_GARANTIA)).toBe(false);
      expect(podeTransicionar(status, "GARANTIA_RETORNO", OS_GARANTIA)).toBe(false);
    }
  });
});

describe("destinosPermitidos", () => {
  it("bate com a matriz da OS normal, na ordem do Kanban", () => {
    for (const de of STATUS_OS_SEQUENCIA) {
      expect(destinosPermitidos(de, OS_NORMAL)).toEqual(ordenarPelaSequencia(MATRIZ_NORMAL[de]));
    }
  });

  it("bate com a matriz da OS de retorno de garantia", () => {
    for (const de of STATUS_OS_SEQUENCIA) {
      expect(destinosPermitidos(de, OS_GARANTIA)).toEqual(ordenarPelaSequencia(MATRIZ_GARANTIA[de]));
    }
  });

  it("nunca inclui ENTREGUE", () => {
    for (const de of STATUS_OS_SEQUENCIA) {
      expect(destinosPermitidos(de, OS_NORMAL)).not.toContain("ENTREGUE");
      expect(destinosPermitidos(de, OS_GARANTIA)).not.toContain("ENTREGUE");
    }
  });
});

describe("motivoTransicaoNegada", () => {
  it("devolve null quando a transicao e permitida", () => {
    expect(motivoTransicaoNegada("APROVADO", "EM_MANUTENCAO", OS_NORMAL)).toBeNull();
    expect(motivoTransicaoNegada("GARANTIA_RETORNO", "PRONTO", OS_GARANTIA)).toBeNull();
  });

  it("aponta a finalizacao ao tentar mover para ENTREGUE", () => {
    const motivo = motivoTransicaoNegada("PRONTO", "ENTREGUE", OS_NORMAL);
    expect(motivo).toContain("Finalizar");
  });

  it("aponta a reabertura ao tentar mover a partir de ENTREGUE", () => {
    const motivo = motivoTransicaoNegada("ENTREGUE", "PRONTO", OS_NORMAL);
    expect(motivo).toContain("Reabrir OS");
  });

  it("explica a coluna de garantia para OS normal", () => {
    const motivo = motivoTransicaoNegada("EM_MANUTENCAO", "GARANTIA_RETORNO", OS_NORMAL);
    expect(motivo).toContain("retorno de garantia");
  });

  it("explica o retrabalho ao sair de PRONTO para status invalido", () => {
    const motivo = motivoTransicaoNegada("PRONTO", "APROVADO", OS_NORMAL);
    expect(motivo).toContain("retrabalho");
  });

  it("avisa quando a OS ja esta no status pedido", () => {
    const motivo = motivoTransicaoNegada("APROVADO", "APROVADO", OS_NORMAL);
    expect(motivo).toContain("já está");
  });

  it("sempre devolve mensagem quando a transicao e negada", () => {
    for (const de of STATUS_OS_SEQUENCIA) {
      for (const para of STATUS_OS_SEQUENCIA) {
        for (const contexto of [OS_NORMAL, OS_GARANTIA]) {
          const permitido = podeTransicionar(de, para, contexto);
          const motivo = motivoTransicaoNegada(de, para, contexto);

          if (permitido) {
            expect(motivo).toBeNull();
          } else {
            expect(motivo).toBeTypeOf("string");
            expect(String(motivo).length).toBeGreaterThan(10);
          }
        }
      }
    }
  });
});

describe("statusPermitidosParaTipo", () => {
  it("OS normal nao inclui GARANTIA_RETORNO", () => {
    const permitidos = statusPermitidosParaTipo(OS_NORMAL);
    expect(permitidos).not.toContain("GARANTIA_RETORNO");
    expect(permitidos).toContain("ENTREGUE");

    for (const status of STATUS_OS_EM_ANDAMENTO) {
      expect(permitidos).toContain(status);
    }
  });

  it("OS de garantia nao inclui os status de orcamento", () => {
    const permitidos = statusPermitidosParaTipo(OS_GARANTIA);
    expect(permitidos).toContain("GARANTIA_RETORNO");
    expect(permitidos).not.toContain("AGUARDANDO_ORCAMENTO");
    expect(permitidos).not.toContain("AGUARDANDO_APROVACAO");
    expect(permitidos).not.toContain("APROVADO");
  });
});
