import { describe, expect, it } from "vitest";

import {
  contarAdminsAtivos,
  podeArquivarCargo,
  podeAtribuirCargoAoUsuario,
  podeConcederPermissoes,
  podeEditarPermissoesConsiderandoAutor,
  podeEditarPermissoesDoCargo,
  podeRemoverAcessoAdminDoUsuario,
  podeRenomearCargo,
  type UsuarioComAcessoAdmin,
} from "./invariantes-cargos";
import type { Permissao } from "./permissoes";

describe("cargo fixo (Administrador)", () => {
  it("nao pode ter as permissoes editadas", () => {
    const resultado = podeEditarPermissoesDoCargo({ fixo: true });
    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) expect(resultado.motivo).toContain("fixo");
  });

  it("nao pode ser renomeado", () => {
    const resultado = podeRenomearCargo({ fixo: true });
    expect(resultado.permitido).toBe(false);
  });

  it("nao pode ser arquivado, mesmo sem nenhum usuario nele", () => {
    const resultado = podeArquivarCargo({ fixo: true, quantidadeUsuariosAtivos: 0 });
    expect(resultado.permitido).toBe(false);
  });

  it("cargo nao-fixo pode ter permissoes editadas, ser renomeado e (sem usuarios) arquivado", () => {
    expect(podeEditarPermissoesDoCargo({ fixo: false }).permitido).toBe(true);
    expect(podeRenomearCargo({ fixo: false }).permitido).toBe(true);
    expect(podeArquivarCargo({ fixo: false, quantidadeUsuariosAtivos: 0 }).permitido).toBe(true);
  });
});

describe("cargo em uso nao pode ser arquivado", () => {
  it("bloqueia e informa quantos usuarios estao atribuidos", () => {
    const resultado = podeArquivarCargo({ fixo: false, quantidadeUsuariosAtivos: 3 });
    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) {
      expect(resultado.motivo).toContain("3");
    }
  });

  it("mensagem no singular pra exatamente 1 usuario", () => {
    const resultado = podeArquivarCargo({ fixo: false, quantidadeUsuariosAtivos: 1 });
    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) {
      expect(resultado.motivo).toContain("1 usuário está");
    }
  });
});

describe("pelo menos 1 admin ativo por empresa", () => {
  const doisAdmins: UsuarioComAcessoAdmin[] = [
    { usuarioId: "a", ativo: true, possuiConfiguracoesUsuarios: true },
    { usuarioId: "b", ativo: true, possuiConfiguracoesUsuarios: true },
  ];

  const umAdmin: UsuarioComAcessoAdmin[] = [
    { usuarioId: "a", ativo: true, possuiConfiguracoesUsuarios: true },
    { usuarioId: "b", ativo: true, possuiConfiguracoesUsuarios: false },
  ];

  it("contarAdminsAtivos ignora inativos e quem nao tem a permissao", () => {
    expect(
      contarAdminsAtivos([
        { usuarioId: "a", ativo: true, possuiConfiguracoesUsuarios: true },
        { usuarioId: "b", ativo: false, possuiConfiguracoesUsuarios: true },
        { usuarioId: "c", ativo: true, possuiConfiguracoesUsuarios: false },
      ])
    ).toBe(1);
  });

  it("permite remover o acesso de UM admin quando existe outro", () => {
    expect(podeRemoverAcessoAdminDoUsuario(doisAdmins, "a").permitido).toBe(true);
  });

  it("bloqueia remover o acesso do ULTIMO admin ativo", () => {
    const resultado = podeRemoverAcessoAdminDoUsuario(umAdmin, "a");
    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) {
      expect(resultado.motivo).toContain("única pessoa");
    }
  });

  it("permite mexer em quem NAO tem acesso admin, mesmo sendo o unico admin de outra pessoa", () => {
    expect(podeRemoverAcessoAdminDoUsuario(umAdmin, "b").permitido).toBe(true);
  });

  it("usuario ja inativo (sem acesso admin efetivo) nao bloqueia nada ao ser 'removido' de novo", () => {
    const usuarios: UsuarioComAcessoAdmin[] = [
      { usuarioId: "a", ativo: false, possuiConfiguracoesUsuarios: true },
    ];
    expect(podeRemoverAcessoAdminDoUsuario(usuarios, "a").permitido).toBe(true);
  });

  it("usuario nao encontrado na lista nao bloqueia (nao e o cenario desta invariante)", () => {
    expect(podeRemoverAcessoAdminDoUsuario(doisAdmins, "inexistente").permitido).toBe(true);
  });
});

describe("ninguem concede permissao que nao tem", () => {
  it("permite conceder um subconjunto das proprias permissoes", () => {
    const permissoesDoAutor = new Set<Permissao>(["os.criar", "os.editar", "crm.ver"]);
    const resultado = podeConcederPermissoes({ permissoesDoAutor, permissoesAlvo: ["os.criar", "crm.ver"] });
    expect(resultado.permitido).toBe(true);
  });

  it("bloqueia e nomeia a permissao que o autor nao possui", () => {
    const permissoesDoAutor = new Set<Permissao>(["os.criar"]);
    const resultado = podeConcederPermissoes({
      permissoesDoAutor,
      permissoesAlvo: ["os.criar", "configuracoes.usuarios"],
    });
    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) {
      expect(resultado.motivo).toContain("configuracoes.usuarios");
    }
  });
});

describe("ninguem edita o proprio cargo", () => {
  it("bloqueia atribuir um cargo a si mesmo", () => {
    const resultado = podeAtribuirCargoAoUsuario({ autorUsuarioCentralId: "u1", usuarioAlvoCentralId: "u1" });
    expect(resultado.permitido).toBe(false);
  });

  it("permite atribuir cargo a outra pessoa", () => {
    const resultado = podeAtribuirCargoAoUsuario({ autorUsuarioCentralId: "u1", usuarioAlvoCentralId: "u2" });
    expect(resultado.permitido).toBe(true);
  });

  it("bloqueia editar as permissoes do cargo que o proprio autor ocupa", () => {
    const resultado = podeEditarPermissoesConsiderandoAutor({
      autorUsuarioCentralId: "u1",
      usuariosDoCargoIds: ["u2", "u1", "u3"],
    });
    expect(resultado.permitido).toBe(false);
  });

  it("permite editar as permissoes de um cargo que o autor nao ocupa", () => {
    const resultado = podeEditarPermissoesConsiderandoAutor({
      autorUsuarioCentralId: "u1",
      usuariosDoCargoIds: ["u2", "u3"],
    });
    expect(resultado.permitido).toBe(true);
  });
});
