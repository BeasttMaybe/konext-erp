import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CORES_DO_APP } from "./cores-do-app";

describe("cores do app instalavel", () => {
  const css = readFileSync(join(process.cwd(), "app/tokens-konext.css"), "utf8");
  const inicioDoClaro = css.indexOf(":root:not(.dark) {");
  const token = (bloco: string, nome: string) =>
    new RegExp(`--kx-${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(bloco)?.[1]?.toLowerCase();

  it("o fundo do escuro e o --kx-fundo do tema escuro", () => {
    expect(CORES_DO_APP.fundoEscuro).toBe(token(css.slice(0, inicioDoClaro), "fundo"));
  });

  it("o fundo do claro e o --kx-fundo do tema claro", () => {
    expect(CORES_DO_APP.fundoClaro).toBe(token(css.slice(inicioDoClaro), "fundo"));
  });

  it("manifesto e layout usam estas constantes, e nao hex soltos", () => {
    for (const arquivo of ["app/manifest.ts", "app/layout.tsx"]) {
      const fonte = readFileSync(join(process.cwd(), arquivo), "utf8");
      expect(fonte).toContain("CORES_DO_APP.");
      expect(fonte).not.toMatch(/"#[0-9a-fA-F]{6}"/);
    }
  });
});
