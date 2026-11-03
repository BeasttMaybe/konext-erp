import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Config separada pros testes que precisam de um Postgres de verdade
 * (`verificacao/**\/*.spec.ts`). O `npm test` não os inclui: `vitest.config.ts`
 * só pega `lib/`, `components/` e `store/`.
 *
 * O alias de `@prisma/client` existe porque estes testes usam só o
 * construtor de SQL (`Prisma.sql`), que mora no runtime do cliente e não
 * depende de `prisma generate` — assim a verificação roda em qualquer máquina
 * que tenha um Postgres, inclusive onde o binário do Prisma não baixa.
 * Nenhum teste daqui abre conexão pelo Prisma; quem fala com o banco é `pg`.
 */
export default defineConfig({
  resolve: {
    // Lista, e não objeto: o alias do Prisma precisa de uma regex ANCORADA.
    // Como chave de objeto, "@prisma/client" casaria também com
    // "@prisma/client/runtime/client.js" — que é justamente o que o shim
    // importa, e o shim passaria a importar a si mesmo.
    alias: [
      {
        find: /^@prisma\/client$/,
        replacement: fileURLToPath(new URL("./verificacao/shim-prisma-sql.ts", import.meta.url)),
      },
      { find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["verificacao/**/*.spec.ts"],
  },
});
