export const ROTAS_TENANT_MIGRADO = [
  "/inicio",
  "/configuracoes",
  "/crm",
  "/estoque",
  "/financeiro",
  "/os",
  "/pdv",
  "/propostas",
  "/recibo",
  "/vendas",
] as const;

const ROTAS_TENANT_BLOQUEADAS = [
  "/financeiro/notas-fiscais",
] as const;

export function rotaPermitidaParaTenantMigrado(pathname: string): boolean {
  if (ROTAS_TENANT_BLOQUEADAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return false;
  }

  return ROTAS_TENANT_MIGRADO.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}
