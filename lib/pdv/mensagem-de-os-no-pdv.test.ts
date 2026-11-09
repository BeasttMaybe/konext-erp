import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guarda de regra, no estilo de `receita-sem-bling.test.ts`.
 *
 * O DEFEITO QUE ISTO IMPEDE DE VOLTAR
 *
 * `obterPedidoOSParaPDV` LANÇA quando a OS não pode ir ao balcão — por
 * exemplo "Para enviar ao PDV, cadastre pelo menos uma peça ou serviço na
 * OS.". A mensagem é boa. Ela nunca chegou na tela: erro lançado em Server
 * Component o Next troca, em produção, por um código. O dono viu
 * "Minified React error #441" no lugar do motivo.
 *
 * O conserto foi `carregarPedidoOSParaPDV`, que devolve
 * `{ sucesso: false, mensagem }` em vez de lançar. Mas nada no tipo impede
 * alguém de voltar a chamar a versão que lança direto de um componente —
 * compila, passa no lint, e só quebra na tela de quem está atendendo.
 *
 * Este teste é o que impede. Quem escrever a terceira tela que carrega OS no
 * PDV descobre aqui, e não no balcão.
 */

const CONSUMIDORES = [
  "app/(dashboard)/pdv/page.tsx",
  "components/os/sheet-faturar-os.tsx",
];

function lerFonte(caminho: string): string {
  return readFileSync(join(process.cwd(), caminho), "utf8");
}

describe("motivo de recusa da OS viaja como dado, não como exceção", () => {
  it("a action que devolve o motivo existe e não lança", () => {
    const fonte = lerFonte("app/actions/pdv.ts");

    expect(fonte).toContain("export async function carregarPedidoOSParaPDV");
    // O tipo de retorno é o contrato: sem ele, o chamador não tem como saber
    // que existe um motivo para ler.
    expect(fonte).toContain("ResultadoPedidoOSParaPDV");
    expect(fonte).toMatch(/sucesso:\s*false;\s*mensagem:\s*string/);
  });

  for (const caminho of CONSUMIDORES) {
    it(`${caminho} usa a versão que devolve o motivo`, () => {
      const fonte = lerFonte(caminho);

      expect(fonte).toContain("carregarPedidoOSParaPDV");

      // A versão que lança não pode ser chamada de uma tela. `obterPedido…`
      // aparecendo aqui significa que o #441 voltou.
      const chamaAQueLanca = /(?<!carregar)\bobterPedidoOSParaPDV\s*\(/.test(fonte);
      expect(chamaAQueLanca).toBe(false);

      // E o motivo precisa ser EXIBIDO. Receber o dado e descartá-lo seria o
      // mesmo buraco com outra forma.
      expect(fonte).toMatch(/resultado\.mensagem/);
    });
  }

  it("a lista do PDV marca a OS que não pode ser faturada", () => {
    const fonte = lerFonte("app/actions/os-para-pdv.ts");

    expect(fonte).toContain("podeFaturar");
    expect(fonte).toContain("motivoBloqueio");

    // A elegibilidade precisa vir da configuração, que é o que o servidor
    // confere ao carregar. Uma segunda cópia da regra é o que faz as duas
    // discordarem um dia.
    expect(fonte).toContain("exigirItemParaEnviarPDV");
  });

  it("o diálogo desabilita a OS bloqueada e mostra o motivo", () => {
    const fonte = lerFonte("components/pdv/balcao/dialogo-vincular-os.tsx");

    expect(fonte).toContain("disabled={!ordem.podeFaturar}");
    // À vista, não só no `title`: quem está no balcão não passa o mouse para
    // descobrir por que um item da lista não responde.
    expect(fonte).toMatch(/\{ordem\.motivoBloqueio && \(/);
  });
});
