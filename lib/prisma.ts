import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string | undefined;
};

const PRISMA_SCHEMA_VERSION = "20260624-configuracao-os-garantias";

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
const schemaVersionEmCache = globalForPrisma.prismaSchemaVersion;
const cacheInvalidoParaMetas =
  !!prismaEmCache &&
  (
    !("meta" in (prismaEmCache as unknown as Record<string, unknown>)) ||
    !("historicoMeta" in (prismaEmCache as unknown as Record<string, unknown>)) ||
    !("itemChecklistMeta" in (prismaEmCache as unknown as Record<string, unknown>))
  );
const cacheInvalidoPorVersaoSchema = schemaVersionEmCache !== PRISMA_SCHEMA_VERSION;

export const prisma =
  !prismaEmCache || cacheInvalidoParaMetas || cacheInvalidoPorVersaoSchema
    ? criarPrismaClient()
    : prismaEmCache;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
}
