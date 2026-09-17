import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string | undefined;
};

const PRISMA_SCHEMA_VERSION = "20260624-configuracao-os-garantias";

/**
 * Cliente legado ligado a DATABASE_URL (tenant principal).
 *
 * A resolucao e PREGUICOSA de proposito: importar este modulo nunca pode lancar.
 * O `throw` por variavel de ambiente ausente acontecia no escopo do modulo e
 * quebrava `next build` na etapa "Collecting page data" de /rastreio/[id], que e
 * o unico consumidor restante. Agora o erro so aparece no primeiro uso real.
 */
function obterConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL nao definida para inicializar o Prisma.");
  }

  return connectionString;
}

function criarPrismaClient(connectionString: string): PrismaClient {
  if (typeof WebSocket === "undefined") {
    neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
  }

  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function cacheEstaInvalido(
  clienteEmCache: PrismaClient | undefined,
  versaoEmCache: string | undefined
): boolean {
  if (!clienteEmCache) {
    return true;
  }

  const delegates = clienteEmCache as unknown as Record<string, unknown>;
  const faltamDelegatesDeMetas =
    !("meta" in delegates) ||
    !("historicoMeta" in delegates) ||
    !("itemChecklistMeta" in delegates);

  return faltamDelegatesDeMetas || versaoEmCache !== PRISMA_SCHEMA_VERSION;
}

let clienteResolvido: PrismaClient | undefined;

/**
 * Resolve (e memoriza) o cliente legado. Lanca apenas aqui, no primeiro uso.
 */
export function obterPrisma(): PrismaClient {
  if (clienteResolvido) {
    return clienteResolvido;
  }

  const clienteEmCache = globalForPrisma.prisma;

  if (clienteEmCache && !cacheEstaInvalido(clienteEmCache, globalForPrisma.prismaSchemaVersion)) {
    clienteResolvido = clienteEmCache;
    return clienteResolvido;
  }

  clienteResolvido = criarPrismaClient(obterConnectionString());

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = clienteResolvido;
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  }

  return clienteResolvido;
}

type AlvoIndexavel = Record<string | symbol, unknown>;

const manipuladorPreguicoso: ProxyHandler<PrismaClient> = {
  get(_alvo, propriedade) {
    const cliente = obterPrisma();
    const valor = (cliente as unknown as AlvoIndexavel)[propriedade];

    return typeof valor === "function"
      ? (valor as (...argumentos: unknown[]) => unknown).bind(cliente)
      : valor;
  },
  set(_alvo, propriedade, valor) {
    (obterPrisma() as unknown as AlvoIndexavel)[propriedade] = valor;
    return true;
  },
  has(_alvo, propriedade) {
    return propriedade in (obterPrisma() as unknown as AlvoIndexavel);
  },
  ownKeys() {
    return Reflect.ownKeys(obterPrisma() as unknown as object);
  },
  getOwnPropertyDescriptor(_alvo, propriedade) {
    const descritor = Reflect.getOwnPropertyDescriptor(
      obterPrisma() as unknown as object,
      propriedade
    );

    // O alvo do Proxy e um objeto vazio e extensivel: para nao violar as
    // invariantes, toda propriedade delegada precisa ser reportada configuravel.
    return descritor ? { ...descritor, configurable: true } : undefined;
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(obterPrisma() as unknown as object);
  },
};

/**
 * Export compativel com o codigo existente (`import { prisma } from "@/lib/prisma"`).
 * Qualquer acesso a propriedade dispara `obterPrisma()`; o import em si e inerte.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, manipuladorPreguicoso);
