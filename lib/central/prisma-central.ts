import { PrismaClient } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const globalForPrismaCentral = globalThis as unknown as {
  prismaCentral: PrismaClient | undefined;
  prismaCentralSchemaVersion: string | undefined;
};

const PRISMA_CENTRAL_SCHEMA_VERSION = "20260706-central-fundacao-multiempresa";

const centralConnectionString = process.env.CENTRAL_DATABASE_URL;

if (!centralConnectionString) {
  throw new Error("CENTRAL_DATABASE_URL nao definida para inicializar o Prisma central.");
}

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

const adapter = new PrismaNeon({ connectionString: centralConnectionString });

function criarPrismaCentralClient() {
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const prismaCentralEmCache = globalForPrismaCentral.prismaCentral;
const schemaVersionCentralEmCache = globalForPrismaCentral.prismaCentralSchemaVersion;
const cacheCentralInvalidoPorVersaoSchema =
  schemaVersionCentralEmCache !== PRISMA_CENTRAL_SCHEMA_VERSION;

export const prismaCentral =
  !prismaCentralEmCache || cacheCentralInvalidoPorVersaoSchema
    ? criarPrismaCentralClient()
    : prismaCentralEmCache;

if (process.env.NODE_ENV !== "production") {
  globalForPrismaCentral.prismaCentral = prismaCentral;
  globalForPrismaCentral.prismaCentralSchemaVersion = PRISMA_CENTRAL_SCHEMA_VERSION;
}
