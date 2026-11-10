import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guarda: receita entra pela data em que o dinheiro ENTROU.
 *
 * A HISTÓRIA DESTE TESTE
 *
 * Ele substitui `receita-sem-bling.test.ts`, que exigia o contrário: que
 * toda consulta de receita EXCLUÍSSE as contas vindas do Bling.
 *
 * Aquela exclusão existia por um motivo honesto. A importação não sabia
 * quando cada conta tinha sido paga — o Bling não dá essa data nem na lista
 * nem no detalhe da conta —, e sem ela as contas caíam no ramo de reserva e
 * eram datadas pela data de IMPORTAÇÃO. Foi assim que um ano de notas virou
 * "faturamento de novembro": R$ 97.692,45 que o dono viu e sabia estar
 * errado.
 *
 * Agora a data vem do borderô, o lote de baixa (ver
 * `lib/dominio/bling/bordero.ts`), então as contas do Bling voltam a contar
 * — no mês certo.
 *
 * O QUE ESTE TESTE GUARDA
 *
 * A reserva por `criadoEm` vale SÓ para conta nativa. Para conta do Bling,
 * sem data real a expressão devolve NULL, e NULL não passa no `>= início` —
 * a conta fica de fora sozinha, sem precisar de um `AND` extra que alguém
 * possa esquecer na próxima consulta.
 *
 * É a diferença entre "excluir o Bling" e "contar o que tem data": a
 * primeira regra some com a receita verdadeira junto; a segunda deixa
 * entrar assim que a data aparece.
 */

const FONTES = ["lib/dashboard/regras-financeiras.ts", "app/actions/financeiro-fluxo.ts"];

const DATACAO_HONESTA =
  'COALESCE(cr."dataRecebimento", CASE WHEN cr."blingParcelaRef" IS NULL THEN cr."criadoEm" END)';

function lerFonte(caminho: string): string {
  return readFileSync(join(process.cwd(), caminho), "utf8");
}

describe("receita é datada pela entrada do dinheiro", () => {
  for (const caminho of FONTES) {
    it(`${caminho}: nenhuma data de receita cai para criadoEm numa conta do Bling`, () => {
      const fonte = lerFonte(caminho);

      // A forma ingênua: reserva por `criadoEm` para qualquer conta. Numa
      // conta importada, `criadoEm` é o dia da IMPORTAÇÃO — e foi isso que
      // produziu o falso faturamento.
      const datacaoIngenua = /COALESCE\(\s*cr\."dataRecebimento",\s*cr\."criadoEm"\s*\)/g;

      expect(
        fonte.match(datacaoIngenua),
        "Datação por `criadoEm` sem proteger a conta do Bling: use " + DATACAO_HONESTA
      ).toBeNull();
    });

    it(`${caminho}: toda datação de receita usa a expressão honesta`, () => {
      const fonte = lerFonte(caminho);

      const quantasDatacoes = fonte.split('COALESCE(cr."dataRecebimento"').length - 1;
      const quantasHonestas = fonte.split(DATACAO_HONESTA).length - 1;

      expect(quantasDatacoes).toBeGreaterThan(0);
      expect(quantasHonestas).toBe(quantasDatacoes);
    });
  }

  it("a importação grava a data real da baixa", () => {
    const sincronizacao = lerFonte("app/actions/bling-sincronizar.ts");

    // Sem isto, a expressão acima deixaria TODA conta do Bling de fora para
    // sempre — a guarda passaria e o faturamento seguiria incompleto.
    expect(sincronizacao).toContain("buscarDataDaBaixa");
    expect(sincronizacao).toMatch(/dataRecebimento,/);
  });

  it("a data da baixa vem do borderô, não do vencimento", () => {
    const sincronizacao = lerFonte("app/actions/bling-sincronizar.ts");

    // A primeira conta real do dono venceu em 08/01 e foi paga em 15/01.
    expect(sincronizacao).toContain("borderosDaConta");
    expect(sincronizacao).toContain("lerBordero");
  });
});
