import "server-only";

import { PrismaClient } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

/**
 * Banco CENTRAL do Konext — o mesmo que o ERP usa (lojas, usuarios, modulos,
 * erros). O master nao tem banco proprio e nunca abre o banco de uma loja.
 * CENTRAL_DATABASE_URL e a mesma do projeto do ERP na Vercel.
 */
const globalComCliente = globalThis as unknown as { prismaCentralMaster?: PrismaClient };

function criar(): PrismaClient {
  const url = process.env.CENTRAL_DATABASE_URL;
  if (!url) throw new Error("CENTRAL_DATABASE_URL nao definida no projeto master.");
  if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }), log: ["error"] });
}

export function central(): PrismaClient {
  globalComCliente.prismaCentralMaster ??= criar();
  return globalComCliente.prismaCentralMaster;
}
