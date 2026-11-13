"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import {
  podeConcederPermissoes,
  podeDesativarUsuario,
  podeReceberPropriedade,
  podeRemoverAcessoAdminDoUsuario,
  podeTransferirPropriedade,
} from "@/lib/auth/invariantes-cargos";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaCentralDoUsuario, registrarLogAuditoriaCentral } from "@/lib/auditoria-central";
import { prismaCentral } from "@/lib/central/prisma-central";
import { paraMensagemSegura } from "@/lib/erros";
import { listarUsuariosComAcessoAdmin } from "@/lib/auth/usuarios-com-acesso-admin";
import { permissoesEfetivasDoCargo } from "@/lib/auth/permissoes-efetivas-cargo";
import { mapearCargoParaRoleLegado } from "@/lib/auth/mapear-cargo-legado";
import type { Permissao } from "@/lib/auth/permissoes";
import { gerarHashSenha, validarNovaSenha } from "@/lib/auth/senha";
import { decidirNovaSenhaPeloAdmin } from "@/lib/auth/recuperacao-de-senha";
import { zerarFalhasDoEmail } from "@/lib/auth/tentativas-login";
import {
  decidirNovoUsuario,
  esquemaNovoUsuario,
  ROLE_DA_LOJA_PELO_ROLE_DA_EMPRESA,
  type DadosNovoUsuario,
} from "@/lib/auth/novo-usuario";

export type UsuarioListado = {
  usuarioEmpresaId: string;
  usuarioCentralId: string;
  nome: string;
  email: string;
  cargoId: string | null;
  cargoNome: string;
  ativo: boolean;
  ultimoAcessoEm: string | null;
  /** Verdadeiro quando esta linha é a do próprio usuário logado — a UI usa isso pra travar a edição do próprio cargo. */
  souEu: boolean;
  /** Verdadeiro pra a conta responsável pela loja (Empresa.proprietarioUsuarioEmpresaId, Fase 1D-3). */
  ehProprietario: boolean;
  /** Efetivamente tem configuracoes.usuarios — usado pra montar a lista de candidatos a nova titularidade. */
  possuiConfiguracoesUsuarios: boolean;
};

export async function listarUsuariosDaEmpresa(): Promise<
  { sucesso: true; dados: UsuarioListado[] } | { sucesso: false; erro: string }
> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const [empresa, vinculos] = await Promise.all([
      prismaCentral.empresa.findUnique({
        where: { id: contexto.empresaId },
        select: { proprietarioUsuarioEmpresaId: true },
      }),
      prismaCentral.usuarioEmpresa.findMany({
        where: { empresaId: contexto.empresaId },
        select: {
          id: true,
          usuarioId: true,
          ativo: true,
          cargoId: true,
          cargo: { select: { nome: true, fixo: true, permissoes: { select: { permissao: true } } } },
          usuario: { select: { nome: true, email: true } },
        },
        orderBy: { usuario: { nome: "asc" } },
      }),
    ]);

    const idsUsuarios = vinculos.map((vinculo) => vinculo.usuarioId);
    const ultimosAcessos =
      idsUsuarios.length > 0
        ? await prismaCentral.sessaoCentral.groupBy({
            by: ["usuarioCentralId"],
            where: { usuarioCentralId: { in: idsUsuarios } },
            _max: { ultimoUsoEm: true },
          })
        : [];
    const ultimoAcessoPorUsuario = new Map(
      ultimosAcessos.map((linha) => [linha.usuarioCentralId, linha._max.ultimoUsoEm])
    );

    const dados: UsuarioListado[] = vinculos.map((vinculo) => ({
      usuarioEmpresaId: vinculo.id,
      usuarioCentralId: vinculo.usuarioId,
      nome: vinculo.usuario.nome,
      email: vinculo.usuario.email,
      cargoId: vinculo.cargoId,
      cargoNome: vinculo.cargo?.nome ?? "Sem cargo atribuído",
      ativo: vinculo.ativo,
      ultimoAcessoEm: ultimoAcessoPorUsuario.get(vinculo.usuarioId)?.toISOString() ?? null,
      souEu: vinculo.usuarioId === contexto.usuarioCentralId,
      ehProprietario: vinculo.id === empresa?.proprietarioUsuarioEmpresaId,
      possuiConfiguracoesUsuarios: vinculo.cargo
        ? permissoesEfetivasDoCargo(vinculo.cargo).includes("configuracoes.usuarios")
        : false,
    }));

    return { sucesso: true, dados };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

