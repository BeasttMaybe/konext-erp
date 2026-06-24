import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL nao definida para inicializar o Prisma.");
}

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

const adapter = new PrismaNeon({ connectionString });

function criarPrismaClient() {
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const prismaEmCache = globalForPrisma.prisma;
const cacheInvalidoParaMetas =
  !!prismaEmCache &&
  (
    !("meta" in (prismaEmCache as unknown as Record<string, unknown>)) ||
    !("historicoMeta" in (prismaEmCache as unknown as Record<string, unknown>)) ||
    !("itemChecklistMeta" in (prismaEmCache as unknown as Record<string, unknown>))
  );

export const prisma =
  !prismaEmCache || cacheInvalidoParaMetas
    ? criarPrismaClient()
    : prismaEmCache;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
