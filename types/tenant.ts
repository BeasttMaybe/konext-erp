import type { PrismaClient } from "@prisma/client";

export type UsuarioOperacionalTenant = {
  id: string;
  nome: string;
  email: string;
  role: string;
};

export type ContextoTenantSeguro = {
  usuarioOperacional: UsuarioOperacionalTenant;
  usuarioCentralId: string;
  empresaId: string;
  empresaSlug: string;
  tenantId: string;
  tenantSlug: string;
  connectionRef: string;
};

export type ContextoTenantServidor = ContextoTenantSeguro & {
  prisma: PrismaClient;
};
