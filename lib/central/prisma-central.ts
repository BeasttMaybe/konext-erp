import { PrismaClient } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const globalForPrismaCentral = globalThis as unknown as {
  prismaCentral: PrismaClient | undefined;
  prismaCentralSchemaVersion: string | undefined;
};

const PRISMA_CENTRAL_SCHEMA_VERSION = "20260706-central-fundacao-multiempresa";

/**
 * Cliente do banco central (empresas, tenants, usuarios e sessoes).
 *
 * Mesma regra do cliente de tenant: a resolucao e PREGUICOSA para que importar
 * este modulo nunca lance. Sem isso, qualquer rota que alcance o modulo quebra o
 * build quando CENTRAL_DATABASE_URL nao esta definida no ambiente de build.
 */
function obterConnectionStringCentral(): string {
  const centralConnectionString = process.env.CENTRAL_DATABASE_URL;

  if (!centralConnectionString) {
    throw new Error("CENTRAL_DATABASE_URL nao definida para inicializar o Prisma central.");
  }

  return centralConnectionString;
}

function criarPrismaCentralClient(centralConnectionString: string): PrismaClient {
  if (typeof WebSocket === "undefined") {
    neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
  }

  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: centralConnectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

let clienteCentralResolvido: PrismaClient | undefined;

/**
 * Resolve (e memoriza) o cliente central. Lanca apenas aqui, no primeiro uso.
 */
export function obterPrismaCentral(): PrismaClient {
  if (clienteCentralResolvido) {
    return clienteCentralResolvido;
  }

  const clienteEmCache = globalForPrismaCentral.prismaCentral;
  const versaoEmCache = globalForPrismaCentral.prismaCentralSchemaVersion;

  if (clienteEmCache && versaoEmCache === PRISMA_CENTRAL_SCHEMA_VERSION) {
    clienteCentralResolvido = clienteEmCache;
    return clienteCentralResolvido;
  }

  clienteCentralResolvido = criarPrismaCentralClient(obterConnectionStringCentral());

  if (process.env.NODE_ENV !== "production") {
    globalForPrismaCentral.prismaCentral = clienteCentralResolvido;
    globalForPrismaCentral.prismaCentralSchemaVersion = PRISMA_CENTRAL_SCHEMA_VERSION;
  }

  return clienteCentralResolvido;
}

type AlvoIndexavel = Record<string | symbol, unknown>;

const manipuladorPreguicoso: ProxyHandler<PrismaClient> = {
  get(_alvo, propriedade) {
    const cliente = obterPrismaCentral();
    const valor = (cliente as unknown as AlvoIndexavel)[propriedade];

    return typeof valor === "function"
      ? (valor as (...argumentos: unknown[]) => unknown).bind(cliente)
      : valor;
  },
  set(_alvo, propriedade, valor) {
    (obterPrismaCentral() as unknown as AlvoIndexavel)[propriedade] = valor;
    return true;
  },
  has(_alvo, propriedade) {
    return propriedade in (obterPrismaCentral() as unknown as AlvoIndexavel);
  },
  ownKeys() {
    return Reflect.ownKeys(obterPrismaCentral() as unknown as object);
  },
  getOwnPropertyDescriptor(_alvo, propriedade) {
    const descritor = Reflect.getOwnPropertyDescriptor(
      obterPrismaCentral() as unknown as object,
      propriedade
    );

    // O alvo do Proxy e um objeto vazio e extensivel: para nao violar as
    // invariantes, toda propriedade delegada precisa ser reportada configuravel.
    return descritor ? { ...descritor, configurable: true } : undefined;
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(obterPrismaCentral() as unknown as object);
  },
};

/**
 * Export compativel com o codigo existente
 * (`import { prismaCentral } from "@/lib/central/prisma-central"`).
 */
export const prismaCentral: PrismaClient = new Proxy({} as PrismaClient, manipuladorPreguicoso);
