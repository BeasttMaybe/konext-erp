import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CLASSE_DO_DOCUMENTO_IMPRESSO,
  ESTILO_IMPRESSAO_A4,
  ESTILO_IMPRESSAO_TERMICA,
  SELETOR_DO_QUE_NAO_IMPRIME,
} from "./estilos-impressao";

const raiz = path.resolve(__dirname, "../../..");
const ler = (arquivo: string) => readFileSync(path.join(raiz, arquivo), "utf8");

/**
 * Guarda do defeito em que o cabecalho da OS (logo, numero, QR) e o do termo
 * de garantia sumiam na impressao: a regra que esconde a moldura do sistema
 * escondia tambem os `header`/`footer` do proprio documento.
 */
describe("o que some na impressao", () => {
  it("poupa tudo que esta dentro do documento", () => {
    expect(SELETOR_DO_QUE_NAO_IMPRIME).toContain(`:not(.${CLASSE_DO_DOCUMENTO_IMPRESSO} *)`);
  });

  it("os estilos usam o seletor compartilhado, sem a lista solta antiga", () => {
    for (const estilo of [ESTILO_IMPRESSAO_A4, ESTILO_IMPRESSAO_TERMICA, ler("app/(printer)/os/[id]/garantia/page.tsx")]) {
      expect(estilo).not.toMatch(/^\s*aside,\s*nav,\s*header,\s*footer,/m);
    }
    expect(ESTILO_IMPRESSAO_A4).toContain(SELETOR_DO_QUE_NAO_IMPRIME);
    expect(ESTILO_IMPRESSAO_TERMICA).toContain(SELETOR_DO_QUE_NAO_IMPRIME);
  });

  it("cada documento impresso se marca como documento", () => {
    for (const arquivo of [
      "components/os/impressao/os-impressao-a4.tsx",
      "components/os/impressao/os-impressao-termica.tsx",
      "app/(printer)/os/[id]/garantia/page.tsx",
    ]) {
      expect(ler(arquivo), arquivo).toContain(CLASSE_DO_DOCUMENTO_IMPRESSO);
    }
  });
});
