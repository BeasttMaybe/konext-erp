export const ROTAS_TENANT_MIGRADO = [
  "/inicio",
  "/configuracoes",
  "/crm",
  "/estoque",
  "/os",
  "/propostas",
] as const;

export function rotaPermitidaParaTenantMigrado(pathname: string): boolean {
  return ROTAS_TENANT_MIGRADO.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}
