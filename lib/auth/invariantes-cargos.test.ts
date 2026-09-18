import { describe, expect, it } from "vitest";

import {
  contarAdminsAtivos,
  podeAlterarCargoDoUsuario,
  podeArquivarCargo,
  podeAtribuirCargoAoUsuario,
  podeConcederPermissoes,
  podeDesativarUsuario,
  podeEditarPermissoesConsiderandoAutor,
  podeEditarPermissoesDoCargo,
  podeReceberPropriedade,
  podeRemoverAcessoAdminDoUsuario,
  podeRenomearCargo,
  podeTransferirPropriedade,
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

describe("conta responsavel pela loja (Fase 1D-3)", () => {
  it("nao pode ser desativada por outro admin", () => {
    const resultado = podeDesativarUsuario({ usuarioAlvoEhProprietario: true });
    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) {
      expect(resultado.motivo).toContain("responsável pela loja");
      expect(resultado.motivo).toContain("Transfira a titularidade");
    }
  });

  it("nao pode se desativar nem ela mesma — a regra nao olha quem esta pedindo", () => {
    // podeDesativarUsuario nem recebe o autor: ser o proprietario ja basta pra bloquear,
    // nao importa se quem pediu foi outro admin ou o proprio dono.
    const resultado = podeDesativarUsuario({ usuarioAlvoEhProprietario: true });
    expect(resultado.permitido).toBe(false);
  });

  it("usuario comum (nao proprietario) pode ser desativado normalmente", () => {
    expect(podeDesativarUsuario({ usuarioAlvoEhProprietario: false }).permitido).toBe(true);
  });

  it("so o proprio proprietario pode mudar o proprio cargo — outro admin e bloqueado", () => {
    const resultado = podeAlterarCargoDoUsuario({
      autorUsuarioCentralId: "outro-admin",
      usuarioAlvoCentralId: "dono",
      usuarioAlvoEhProprietario: true,
    });
    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) {
      expect(resultado.motivo).toContain("responsável pela loja");
    }
  });

  it("o proprietario pode mudar o proprio cargo — excecao a regra geral de 'ninguem edita o proprio'", () => {
    const resultado = podeAlterarCargoDoUsuario({
      autorUsuarioCentralId: "dono",
      usuarioAlvoCentralId: "dono",
      usuarioAlvoEhProprietario: true,
    });
    expect(resultado.permitido).toBe(true);
  });

  it("pra usuario que NAO e proprietario, continua valendo a regra geral (ninguem edita o proprio)", () => {
    const bloqueiaProprio = podeAlterarCargoDoUsuario({
      autorUsuarioCentralId: "u1",
      usuarioAlvoCentralId: "u1",
      usuarioAlvoEhProprietario: false,
    });
    expect(bloqueiaProprio.permitido).toBe(false);

    const permiteOutro = podeAlterarCargoDoUsuario({
      autorUsuarioCentralId: "u1",
      usuarioAlvoCentralId: "u2",
      usuarioAlvoEhProprietario: false,
    });
    expect(permiteOutro.permitido).toBe(true);
  });

  it("so o proprietario atual pode iniciar a transferencia de titularidade", () => {
    const bloqueado = podeTransferirPropriedade({
      autorUsuarioCentralId: "outro-admin",
      proprietarioAtualUsuarioCentralId: "dono",
    });
    expect(bloqueado.permitido).toBe(false);
    if (!bloqueado.permitido) {
      expect(bloqueado.motivo).toContain("Só a conta responsável pela loja");
    }

    const permitido = podeTransferirPropriedade({
      autorUsuarioCentralId: "dono",
      proprietarioAtualUsuarioCentralId: "dono",
    });
    expect(permitido.permitido).toBe(true);
  });

  it("bloqueia transferencia pra um alvo inelegivel (inativo ou sem configuracoes.usuarios)", () => {
    const inativo = podeReceberPropriedade({ usuarioAlvo: { ativo: false, possuiConfiguracoesUsuarios: true } });
    expect(inativo.permitido).toBe(false);

    const semPermissao = podeReceberPropriedade({ usuarioAlvo: { ativo: true, possuiConfiguracoesUsuarios: false } });
    expect(semPermissao.permitido).toBe(false);
  });

  it("permite transferencia pra um alvo ativo e com configuracoes.usuarios", () => {
    const resultado = podeReceberPropriedade({ usuarioAlvo: { ativo: true, possuiConfiguracoesUsuarios: true } });
    expect(resultado.permitido).toBe(true);
  });
});
