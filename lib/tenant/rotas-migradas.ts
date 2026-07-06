export const ROTAS_TENANT_MIGRADO = ["/inicio", "/configuracoes"] as const;

export function rotaPermitidaParaTenantMigrado(pathname: string): boolean {
  return ROTAS_TENANT_MIGRADO.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}
