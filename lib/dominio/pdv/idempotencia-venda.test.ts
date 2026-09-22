import { describe, expect, it, vi } from "vitest";

import {
  ehViolacaoDeChaveUnica,
  processarVendaComIdempotencia,
  type RepositorioIdempotenciaVenda,
} from "./idempotencia-venda";

type VendaFalsa = { id: string; chaveIdempotencia: string | null };

function erroViolacaoUnique(alvo: string | string[] = "chaveIdempotencia"): unknown {
  return { code: "P2002", meta: { target: alvo } };
}

describe("ehViolacaoDeChaveUnica", () => {
  it("reconhece P2002 com chaveIdempotencia no alvo (string ou array)", () => {
    expect(ehViolacaoDeChaveUnica(erroViolacaoUnique("chaveIdempotencia"))).toBe(true);
    expect(ehViolacaoDeChaveUnica(erroViolacaoUnique(["chaveIdempotencia"]))).toBe(true);
  });

  it("rejeita P2002 de outra coluna (não engole violações de UNIQUE alheias)", () => {
    expect(ehViolacaoDeChaveUnica(erroViolacaoUnique("email"))).toBe(false);
  });

  it("rejeita erros sem código P2002, ou que não são objetos", () => {
    expect(ehViolacaoDeChaveUnica(new Error("qualquer coisa"))).toBe(false);
    expect(ehViolacaoDeChaveUnica(null)).toBe(false);
    expect(ehViolacaoDeChaveUnica(undefined)).toBe(false);
    expect(ehViolacaoDeChaveUnica("string crua")).toBe(false);
  });
});

describe("processarVendaComIdempotencia — sem chave (comportamento de hoje)", () => {
  it("sempre cria, nunca busca — chamador antigo ou reenvio sem chave", async () => {
    const criar = vi.fn(async () => ({ id: "venda-1", chaveIdempotencia: null }) satisfies VendaFalsa);
    const buscarPorChave = vi.fn(async () => null);

    const resultado = await processarVendaComIdempotencia<VendaFalsa>(undefined, {
      buscarPorChave,
      criar,
    });

    expect(resultado.id).toBe("venda-1");
    expect(criar).toHaveBeenCalledTimes(1);
    expect(buscarPorChave).not.toHaveBeenCalled();
  });

  it("string vazia/só espaço é tratada como \"sem chave\"", async () => {
    const criar = vi.fn(async () => ({ id: "venda-1", chaveIdempotencia: null }) satisfies VendaFalsa);
    const buscarPorChave = vi.fn(async () => null);

    await processarVendaComIdempotencia<VendaFalsa>("   ", { buscarPorChave, criar });

    expect(criar).toHaveBeenCalledTimes(1);
    expect(buscarPorChave).not.toHaveBeenCalled();
  });
});

describe("processarVendaComIdempotencia — com chave, caminho sequencial", () => {
  it("chave nova (não encontrada): busca, não acha, cria", async () => {
    const criar = vi.fn(async () => ({ id: "venda-2", chaveIdempotencia: "chave-x" }) satisfies VendaFalsa);
    const buscarPorChave = vi.fn(async () => null);

    const resultado = await processarVendaComIdempotencia<VendaFalsa>("chave-x", {
      buscarPorChave,
      criar,
    });

    expect(resultado.id).toBe("venda-2");
    expect(buscarPorChave).toHaveBeenCalledWith("chave-x");
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it("chave já usada (reenvio da mesma tentativa): devolve a venda existente, NÃO cria outra", async () => {
    const vendaExistente: VendaFalsa = { id: "venda-original", chaveIdempotencia: "chave-y" };
    const criar = vi.fn(async () => ({ id: "venda-duplicada", chaveIdempotencia: "chave-y" }) satisfies VendaFalsa);
    const buscarPorChave = vi.fn(async () => vendaExistente);

    const resultado = await processarVendaComIdempotencia<VendaFalsa>("chave-y", {
      buscarPorChave,
      criar,
    });

    expect(resultado).toBe(vendaExistente);
    expect(criar).not.toHaveBeenCalled();
  });

  it("erro que não é violação de chave única sobe sem ser engolido", async () => {
    const erroInesperado = new Error("conexão caiu");
    const criar = vi.fn(async () => {
      throw erroInesperado;
    });
    const buscarPorChave = vi.fn(async () => null);

    await expect(
      processarVendaComIdempotencia<VendaFalsa>("chave-z", { buscarPorChave, criar })
    ).rejects.toBe(erroInesperado);
  });
});

describe("processarVendaComIdempotencia — corrida real entre duas chamadas concorrentes", () => {
  /**
   * Simula o banco: um Map compartilhado indexado por chave, com `criar`
   * fazendo um "buscar de novo, então inserir" dentro do dublê — igual a
   * uma constraint UNIQUE real, a SEGUNDA escrita concorrente pra mesma
   * chave falha com P2002, não sobrescreve nem duplica.
   */
  function criarBancoFalsoCompartilhado() {
    const linhas = new Map<string, VendaFalsa>();
    let proximoId = 1;

    return {
      linhas,
      repositorioPara(chave: string): RepositorioIdempotenciaVenda<VendaFalsa> {
        return {
          buscarPorChave: async (chaveIdempotencia) => linhas.get(chaveIdempotencia) ?? null,
          criar: async () => {
            // Cede o event loop pra garantir que as duas chamadas concorrentes
            // cheguem aqui ANTES de qualquer uma commitar — é exatamente essa
            // janela que a constraint UNIQUE do banco fecha na vida real.
            await new Promise((resolve) => setTimeout(resolve, 0));

            if (linhas.has(chave)) {
              throw erroViolacaoUnique("chaveIdempotencia");
            }

            const venda: VendaFalsa = { id: `venda-${proximoId++}`, chaveIdempotencia: chave };
            linhas.set(chave, venda);
            return venda;
          },
        };
      },
    };
  }

  it("duas chamadas concorrentes com a MESMA chave criam exatamente uma venda e devolvem a mesma", async () => {
    const banco = criarBancoFalsoCompartilhado();

    const [resultadoA, resultadoB] = await Promise.all([
      processarVendaComIdempotencia<VendaFalsa>("chave-concorrente", banco.repositorioPara("chave-concorrente")),
      processarVendaComIdempotencia<VendaFalsa>("chave-concorrente", banco.repositorioPara("chave-concorrente")),
    ]);

    expect(banco.linhas.size).toBe(1);
    expect(resultadoA.id).toBe(resultadoB.id);
    expect([resultadoA.id, resultadoB.id]).toEqual([resultadoA.id, resultadoA.id]);
  });

  it("uma chave NOVA (venda diferente) cria uma venda nova, sem interferir na primeira", async () => {
    const banco = criarBancoFalsoCompartilhado();

    const [primeira, segunda] = await Promise.all([
      processarVendaComIdempotencia<VendaFalsa>("chave-1", banco.repositorioPara("chave-1")),
      processarVendaComIdempotencia<VendaFalsa>("chave-2", banco.repositorioPara("chave-2")),
    ]);

    expect(banco.linhas.size).toBe(2);
    expect(primeira.id).not.toBe(segunda.id);
  });
});
