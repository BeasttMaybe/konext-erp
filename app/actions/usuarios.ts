"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import {
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
