import type { PrismaClient } from "@prisma/client";
import { obterPrismaTenantCacheado } from "./cache-prisma-tenant";

export function obterPrismaTenant(params: {
  tenantId: string;
  connectionString: string;
}): PrismaClient {
  return obterPrismaTenantCacheado(params);
}
