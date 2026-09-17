import { describe, expect, it } from "vitest";

import {
  CATALOGO_PERMISSOES,
  ErroPermissao,
  PAPEIS_EMPRESA,
  ehPapelEmpresa,
  exigirPermissao,
  obterPermissoesDoContexto,
  permissoesDoPapel,
  rotularPapel,
  temAlgumaPermissao,
  temPermissao,
  type PapelEmpresa,
  type Permissao,
} from "./permissoes";
import type { ContextoTenantSeguro } from "@/types/tenant";

function contextoComPapel(papel: PapelEmpresa): ContextoTenantSeguro {
  return {
    usuarioOperacional: { id: "u1", nome: "Teste", email: "teste@konext.com", role: "OPERADOR" },
    usuarioCentralId: "central-1",
    empresaId: "empresa-1",
    empresaSlug: "empresa-teste",
    tenantId: "tenant-1",
    tenantSlug: "tenant-teste",
    connectionRef: "TENANT_TESTE_DATABASE_URL",
    papelEmpresa: papel,
  };
}

const PERMISSOES_NEGADAS_GESTOR: readonly Permissao[] = [
  "configuracoes.empresa",
  "configuracoes.sistema",
  "configuracoes.usuarios",
];

const PERMISSOES_USUARIO: readonly Permissao[] = [
  "os.criar",
  "os.editar",
  "os.finalizar",
  "pdv.vender",
  "caixa.abrir",
  "caixa.fechar",
  "estoque.ver",
  "crm.ver",
  "crm.editar",
  "propostas.editar",
  "metas.ver",
  "financeiro.ver",
];

describe("ehPapelEmpresa / rotularPapel", () => {
  it("reconhece os tres papeis validos", () => {
    for (const papel of PAPEIS_EMPRESA) {
      expect(ehPapelEmpresa(papel)).toBe(true);
    }
  });

  it("rejeita o papel do tenant (Usuario.role), que nao e um PapelEmpresa", () => {
    expect(ehPapelEmpresa("OPERADOR")).toBe(false);
    expect(ehPapelEmpresa("TECNICO")).toBe(false);
    expect(ehPapelEmpresa("")).toBe(false);
  });

  it("rotula os tres papeis em pt-BR e devolve algo legivel para valores invalidos", () => {
    expect(rotularPapel("ADMIN")).toBe("Administrador");
    expect(rotularPapel("GESTOR")).toBe("Gestor");
    expect(rotularPapel("USUARIO")).toBe("Usuário");
    expect(rotularPapel("OPERADOR")).toBe("OPERADOR");
    expect(rotularPapel("")).toBe("não identificado");
  });
});

describe("ADMIN", () => {
  it("tem todas as permissoes do catalogo", () => {
    const contexto = contextoComPapel("ADMIN");
    for (const permissao of CATALOGO_PERMISSOES) {
      expect(temPermissao(contexto, permissao)).toBe(true);
    }
  });

  it("nunca lanca ErroPermissao", () => {
    const contexto = contextoComPapel("ADMIN");
    for (const permissao of CATALOGO_PERMISSOES) {
      expect(() => exigirPermissao(contexto, permissao)).not.toThrow();
    }
  });
});

describe("GESTOR", () => {
  const contexto = contextoComPapel("GESTOR");

  it("tem todas as permissoes exceto as tres de configuracoes", () => {
    for (const permissao of CATALOGO_PERMISSOES) {
      const esperado = !PERMISSOES_NEGADAS_GESTOR.includes(permissao);
      expect(temPermissao(contexto, permissao)).toBe(esperado);
    }
  });

  it("lanca ErroPermissao especificamente para as tres permissoes de configuracoes", () => {
    for (const permissao of PERMISSOES_NEGADAS_GESTOR) {
      expect(() => exigirPermissao(contexto, permissao)).toThrow(ErroPermissao);
    }
  });

  it("nao lanca para operacoes de negocio (os, pdv, financeiro, vendas, auditoria)", () => {
    const permissoesDeNegocio: Permissao[] = [
      "os.excluir",
      "os.reabrir",
      "os.ver_custos",
      "pdv.aplicar_desconto_acima_limite",
      "financeiro.excluir",
      "vendas.aprovar",
      "vendas.cancelar",
      "auditoria.ver",
      "dashboard.financeiro",
    ];
    for (const permissao of permissoesDeNegocio) {
      expect(() => exigirPermissao(contexto, permissao)).not.toThrow();
    }
  });
});

