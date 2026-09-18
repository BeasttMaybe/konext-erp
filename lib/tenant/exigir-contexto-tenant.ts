import { exigirSessaoCentral } from "@/lib/auth/sessao-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { resolverConexaoTenant } from "@/lib/tenant/resolver-conexao-tenant";
import { ehPapelEmpresa, type PapelEmpresa } from "@/lib/auth/permissoes";
import { resolverPermissoesEfetivas } from "@/lib/auth/resolver-permissoes";
import type { ContextoTenantServidor } from "@/types/tenant";

type UsuarioOperacionalMapeado = {
  id: string;
  nome: string;
  email: string;
  role: string;
};

/**
 * Mapeamento read-only do usuario central para um Usuario operacional
 * pre-existente no banco do tenant (por e-mail). Nunca cria usuario.
 * Sem correspondencia local, o id fica vazio e fluxos tratam como null.
 *
 * O `role` devolvido aqui e o `Usuario.role` do TENANT (ADMIN/OPERADOR/TECNICO)
 * quando ha correspondencia — e so por isso NUNCA deve ser usado para
 * autorizacao. Autorizacao usa exclusivamente `papelEmpresa` (ver abaixo).
 */
async function mapearUsuarioOperacional(
  prisma: ContextoTenantServidor["prisma"],
  email: string,
  fallback: { nome: string; role: string }
): Promise<UsuarioOperacionalMapeado> {
  const semMapeamento: UsuarioOperacionalMapeado = {
    id: "",
    nome: fallback.nome,
    email,
    role: fallback.role,
  };

  const emailNormalizado = email.trim().toLowerCase();

  if (!emailNormalizado) {
    return semMapeamento;
  }

  try {
    const usuario = await prisma.usuario.findFirst({
      where: {
        email: {
          equals: emailNormalizado,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
      },
    });

    if (!usuario) {
      return semMapeamento;
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: String(usuario.role),
    };
  } catch {
    return semMapeamento;
  }
}

/**
 * `SessaoCentral.role` vem do enum central `RoleEmpresa` — sempre um dos tres
 * valores. O fallback so existe para blindar contra um valor corrompido/legado
 * chegando do banco; nesse caso tratamos como o papel menos privilegiado.
 */
function normalizarPapelEmpresa(role: string): PapelEmpresa {
  return ehPapelEmpresa(role) ? role : "USUARIO";
}

export async function exigirContextoTenant(): Promise<ContextoTenantServidor> {
  const sessaoCentral = await exigirSessaoCentral();

  const connectionString = resolverConexaoTenant(sessaoCentral.connectionRef);
  const prisma = obterPrismaTenant({
    tenantId: sessaoCentral.tenantId,
    connectionString,
  });

  const usuarioOperacional = await mapearUsuarioOperacional(prisma, sessaoCentral.usuarioEmail, {
    nome: sessaoCentral.usuarioNome,
    role: sessaoCentral.role,
  });

  const papelEmpresa = normalizarPapelEmpresa(sessaoCentral.role);

  // Resolvido do Cargo do usuario, uma vez por requisicao (Fase 1D-1) — ver
  // o comentario em lib/auth/resolver-permissoes.ts sobre por que isso
  // garante efeito imediato de qualquer mudanca de cargo/permissao, sem
  // relogar.
  const permissoes = await resolverPermissoesEfetivas(
    sessaoCentral.usuarioCentralId,
    sessaoCentral.empresaId,
    papelEmpresa
  );

  return {
    usuarioOperacional,
    usuarioCentralId: sessaoCentral.usuarioCentralId,
    empresaId: sessaoCentral.empresaId,
    empresaSlug: sessaoCentral.empresaSlug,
    tenantId: sessaoCentral.tenantId,
    tenantSlug: sessaoCentral.tenantSlug,
    connectionRef: sessaoCentral.connectionRef,
    // Direto da sessao central, nunca contaminado pelo Usuario.role do tenant.
    papelEmpresa,
    permissoes,
    prisma,
  };
}
