import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";

// O pacote `ws` é 100% Node.js e usa __dirname internamente para localizar
// addons nativos — ele JAMAIS pode ser um import estático de top-level, pois
// vaza para qualquer bundle que inclua este módulo (inclusive o Edge Runtime).
//
// Na Vercel (Node.js 18+) e em qualquer runtime moderno, o WebSocket global
// já existe de forma nativa. O polyfill só é necessário em desenvolvimento local
// com versões antigas do Node.js que não possuem WebSocket built-in.
if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL nao definida para inicializar o Prisma.");
}

const adapter = new PrismaNeon({ connectionString });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