describe("USUARIO", () => {
  const contexto = contextoComPapel("USUARIO");

  it("tem exatamente a lista curta de permissoes do dia a dia", () => {
    const concedidas = CATALOGO_PERMISSOES.filter((permissao) => temPermissao(contexto, permissao));
    expect(concedidas.sort()).toEqual([...PERMISSOES_USUARIO].sort());
  });

  it("nao tem nenhuma permissao fora da lista", () => {
    for (const permissao of CATALOGO_PERMISSOES) {
      const esperado = PERMISSOES_USUARIO.includes(permissao);
      expect(temPermissao(contexto, permissao)).toBe(esperado);
    }
  });

  it("e bloqueado nas operacoes sensiveis: excluir, reabrir, ver custos, configuracoes", () => {
    const permissoesNegadas: Permissao[] = [
      "os.excluir",
      "os.reabrir",
      "os.ver_custos",
      "estoque.editar",
      "estoque.excluir",
      "estoque.ver_custos",
      "crm.excluir",
      "financeiro.lancar",
      "financeiro.baixar",
      "financeiro.editar",
      "financeiro.excluir",
      "metas.editar",
      "metas.excluir",
      "vendas.aprovar",
      "vendas.cancelar",
      "configuracoes.empresa",
      "configuracoes.sistema",
      "configuracoes.usuarios",
      "auditoria.ver",
      "dashboard.financeiro",
      "pdv.aplicar_desconto_acima_limite",
      "caixa.ver_historico",
      "propostas.excluir",
    ];

    for (const permissao of permissoesNegadas) {
      expect(temPermissao(contexto, permissao)).toBe(false);
      expect(() => exigirPermissao(contexto, permissao)).toThrow(ErroPermissao);
    }
  });

  it("a mensagem de ErroPermissao e pt-BR e cita o papel atual", () => {
    try {
      exigirPermissao(contexto, "os.excluir");
      expect.unreachable("deveria ter lancado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroPermissao);
      const erroPermissao = erro as ErroPermissao;
      expect(erroPermissao.message).toContain("Usuário");
      expect(erroPermissao.message).toContain("os.excluir");
      expect(erroPermissao.papelAtual).toBe("USUARIO");
      expect(erroPermissao.permissaoExigida).toBe("os.excluir");
    }
  });
});

describe("temAlgumaPermissao", () => {
  it("verdadeiro quando pelo menos uma permissao do grupo e concedida", () => {
    const contexto = contextoComPapel("USUARIO");
    expect(temAlgumaPermissao(contexto, ["os.excluir", "os.criar"])).toBe(true);
  });

  it("falso quando nenhuma permissao do grupo e concedida", () => {
    const contexto = contextoComPapel("USUARIO");
    expect(
      temAlgumaPermissao(contexto, ["configuracoes.empresa", "configuracoes.sistema", "configuracoes.usuarios"])
    ).toBe(false);
  });
});

describe("permissoesDoPapel / obterPermissoesDoContexto", () => {
  it("devolve um conjunto consistente com temPermissao para os tres papeis", () => {
    for (const papel of PAPEIS_EMPRESA) {
      const contexto = contextoComPapel(papel);
      const permissoes = permissoesDoPapel(papel);

      for (const permissao of CATALOGO_PERMISSOES) {
        expect(permissoes.has(permissao)).toBe(temPermissao(contexto, permissao));
      }
    }
  });

  it("obterPermissoesDoContexto e serializavel (papel + array) e bate com o papel do contexto", () => {
    const contexto = contextoComPapel("GESTOR");
    const resultado = obterPermissoesDoContexto(contexto);

    expect(resultado.papel).toBe("GESTOR");
    expect(Array.isArray(resultado.permissoes)).toBe(true);
    expect(resultado.permissoes).not.toContain("configuracoes.empresa");
    expect(resultado.permissoes).toContain("os.excluir");
  });
});

describe("robustez contra papel invalido/ausente (F-01: nunca usar Usuario.role do tenant)", () => {
  it("trata papelEmpresa corrompido como USUARIO (o menos privilegiado), nunca como ADMIN", () => {
    const contextoCorrompido = {
      ...contextoComPapel("ADMIN"),
      papelEmpresa: "OPERADOR" as unknown as PapelEmpresa,
    };

    expect(temPermissao(contextoCorrompido, "os.excluir")).toBe(false);
    expect(temPermissao(contextoCorrompido, "os.criar")).toBe(true);
  });
});
