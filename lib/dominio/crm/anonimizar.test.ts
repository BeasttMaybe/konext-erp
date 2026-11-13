import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DADOS_DO_CLIENTE_ANONIMIZADO } from "./anonimizar";

describe("anonimizar cliente", () => {
  it("cobre todo campo de texto do Cliente (um campo novo de dado pessoal nao pode escapar)", () => {
    const schema = readFileSync(path.resolve(__dirname, "../../../prisma/schema.prisma"), "utf8");
    const modelo = schema.slice(schema.indexOf("model Cliente {"));
    const corpo = modelo.slice(0, modelo.indexOf("\n}"));
    const camposDeTexto = [...corpo.matchAll(/^\s+(\w+)\s+String\??/gm)].map((m) => m[1]).filter((c) => c !== "id");
    expect(camposDeTexto.length).toBeGreaterThan(5);
    for (const campo of camposDeTexto) expect(Object.keys(DADOS_DO_CLIENTE_ANONIMIZADO), campo).toContain(campo);
  });
});