const schemaAlvoUsuario = z.object({
  usuarioEmpresaId: z.string().min(1, "Informe o usuário."),
});

export type ResultadoAcaoUsuario = { sucesso: true } | { sucesso: false; erro: string };

export async function desativarUsuario(
  input: z.infer<typeof schemaAlvoUsuario>
): Promise<ResultadoAcaoUsuario> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaAlvoUsuario.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const [empresa, vinculo] = await Promise.all([
      prismaCentral.empresa.findUnique({
        where: { id: contexto.empresaId },
        select: { proprietarioUsuarioEmpresaId: true },
      }),
      prismaCentral.usuarioEmpresa.findUnique({
        where: { id: analise.data.usuarioEmpresaId },
        select: { id: true, usuarioId: true, empresaId: true, ativo: true },
      }),
    ]);
    if (!vinculo || vinculo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Usuário não encontrado nesta empresa." };
    }
    if (!vinculo.ativo) {
      return { sucesso: false, erro: "Este usuário já está desativado." };
    }

    const checagemProprietario = podeDesativarUsuario({
      usuarioAlvoEhProprietario: vinculo.id === empresa?.proprietarioUsuarioEmpresaId,
    });
    if (!checagemProprietario.permitido) {
      return { sucesso: false, erro: checagemProprietario.motivo };
    }

    const todosUsuarios = await listarUsuariosComAcessoAdmin(contexto.empresaId);
    const checagemAdmin = podeRemoverAcessoAdminDoUsuario(todosUsuarios, vinculo.usuarioId);
    if (!checagemAdmin.permitido) {
      return { sucesso: false, erro: checagemAdmin.motivo };
    }

    await prismaCentral.$transaction(async (tx) => {
      await tx.usuarioEmpresa.update({ where: { id: vinculo.id }, data: { ativo: false } });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario({ id: contexto.usuarioCentralId }, contexto.empresaId, "app/actions/usuarios.ts:desativarUsuario"),
        {
          acao: ACOES_AUDITORIA.DESATIVAR_USUARIO,
          entidade: ENTIDADES_AUDITORIA.USUARIO_EMPRESA,
          entidadeId: vinculo.id,
          dadosAntes: { ativo: true },
          dadosDepois: { ativo: false },
        }
      );
    });

    revalidatePath("/configuracoes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function reativarUsuario(
  input: z.infer<typeof schemaAlvoUsuario>
): Promise<ResultadoAcaoUsuario> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaAlvoUsuario.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const vinculo = await prismaCentral.usuarioEmpresa.findUnique({
      where: { id: analise.data.usuarioEmpresaId },
      select: { id: true, empresaId: true, ativo: true },
    });
    if (!vinculo || vinculo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Usuário não encontrado nesta empresa." };
    }
    if (vinculo.ativo) {
      return { sucesso: false, erro: "Este usuário já está ativo." };
    }

    await prismaCentral.$transaction(async (tx) => {
      await tx.usuarioEmpresa.update({ where: { id: vinculo.id }, data: { ativo: true } });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario({ id: contexto.usuarioCentralId }, contexto.empresaId, "app/actions/usuarios.ts:reativarUsuario"),
        {
          acao: ACOES_AUDITORIA.REATIVAR_USUARIO,
          entidade: ENTIDADES_AUDITORIA.USUARIO_EMPRESA,
          entidadeId: vinculo.id,
          dadosAntes: { ativo: false },
          dadosDepois: { ativo: true },
        }
      );
    });

    revalidatePath("/configuracoes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

const schemaTransferirPropriedade = z.object({
  novoUsuarioEmpresaId: z.string().min(1, "Informe o novo responsável."),
});

/**
 * So a conta responsavel pela loja pode chamar isto (podeTransferirPropriedade).
 * O alvo precisa ser um usuario ATIVO desta empresa com configuracoes.usuarios
 * (podeReceberPropriedade) — sem isso, a empresa ficaria com um "dono" que nem
 * pode gerenciar usuarios, o que nao faz sentido.
 */
export async function transferirPropriedade(
  input: z.infer<typeof schemaTransferirPropriedade>
): Promise<ResultadoAcaoUsuario> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaTransferirPropriedade.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const empresa = await prismaCentral.empresa.findUnique({
      where: { id: contexto.empresaId },
      select: { id: true, proprietarioUsuarioEmpresaId: true },
    });
    if (!empresa) {
      return { sucesso: false, erro: "Empresa não encontrada." };
    }

    const proprietarioAtual = empresa.proprietarioUsuarioEmpresaId
      ? await prismaCentral.usuarioEmpresa.findUnique({
          where: { id: empresa.proprietarioUsuarioEmpresaId },
          select: { usuarioId: true },
        })
      : null;

    const checagemAutor = podeTransferirPropriedade({
      autorUsuarioCentralId: contexto.usuarioCentralId,
      proprietarioAtualUsuarioCentralId: proprietarioAtual?.usuarioId ?? null,
    });
    if (!checagemAutor.permitido) {
      return { sucesso: false, erro: checagemAutor.motivo };
    }

    const alvo = await prismaCentral.usuarioEmpresa.findUnique({
      where: { id: analise.data.novoUsuarioEmpresaId },
      select: {
        id: true,
        empresaId: true,
        ativo: true,
        cargo: { select: { fixo: true, permissoes: { select: { permissao: true } } } },
      },
    });
    if (!alvo || alvo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Usuário não encontrado nesta empresa." };
    }

    if (alvo.id === empresa.proprietarioUsuarioEmpresaId) {
      return { sucesso: false, erro: "Este usuário já é o responsável pela loja." };
    }

    const checagemAlvo = podeReceberPropriedade({
      usuarioAlvo: {
        ativo: alvo.ativo,
        possuiConfiguracoesUsuarios: alvo.cargo
          ? permissoesEfetivasDoCargo(alvo.cargo).includes("configuracoes.usuarios")
          : false,
      },
    });
    if (!checagemAlvo.permitido) {
      return { sucesso: false, erro: checagemAlvo.motivo };
    }

    await prismaCentral.$transaction(async (tx) => {
      await tx.empresa.update({
        where: { id: empresa.id },
        data: { proprietarioUsuarioEmpresaId: alvo.id },
      });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario(
          { id: contexto.usuarioCentralId },
          contexto.empresaId,
          "app/actions/usuarios.ts:transferirPropriedade"
        ),
        {
          acao: ACOES_AUDITORIA.TRANSFERIR_PROPRIEDADE,
          entidade: ENTIDADES_AUDITORIA.EMPRESA,
          entidadeId: empresa.id,
          dadosAntes: { proprietarioUsuarioEmpresaId: empresa.proprietarioUsuarioEmpresaId },
          dadosDepois: { proprietarioUsuarioEmpresaId: alvo.id },
        }
      );
    });

    revalidatePath("/configuracoes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export type ResultadoCriarUsuario =
  | { sucesso: true; contaJaExistia: boolean }
  | { sucesso: false; erro: string };

/**
 * Cadastra uma pessoa na loja: conta central (login), vinculo com a empresa
 * (cargo) e o usuario operacional no banco da loja (quem aparece como autor
 * de OS, caixa, fotos).
 *
 * ORDEM DAS ESCRITAS
 *
 * Sao dois bancos, sem transacao entre eles. O banco da LOJA e gravado
 * primeiro, por e-mail e de forma idempotente: se o central falhar depois,
 * sobra so uma linha inerte na loja (sem vinculo ninguem entra com ela), e
 * cadastrar de novo a reaproveita. Na ordem inversa, uma falha deixaria
 * alguem conseguindo entrar no sistema sem usuario operacional — e cada OS
 * que ele abrisse ficaria sem autor.
 */
export async function criarUsuario(input: DadosNovoUsuario): Promise<ResultadoCriarUsuario> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = esquemaNovoUsuario.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const dados = analise.data;

    const [cargo, contaExistente] = await Promise.all([
      prismaCentral.cargo.findUnique({
        where: { id: dados.cargoId },
        select: { id: true, empresaId: true, fixo: true, arquivadoEm: true, permissoes: { select: { permissao: true } } },
      }),
      prismaCentral.usuarioCentral.findUnique({
        where: { email: dados.email },
        select: {
          id: true,
          nome: true,
          empresas: { where: { empresaId: contexto.empresaId }, select: { ativo: true } },
        },
      }),
    ]);

    if (!cargo || cargo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Cargo não encontrado." };
    }
    if (cargo.arquivadoEm) {
      return { sucesso: false, erro: "Este cargo está arquivado e não pode ser atribuído a ninguém." };
    }

    // Cadastrar alguem num cargo e conceder as permissoes dele: mesma regra
    // de "ninguem concede o que nao tem" da troca de cargo.
    const permissoesDoCargo = permissoesEfetivasDoCargo(cargo);
    const checagemConcessao = podeConcederPermissoes({
      permissoesDoAutor: contexto.permissoes ?? new Set<Permissao>(),
      permissoesAlvo: permissoesDoCargo,
    });
    if (!checagemConcessao.permitido) {
      return { sucesso: false, erro: checagemConcessao.motivo };
    }

    const decisao = decidirNovoUsuario({
      contaExiste: Boolean(contaExistente),
      vinculoNestaLoja: contaExistente?.empresas[0] ?? null,
    });
    if (decisao.tipo === "recusar") {
      return { sucesso: false, erro: decisao.motivo };
    }

    const roleDaEmpresa = mapearCargoParaRoleLegado({ fixo: cargo.fixo, permissoes: new Set(permissoesDoCargo) });
    const roleDaLoja = ROLE_DA_LOJA_PELO_ROLE_DA_EMPRESA[roleDaEmpresa];
    // Conta existente mantem a senha dela; o hash so e gerado para conta nova.
    const senhaHash = await gerarHashSenha(dados.senhaInicial);
    const nome = contaExistente?.nome ?? dados.nome;

    // 1) Banco da loja, por e-mail. O id segue o da conta central quando ela
    //    ja existe (convencao do provisionamento); conta nova ganha o id aqui
    //    e o reaproveita no central, para os dois baterem.
    const usuarioDaLoja = await contexto.prisma.usuario.upsert({
      where: { email: dados.email },
      update: { nome, role: roleDaLoja },
      create: {
        ...(contaExistente ? { id: contaExistente.id } : {}),
        nome,
        email: dados.email,
        senha: senhaHash,
        role: roleDaLoja,
      },
      select: { id: true },
    });

    // 2) Banco central: conta (se nova) + vinculo com cargo, e o registro.
    await prismaCentral.$transaction(async (tx) => {
      const contaId =
        contaExistente?.id ??
        (
          await tx.usuarioCentral.create({
            data: { id: usuarioDaLoja.id, nome, email: dados.email, senha: senhaHash, ativo: true },
            select: { id: true },
          })
        ).id;

      const vinculo = await tx.usuarioEmpresa.create({
        data: {
          usuarioId: contaId,
          empresaId: contexto.empresaId,
          cargoId: cargo.id,
          role: roleDaEmpresa,
          ativo: true,
        },
        select: { id: true },
      });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario({ id: contexto.usuarioCentralId }, contexto.empresaId, "app/actions/usuarios.ts:criarUsuario"),
        {
          acao: ACOES_AUDITORIA.CRIAR_USUARIO,
          entidade: ENTIDADES_AUDITORIA.USUARIO_EMPRESA,
          entidadeId: vinculo.id,
          dadosAntes: null,
          // Nunca a senha, nem o hash.
          dadosDepois: { email: dados.email, nome, cargoId: cargo.id, contaJaExistia: Boolean(contaExistente) },
        }
      );
    });

    revalidatePath("/configuracoes");
    return { sucesso: true, contaJaExistia: Boolean(contaExistente) };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

