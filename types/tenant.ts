import type { PrismaClient } from "@prisma/client";
import type { PapelEmpresa } from "@/lib/auth/permissoes";

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
  /**
   * Papel do vinculo UsuarioEmpresa no banco CENTRAL (ADMIN/GESTOR/USUARIO).
   *
   * Existe separado de `usuarioOperacional.role` de proposito: aquele campo
   * reflete `Usuario.role` do banco do TENANT (ADMIN/OPERADOR/TECNICO) quando
   * ha correspondencia por e-mail, e so cai para o papel central quando nao ha
   * usuario operacional mapeado. Sao dois vocabularios diferentes que nunca
   * deveriam ser misturados para autorizacao (AUDIT_REPORT F-01, §7.5).
   * Toda decisao de permissao usa `papelEmpresa`, nunca `usuarioOperacional.role`.
   */
  papelEmpresa: PapelEmpresa;
};

export type ContextoTenantServidor = ContextoTenantSeguro & {
  prisma: PrismaClient;
};
