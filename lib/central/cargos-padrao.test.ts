import { describe, expect, it } from "vitest";

import { CARGOS_PADRAO } from "@/lib/auth/cargos-padrao";
import { criarCargosPadrao, type ClienteCargoParaProvisionamento } from "./cargos-padrao";

type ChamadaCriacao = {
  empresaId: string;
  nome: string;
  descricao: string | null;
  fixo: boolean;
  permissoes: string[];
};

function criarClienteFalso(): { cliente: ClienteCargoParaProvisionamento; chamadas: ChamadaCriacao[] } {
  const chamadas: ChamadaCriacao[] = [];
  let contador = 0;

  const cliente: ClienteCargoParaProvisionamento = {
    cargo: {
      create: async ({ data }) => {
        contador += 1;
        chamadas.push({
          empresaId: data.empresaId,
          nome: data.nome,
          descricao: data.descricao,
          fixo: data.fixo,
          permissoes: data.permissoes.create.map((linha) => linha.permissao),
        });
        return { id: `cargo-teste-${contador}` };
      },
    },
  };

  return { cliente, chamadas };
}

describe("criarCargosPadrao", () => {
  it("cria exatamente os 5 cargos padrao, todos pra empresa informada", async () => {
    const { cliente, chamadas } = criarClienteFalso();

    await criarCargosPadrao("empresa-nova-1", cliente);

    expect(chamadas).toHaveLength(5);
    expect(chamadas.every((chamada) => chamada.empresaId === "empresa-nova-1")).toBe(true);
    expect(chamadas.map((chamada) => chamada.nome).sort()).toEqual(
      [...CARGOS_PADRAO.map((definicao) => definicao.nome)].sort()
    );
  });

  it("cada cargo criado tem exatamente fixo e permissoes da definicao padrao", async () => {
    const { cliente, chamadas } = criarClienteFalso();

    await criarCargosPadrao("empresa-nova-1", cliente);

    for (const definicao of CARGOS_PADRAO) {
      const chamada = chamadas.find((item) => item.nome === definicao.nome);
      expect(chamada).toBeDefined();
      expect(chamada?.fixo).toBe(definicao.fixo);
      expect(chamada?.permissoes.slice().sort()).toEqual([...definicao.permissoes].sort());
    }
  });

  it("so o Administrador nasce fixo=true — uma empresa nova ja nasce com a mesma regra de fixo da migracao", () => {
    const administrador = CARGOS_PADRAO.find((definicao) => definicao.nome === "Administrador");
    const outros = CARGOS_PADRAO.filter((definicao) => definicao.nome !== "Administrador");

    expect(administrador?.fixo).toBe(true);
    expect(outros.every((definicao) => !definicao.fixo)).toBe(true);
  });

  it("devolve o id de cada cargo criado, indexado pelo nome — pronto pra quem provisiona atribuir o Administrador ao primeiro usuario", async () => {
    const { cliente } = criarClienteFalso();

    const mapa = await criarCargosPadrao("empresa-nova-1", cliente);

    expect(Object.keys(mapa).sort()).toEqual([...CARGOS_PADRAO.map((definicao) => definicao.nome)].sort());
    expect(mapa.Administrador).toMatch(/^cargo-teste-/);
    expect(mapa.Gerente).toMatch(/^cargo-teste-/);
    expect(mapa.Técnico).toMatch(/^cargo-teste-/);
    expect(mapa.Atendente).toMatch(/^cargo-teste-/);
    expect(mapa.Financeiro).toMatch(/^cargo-teste-/);
  });
});