const schemaNovaSenhaDoUsuario = z.object({
  usuarioEmpresaId: z.string().min(1, "Informe o usuário."),
  novaSenha: z.string(),
});

/**
 * O administrador gera uma senha nova para alguem da loja que esqueceu a
 * dele. Regras em decidirNovaSenhaPeloAdmin: nunca a propria (Meu perfil),
 * nunca a do responsavel pela loja, nunca conta usada tambem em outra loja
 * (a senha e da conta, e valeria la tambem).
 *
 * Derruba todas as sessoes abertas da pessoa e zera o limite de tentativas.
 * A senha nova so volta para a tela que a gerou; a auditoria guarda que
 * houve a troca, nunca o valor.
 */
export async function gerarNovaSenhaDoUsuario(
  input: z.infer<typeof schemaNovaSenhaDoUsuario>
): Promise<ResultadoAcaoUsuario> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaNovaSenhaDoUsuario.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const validacao = validarNovaSenha(analise.data.novaSenha);
    if (!validacao.valida) {
      return { sucesso: false, erro: validacao.motivo.replace("A nova senha", "A senha") };
    }

    const [empresa, vinculo] = await Promise.all([
      prismaCentral.empresa.findUnique({
        where: { id: contexto.empresaId },
        select: { proprietarioUsuarioEmpresaId: true },
      }),
      prismaCentral.usuarioEmpresa.findUnique({
        where: { id: analise.data.usuarioEmpresaId },
        select: { id: true, usuarioId: true, empresaId: true, ativo: true, usuario: { select: { email: true } } },
      }),
    ]);
    if (!vinculo || vinculo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Usuário não encontrado nesta empresa." };
    }

    const outrasLojas = await prismaCentral.usuarioEmpresa.count({
      where: { usuarioId: vinculo.usuarioId, empresaId: { not: contexto.empresaId } },
    });

    const decisao = decidirNovaSenhaPeloAdmin({
      ehVoceMesmo: vinculo.usuarioId === contexto.usuarioCentralId,
      ehResponsavelPelaLoja: vinculo.id === empresa?.proprietarioUsuarioEmpresaId,
      ativo: vinculo.ativo,
      usadoEmOutraLoja: outrasLojas > 0,
    });
    if (!decisao.permitido) {
      return { sucesso: false, erro: decisao.motivo };
    }

    const novoHash = await gerarHashSenha(analise.data.novaSenha);

    await prismaCentral.$transaction(async (tx) => {
      await tx.usuarioCentral.update({ where: { id: vinculo.usuarioId }, data: { senha: novoHash }, select: { id: true } });
      await tx.sessaoCentral.updateMany({
        where: { usuarioCentralId: vinculo.usuarioId, revogadaEm: null },
        data: { revogadaEm: new Date() },
      });
      await tx.tokenRecuperacaoSenha.updateMany({
        where: { usuarioId: vinculo.usuarioId, usadoEm: null },
        data: { usadoEm: new Date() },
      });
      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario(
          { id: contexto.usuarioCentralId },
          contexto.empresaId,
          "app/actions/usuarios.ts:gerarNovaSenhaDoUsuario"
        ),
        {
          acao: ACOES_AUDITORIA.GERAR_NOVA_SENHA_USUARIO,
          entidade: ENTIDADES_AUDITORIA.USUARIO_EMPRESA,
          entidadeId: vinculo.id,
          // Nunca a senha, nem o hash.
          dadosDepois: { sessoesEncerradas: true },
        }
      );
    });

    await zerarFalhasDoEmail(vinculo.usuario.email);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}
