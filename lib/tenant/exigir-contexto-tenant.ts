import { exigirSessaoCentral } from "@/lib/auth/sessao-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { resolverConexaoTenant } from "@/lib/tenant/resolver-conexao-tenant";
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

  return {
    usuarioOperacional,
    usuarioCentralId: sessaoCentral.usuarioCentralId,
    empresaId: sessaoCentral.empresaId,
    empresaSlug: sessaoCentral.empresaSlug,
    tenantId: sessaoCentral.tenantId,
    tenantSlug: sessaoCentral.tenantSlug,
    connectionRef: sessaoCentral.connectionRef,
    prisma,
  };
}
