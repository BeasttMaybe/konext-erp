import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guarda de regra, no estilo de `papel.test.ts`: a regra mora num lugar só e
 * o teste garante que continue assim.
 *
 * Toda consulta de RECEITA soma contas a receber com status RECEBIDO. As
 * contas importadas do Bling não podem entrar nessas somas, porque elas são
 * datadas por `criadoEm` — o dia da importação — e isso faz anos de
 * histórico virarem faturamento do mês corrente. Foi o que produziu
 * R$ 97.692,45 de "faturamento em novembro" no painel do dono.
 *
 * As consultas são SQL cru em sete lugares; não há tipo que force a
 * exclusão. Este teste força: quem escrever a oitava consulta de receita
 * sem a condição descobre aqui, e não na tela.
 */

const ARQUIVOS = [
  "lib/dashboard/regras-financeiras.ts",
  "app/actions/financeiro-fluxo.ts",
];

function lerFonte(caminho: string): string {
  return readFileSync(join(process.cwd(), caminho), "utf8");
}

describe("receita não conta conta importada do Bling", () => {
  for (const caminho of ARQUIVOS) {
    it(`${caminho}: todo filtro de RECEBIDO exclui o que veio do Bling`, () => {
      const fonte = lerFonte(caminho);
      const linhas = fonte.split("\n");

      const filtrosDeRecebido = linhas
        .map((linha, indice) => ({ linha, indice }))
        .filter(({ linha }) => linha.includes(`cr.status::text = 'RECEBIDO'`));

      expect(filtrosDeRecebido.length).toBeGreaterThan(0);

      for (const { indice } of filtrosDeRecebido) {
        // A exclusão fica na linha seguinte, imediatamente abaixo do filtro,
        // para quem lê a consulta ver as duas juntas.
        const seguinte = linhas[indice + 1] ?? "";

        expect(seguinte, `linha ${indice + 1} de ${caminho}`).toContain(
          `cr."blingParcelaRef" IS NULL`
        );
      }
    });
  }

  it("as sete consultas de receita continuam existindo", () => {
    // Se este número cair, alguém removeu uma regra de receita — o que pode
    // estar certo, mas merece ser notado em vez de passar em silêncio.
    const total = ARQUIVOS.reduce(
      (soma, caminho) =>
        soma + (lerFonte(caminho).match(/cr\.status::text = 'RECEBIDO'/g) ?? []).length,
      0
    );

    expect(total).toBe(7);
  });
});
