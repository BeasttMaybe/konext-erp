import { describe, expect, it } from "vitest";

import {
  CARGOS_PADRAO,
  PERMISSOES_ATENDENTE_PADRAO,
  PERMISSOES_FINANCEIRO_PADRAO,
  PERMISSOES_GERENTE_PADRAO,
  PERMISSOES_TECNICO_PADRAO,
} from "./cargos-padrao";
import { mapearCargoParaRoleLegado } from "./mapear-cargo-legado";
import { CATALOGO_PERMISSOES, type Permissao } from "./permissoes";

function conjunto(permissoes: readonly Permissao[]): ReadonlySet<Permissao> {
  return new Set(permissoes);
}

describe("mapearCargoParaRoleLegado", () => {
  it("fixo sempre mapeia pra ADMIN, mesmo com um conjunto de permissoes vazio", () => {
    expect(mapearCargoParaRoleLegado({ fixo: true, permissoes: new Set() })).toBe("ADMIN");
  });

  it("o Administrador padrao (fixo, catalogo inteiro) mapeia pra ADMIN", () => {
    expect(mapearCargoParaRoleLegado({ fixo: true, permissoes: conjunto(CATALOGO_PERMISSOES) })).toBe("ADMIN");
  });

  it("cargo customizado com qualquer uma das 3 permissoes de configuracoes mapeia pra ADMIN", () => {
    expect(
      mapearCargoParaRoleLegado({ fixo: false, permissoes: conjunto(["configuracoes.empresa"]) })
    ).toBe("ADMIN");
    expect(
      mapearCargoParaRoleLegado({ fixo: false, permissoes: conjunto(["configuracoes.sistema"]) })
    ).toBe("ADMIN");
    expect(
      mapearCargoParaRoleLegado({ fixo: false, permissoes: conjunto(["configuracoes.usuarios"]) })
    ).toBe("ADMIN");
  });

  it("cargo customizado com configuracoes.* MISTURADA com outras permissoes ainda mapeia pra ADMIN", () => {
    expect(
      mapearCargoParaRoleLegado({
        fixo: false,
        permissoes: conjunto(["os.criar", "configuracoes.usuarios", "crm.ver"]),
      })
    ).toBe("ADMIN");
  });

  it("o conjunto padrao do Gerente mapeia pra GESTOR", () => {
    expect(mapearCargoParaRoleLegado({ fixo: false, permissoes: conjunto(PERMISSOES_GERENTE_PADRAO) })).toBe(
      "GESTOR"
    );
  });

  it("o conjunto do Gerente MENOS uma permissao ja nao bate mais — vira USUARIO", () => {
    const semUltima = PERMISSOES_GERENTE_PADRAO.slice(0, -1);
    expect(mapearCargoParaRoleLegado({ fixo: false, permissoes: conjunto(semUltima) })).toBe("USUARIO");
  });

  it("o conjunto do Gerente MAIS uma permissao de configuracoes vira ADMIN antes mesmo de comparar o conjunto", () => {
    // PERMISSOES_GERENTE_PADRAO ja e "catalogo inteiro menos configuracoes.*",
    // entao a UNICA permissao que da pra acrescentar (sem repetir uma ja
    // presente) e uma das 3 de configuracoes — o que aciona a regra 2 antes
    // de chegar na comparacao de conjunto da regra 3.
    expect(
      mapearCargoParaRoleLegado({
        fixo: false,
        permissoes: conjunto([...PERMISSOES_GERENTE_PADRAO, "configuracoes.empresa"]),
      })
    ).toBe("ADMIN");
  });

  it("Tecnico padrao mapeia pra USUARIO", () => {
    expect(mapearCargoParaRoleLegado({ fixo: false, permissoes: conjunto(PERMISSOES_TECNICO_PADRAO) })).toBe(
      "USUARIO"
    );
  });

  it("Atendente padrao mapeia pra USUARIO", () => {
    expect(mapearCargoParaRoleLegado({ fixo: false, permissoes: conjunto(PERMISSOES_ATENDENTE_PADRAO) })).toBe(
      "USUARIO"
    );
  });

  it("Financeiro padrao mapeia pra USUARIO", () => {
    expect(mapearCargoParaRoleLegado({ fixo: false, permissoes: conjunto(PERMISSOES_FINANCEIRO_PADRAO) })).toBe(
      "USUARIO"
    );
  });

  it("conjunto vazio mapeia pra USUARIO", () => {
    expect(mapearCargoParaRoleLegado({ fixo: false, permissoes: new Set() })).toBe("USUARIO");
  });

  it("cobre os 5 cargos padrao pelo mapeamento esperado", () => {
    const esperado: Record<string, string> = {
      Administrador: "ADMIN",
      Gerente: "GESTOR",
      Técnico: "USUARIO",
      Atendente: "USUARIO",
      Financeiro: "USUARIO",
    };

    for (const cargo of CARGOS_PADRAO) {
      const resultado = mapearCargoParaRoleLegado({ fixo: cargo.fixo, permissoes: conjunto(cargo.permissoes) });
      expect(resultado).toBe(esperado[cargo.nome]);
    }
  });
});

describe("PERMISSOES_ATENDENTE_PADRAO — paridade com o legado USUARIO", () => {
  it("inclui financeiro.ver (o antigo papel USUARIO ja tinha; o backfill nao pode tirar permissao de ninguem)", () => {
    expect(PERMISSOES_ATENDENTE_PADRAO).toContain("financeiro.ver");
  });
});
