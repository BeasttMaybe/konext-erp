import type { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Inicializa o cliente Prisma usando require() dinâmico em vez de imports
 * estáticos de top-level.
 *
 * POR QUE ISSO IMPORTA:
 * Imports estáticos (`import { PrismaClient } from "@prisma/client"`) executam
 * o código de inicialização do @prisma/client NO MOMENTO EM QUE O MÓDULO É
 * CARREGADO. O @prisma/client gerado contém `path.join(__dirname, ...)` nesse
 * código de inicialização. Se este módulo for incluído acidentalmente no bundle
 * do Edge Runtime (middleware), ele crasharia com:
 *   ReferenceError: __dirname is not defined
 *
 * Com require() dinâmico dentro de uma função, esse código SÓ EXECUTA quando
 * a função é chamada — o que acontece apenas nos Server Actions (Node.js runtime),
 * nunca no Edge Runtime do middleware.
 */
function inicializarPrisma(): PrismaClient {
  /* eslint-disable @typescript-eslint/no-require-imports */

  // neonConfig pode ser configurado antes de qualquer query
  const { neonConfig } = require("@neondatabase/serverless");

  // WebSocket nativo está disponível no Node.js 18+ e na Vercel.
  // O polyfill `ws` só é necessário localmente em Node.js mais antigo.
  if (typeof WebSocket === "undefined") {
    neonConfig.webSocketConstructor = require("ws");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao definida para inicializar o Prisma.");
  }

  const { PrismaNeon } = require("@prisma/adapter-neon");
  const { PrismaClient: PrismaClientImpl } = require("@prisma/client");

  /* eslint-enable @typescript-eslint/no-require-imports */

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClientImpl({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }) as PrismaClient;
}

function obterPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = inicializarPrisma();
  }
  return globalForPrisma.prisma;
}

/**
 * Cliente Prisma com inicialização lazy via Proxy.
 *
 * A API é 100% idêntica ao PrismaClient padrão — todos os Server Actions que
 * fazem `import { prisma } from "@/lib/prisma"` continuam funcionando sem
 * nenhuma alteração.
 *
 * O Proxy garante que NENHUM código do @prisma/client (que contém __dirname)
 * execute durante o carregamento do módulo. O código só roda quando uma
 * propriedade do cliente é acessada pela primeira vez — o que acontece
 * exclusivamente nos Server Actions (Node.js runtime), nunca no middleware.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const cliente = obterPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valor = (cliente as any)[prop];
    return typeof valor === "function"
      ? (valor as (...args: unknown[]) => unknown).bind(cliente)
      : valor;
  },
});
