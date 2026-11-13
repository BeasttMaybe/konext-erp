// node scripts/provisionamento/aplicar-migracoes-da-loja.mjs
// Aplica as migrations da loja (prisma/migrations) no banco de
// BANCO_DA_LOJA_URL com o MESMO codigo que o master usa ao criar uma loja
// (lib/provisionamento/migracoes-da-loja.ts). Usado pelo CI para provar que o
// resultado e identico ao `prisma migrate deploy`.
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { aplicarMigracoes, listarMigracoes } from "../../lib/provisionamento/migracoes-da-loja.ts";

const url = process.env.BANCO_DA_LOJA_URL;
if (!url) {
  console.error("BANCO_DA_LOJA_URL nao definida.");
  process.exit(1);
}
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
try {
  const r = await aplicarMigracoes((sql, p) => cliente.query(sql, p), listarMigracoes(path.join(raiz, "prisma/migrations")));
  console.log(`[migracoes-da-loja] aplicadas ${r.aplicadas.length}, ja estavam ${r.jaEstavam}, ultima ${r.ultima}`);
} finally {
  await cliente.end();
}
