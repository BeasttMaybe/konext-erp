import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

type PrismaTenantCacheEntry = {
  connectionFingerprint: string;
  prisma: PrismaClient;
};

const globalForPrismaTenant = globalThis as unknown as {
  prismaTenantCache: Map<string, PrismaTenantCacheEntry> | undefined;
};

function obterCacheTenant() {
  if (!globalForPrismaTenant.prismaTenantCache) {
    globalForPrismaTenant.prismaTenantCache = new Map<string, PrismaTenantCacheEntry>();
  }

  return globalForPrismaTenant.prismaTenantCache;
}

function criarFingerprintConexao(connectionString: string): string {
  return createHash("sha256").update(connectionString).digest("hex");
}

function criarPrismaTenant(connectionString: string) {
  if (typeof WebSocket === "undefined") {
    neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
  }

  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export function obterPrismaTenantCacheado(params: {
  tenantId: string;
  connectionString: string;
}): PrismaClient {
  const cache = obterCacheTenant();
  const connectionFingerprint = criarFingerprintConexao(params.connectionString);
  const existente = cache.get(params.tenantId);

  if (existente) {
    if (existente.connectionFingerprint !== connectionFingerprint) {
      throw new Error("Conexao resolvida para o tenant mudou durante a execucao. Cache bloqueado por seguranca.");
    }

    return existente.prisma;
  }

  const prisma = criarPrismaTenant(params.connectionString);
  cache.set(params.tenantId, {
    connectionFingerprint,
    prisma,
  });

  return prisma;
}
