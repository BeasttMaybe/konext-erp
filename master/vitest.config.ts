import path from "node:path";
import { defineConfig } from "vitest/config";

// Proprio do master: sem ele, o vitest sobe ate o vitest.config.ts do ERP.
export default defineConfig({
  resolve: {
    alias: {
      "@erp": path.resolve(__dirname, ".."),
      "~": __dirname,
    },
  },
  test: { include: ["lib/**/*.test.ts"], environment: "node" },
});
