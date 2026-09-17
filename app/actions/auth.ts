"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prismaCentral } from "@/lib/central/prisma-central";
import { COOKIE_SESSAO_LEGADA } from "@/lib/auth/cookies";
import { criarSessaoCentral, exigirSessaoCentral, revogarSessaoCentralAtual } from "@/lib/auth/sessao-central";
import { conferirSenha, gerarHashSenha, validarNovaSenha } from "@/lib/auth/senha";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { paraMensagemSegura } from "@/lib/erros";

type LoginState = {
  erro: string | null;
};

const ERRO_CREDENCIAIS = "Credenciais inválidas.";

type ResultadoLoginCentral =
  | { autenticado: true }
  | { autenticado: false };

/**
 * Fluxo unico de autenticacao para todos os usuarios:
 * e-mail + senha -> UsuarioCentral -> hash -> UsuarioEmpresa -> Empresa -> Tenant -> SessaoCentral.
 * Nao existe fallback para o banco operacional.
 */
async function autenticarCentral(email: string, senha: string): Promise<ResultadoLoginCentral> {
  const usuarioCentral = await prismaCentral.usuarioCentral.findUnique({
    where: { email },
    select: {
      id: true,
      senha: true,
      ativo: true,
    },
  });

  if (!usuarioCentral?.ativo || !usuarioCentral.senha) {
    return { autenticado: false };
  }

  const senhaConfere = await bcrypt.compare(senha, usuarioCentral.senha);

  if (!senhaConfere) {
    return { autenticado: false };
  }

  const vinculos = await prismaCentral.usuarioEmpresa.findMany({
    where: {
      usuarioId: usuarioCentral.id,
      ativo: true,
    },
    select: {
      role: true,
      empresa: {
        select: {
          id: true,
          slug: true,
          status: true,
        },
      },
    },
  });

  const vinculosAtivos = vinculos.filter((vinculo) => vinculo.empresa.status === "ATIVA");

  if (vinculosAtivos.length !== 1) {
    return { autenticado: false };
  }

  const vinculo = vinculosAtivos[0];
  const tenantsAtivos = await prismaCentral.tenant.findMany({
    where: {
      empresaId: vinculo.empresa.id,
      status: "ATIVO",
    },
    select: {
      id: true,
      slug: true,
      connectionRef: true,
    },
  });

  if (tenantsAtivos.length !== 1 || !tenantsAtivos[0].connectionRef) {
    return { autenticado: false };
  }

  const tenant = tenantsAtivos[0];

  await criarSessaoCentral({
    usuarioCentralId: usuarioCentral.id,
    empresaId: vinculo.empresa.id,
    tenantId: tenant.id,
    role: vinculo.role,
  });

  // Remove qualquer cookie legado residual: konext_session nao autentica mais.
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_SESSAO_LEGADA);

  return { autenticado: true };
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const resultado = await autenticarCentral(email, senha);

  if (!resultado.autenticado) {
    // Mensagem generica: nao revela existencia do e-mail.
    return { erro: ERRO_CREDENCIAIS };
  }

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  await revogarSessaoCentralAtual();
  // Limpeza do cookie legado mantida temporariamente por compatibilidade.
  cookieStore.delete(COOKIE_SESSAO_LEGADA);
  redirect("/login");
}

export type ResultadoAlterarSenha = { sucesso: true } | { sucesso: false; erro: string };

/**
 * Troca a senha do usuario logado (F-16 parcial). Opera no banco central —
 * `UsuarioCentral.senha` e a unica senha de login do sistema. Ao trocar,
 * revoga todas as OUTRAS sessoes ativas do usuario (mantem a sessao atual),
 * para que um eventual acesso indevido com a senha antiga seja derrubado.
 */
export async function alterarMinhaSenha(dados: {
  senhaAtual: string;
  novaSenha: string;
  confirmacao: string;
}): Promise<ResultadoAlterarSenha> {
  try {
    const sessao = await exigirSessaoCentral();

    if (dados.novaSenha !== dados.confirmacao) {
      return { sucesso: false, erro: "A confirmação não confere com a nova senha." };
    }

    const validacao = validarNovaSenha(dados.novaSenha);
    if (!validacao.valida) {
      return { sucesso: false, erro: validacao.motivo };
    }

    const usuario = await prismaCentral.usuarioCentral.findUnique({
      where: { id: sessao.usuarioCentralId },
      select: { id: true, senha: true },
    });

    if (!usuario?.senha) {
      return { sucesso: false, erro: "Não foi possível localizar seu usuário." };
    }

    const senhaAtualConfere = await conferirSenha(dados.senhaAtual, usuario.senha);
    if (!senhaAtualConfere) {
      return { sucesso: false, erro: "Senha atual incorreta." };
    }

    const novaSenhaIgualAtual = await conferirSenha(dados.novaSenha, usuario.senha);
    if (novaSenhaIgualAtual) {
      return { sucesso: false, erro: "A nova senha deve ser diferente da senha atual." };
    }

    const novoHash = await gerarHashSenha(dados.novaSenha);

    await prismaCentral.usuarioCentral.update({
      where: { id: usuario.id },
      data: { senha: novoHash },
    });

    await prismaCentral.sessaoCentral.updateMany({
      where: {
        usuarioCentralId: usuario.id,
        id: { not: sessao.id },
        revogadaEm: null,
      },
      data: { revogadaEm: new Date() },
    });

    // Auditoria vive no banco do tenant (nao ha LogAuditoria no banco
    // central nesta fase). Payload sem qualquer dado de senha.
    const contextoTenant = await exigirContextoTenant();
    await registrarLogAuditoria(
      contextoTenant.prisma,
      contextoAuditoriaDoUsuario(contextoTenant.usuarioOperacional, "app/actions/auth.ts:alterarMinhaSenha"),
      {
        acao: ACOES_AUDITORIA.ALTERAR_SENHA,
        entidade: ENTIDADES_AUDITORIA.USUARIO_CENTRAL,
        entidadeId: usuario.id,
      },
      { melhorEsforco: true }
    );

    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: paraMensagemSegura(error) };
  }
}
