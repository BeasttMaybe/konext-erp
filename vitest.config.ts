import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Testes de dominio puro. Nao sobem Next, nao tocam banco e nao precisam de
 * variavel de ambiente: `lib/dominio/**` nao importa Prisma nem React.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
