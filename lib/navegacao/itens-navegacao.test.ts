import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { estaAtivo, indiceFilhoAtivo, ITENS_NAVEGACAO, itemEstaAtivo } from "./itens-navegacao";

/**
 * Todo caminho do menu tem que ter uma página do outro lado.
 *
 * Um link que aponta pra uma rota apagada não quebra nada visível: a pessoa
 * clica e cai no 404, e quem mexeu no código nunca passa por ali. Como as
 * rotas do App Router são pastas, nenhuma ferramenta reclama — `tsc` não sabe
 * que `"/crm/propostas"` é um caminho, é só uma string.
 */

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

function arquivoDaPagina(caminho: string): string {
  const [pathname] = caminho.split("?");
  const semBarraFinal = pathname === "/" ? "" : pathname;

  return `${RAIZ}app/(dashboard)${semBarraFinal}/page.tsx`;
}

describe("navegação — todo caminho leva a uma página de verdade", () => {
  const todos = ITENS_NAVEGACAO.flatMap((item) => [
    { rotulo: item.label, caminho: item.path },
    ...(item.filhos ?? []).map((filho) => ({
      rotulo: `${item.label} > ${filho.label}`,
      caminho: filho.path,
    })),
  ]);

  it.each(todos)("$rotulo ($caminho)", ({ caminho }) => {
    expect(existsSync(arquivoDaPagina(caminho)), arquivoDaPagina(caminho)).toBe(true);
  });

  it("nenhum caminho está repetido entre seções diferentes", () => {
    // O mesmo destino em duas seções faz o indicador de ativo piscar entre
    // elas, e faz a pessoa achar que são telas diferentes.
    const porSecao = ITENS_NAVEGACAO.flatMap((item) =>
      (item.filhos ?? []).map((filho) => `${item.label}|${filho.path}`)
    );

    const caminhos = porSecao.map((entrada) => entrada.split("|")[1]);
    expect(new Set(caminhos).size).toBe(caminhos.length);
  });

  it("toda seção com filhos tem mais de um — senão o filho só repete o pai", () => {
    for (const item of ITENS_NAVEGACAO) {
      if (!item.filhos) continue;
      expect(item.filhos.length, item.label).toBeGreaterThan(1);
    }
  });
});

describe("navegação — qual item fica aceso", () => {
  const vazio = new URLSearchParams();

  it("a raiz só acende na raiz", () => {
    expect(estaAtivo("/", "/", vazio)).toBe(true);
    expect(estaAtivo("/", "/crm", vazio)).toBe(false);
  });

  it("uma página de dentro acende a seção", () => {
    const crm = ITENS_NAVEGACAO.find((item) => item.path === "/crm")!;
    expect(itemEstaAtivo(crm, "/crm/propostas", vazio)).toBe(true);
  });

  it("entre filhos que casam, vence o mais específico", () => {
    const crm = ITENS_NAVEGACAO.find((item) => item.path === "/crm")!;
    const indice = indiceFilhoAtivo(crm.filhos!, "/crm/propostas", vazio);

    // "/crm" também casa com "/crm/propostas" por prefixo; "Propostas" é mais
    // específico e tem que ganhar, senão o submenu acende a linha errada.
    expect(crm.filhos![indice].label).toBe("Propostas");
  });

  it("o modo na query separa telas que dividem a mesma rota", () => {
    const os = ITENS_NAVEGACAO.find((item) => item.path === "/os")!;
    const indice = indiceFilhoAtivo(os.filhos!, "/os", new URLSearchParams("modo=garantia"));

    expect(os.filhos![indice].label).toBe("Garantias");
  });
});
