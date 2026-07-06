import { exigirSessao } from "@/lib/auth/sessao";
import { prismaCentral } from "@/lib/central/prisma-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { resolverConexaoTenant } from "@/lib/tenant/resolver-conexao-tenant";
import type { ContextoTenantServidor } from "@/types/tenant";

export async function exigirContextoTenant(): Promise<ContextoTenantServidor> {
  const usuarioOperacional = await exigirSessao();
  const emailNormalizado = usuarioOperacional.email.trim().toLowerCase();

  if (!emailNormalizado) {
    throw new Error("Usuario operacional autenticado sem e-mail valido.");
  }

  const usuariosCentrais = await prismaCentral.usuarioCentral.findMany({
    where: {
      email: {
        equals: emailNormalizado,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      ativo: true,
    },
  });

  if (usuariosCentrais.length === 0) {
    throw new Error("UsuarioCentral correspondente ao usuario operacional nao encontrado.");
  }

  if (usuariosCentrais.length > 1) {
    throw new Error("Mais de um UsuarioCentral encontrado para o e-mail operacional. Resolucao abortada.");
  }

  const usuarioCentral = usuariosCentrais[0];

  if (!usuarioCentral.ativo) {
    throw new Error("UsuarioCentral correspondente esta inativo.");
  }

  const vinculosAtivos = await prismaCentral.usuarioEmpresa.findMany({
    where: {
      usuarioId: usuarioCentral.id,
      ativo: true,
    },
    select: {
      empresaId: true,
      empresa: {
        select: {
          id: true,
          slug: true,
          status: true,
        },
      },
    },
  });

  if (vinculosAtivos.length === 0) {
    throw new Error("UsuarioCentral sem vinculo ativo com empresa.");
  }

  if (vinculosAtivos.length > 1) {
    throw new Error("UsuarioCentral possui multiplos vinculos ativos. Selecao de empresa ainda nao foi implementada.");
  }

  const vinculo = vinculosAtivos[0];

  if (vinculo.empresa.status !== "ATIVA") {
    throw new Error("Empresa vinculada ao UsuarioCentral nao esta ativa.");
  }

  const tenantsAtivos = await prismaCentral.tenant.findMany({
    where: {
      empresaId: vinculo.empresaId,
      status: "ATIVO",
    },
    select: {
      id: true,
      slug: true,
      connectionRef: true,
    },
  });

  if (tenantsAtivos.length === 0) {
    throw new Error("Empresa ativa sem tenant ativo configurado.");
  }

  if (tenantsAtivos.length > 1) {
    throw new Error("Empresa possui multiplos tenants ativos. Selecao de tenant ainda nao foi implementada.");
  }

  const tenant = tenantsAtivos[0];

  if (!tenant.connectionRef) {
    throw new Error("Tenant ativo sem connectionRef configurada.");
  }

  const connectionString = resolverConexaoTenant(tenant.connectionRef);
  const prisma = obterPrismaTenant({
    tenantId: tenant.id,
    connectionString,
  });

  return {
    usuarioOperacional: {
      id: usuarioOperacional.id,
      nome: usuarioOperacional.nome,
      email: usuarioOperacional.email,
      role: usuarioOperacional.role,
    },
    usuarioCentralId: usuarioCentral.id,
    empresaId: vinculo.empresa.id,
    empresaSlug: vinculo.empresa.slug,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    connectionRef: tenant.connectionRef,
    prisma,
  };
}
