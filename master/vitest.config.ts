import { defineConfig } from "vitest/config";

// Proprio do master: sem ele, o vitest sobe ate o vitest.config.ts do ERP.
export default defineConfig({
  test: { include: ["lib/**/*.test.ts"], environment: "node" },
});
