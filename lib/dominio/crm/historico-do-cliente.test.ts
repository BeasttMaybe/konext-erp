import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guarda das decisões do histórico do cliente.
 *
 * O histórico vive numa server action que precisa de tenant e Prisma, então
 * não dá para chamá-la aqui sem subir meio sistema. O que dá — e é o que
 * importa — é garantir que as decisões que afetam DINHEIRO e verdade não se
 * percam numa edição futura. Mesmo padrão de `receita-sem-bling.test.ts`.
 */

const ACTION = "app/actions/historico-do-cliente.ts";
const PAINEL = "components/crm/historico-do-cliente.tsx";

function lerFonte(caminho: string): string {
  return readFileSync(join(process.cwd(), caminho), "utf8");
}

describe("histórico do cliente", () => {
  const action = lerFonte(ACTION);

  it("o total ignora o que foi anulado", () => {
    // Somar uma venda estornada diria ao balconista que o cliente gastou um
    // dinheiro que voltou para ele.
    expect(action).toMatch(/filter\(\(item\) => !item\.anulado\)/);
  });

  it("soma pelo módulo de dinheiro, não com +", () => {
    // Centavos inteiros: somar reais em ponto flutuante erra na terceira
    // venda e o total do cliente passa a não bater com a soma das linhas.
    expect(action).toContain("somar(");
    expect(action).toContain('from "@/lib/dinheiro"');
  });

  it("não traz OS excluída", () => {
    // `excluidaEm` é soft delete: a OS sumiu da vida do cliente de propósito.
    expect(action).toMatch(/excluidaEm:\s*null/);
  });

  it("marca venda estornada e OS cancelada como anuladas", () => {
    expect(action).toMatch(/anulado:\s*venda\.estornadaEm !== null/);
    expect(action).toContain('"CANCELADA"');
  });

  it("tem teto por tipo, para o painel não virar a tela de OS", () => {
    expect(action).toContain("MAXIMO_POR_TIPO");
    expect(action).toMatch(/take:\s*MAXIMO_POR_TIPO/);
  });

  it("ordena do mais recente para o mais antigo", () => {
    // Quem atende quer ver o que aconteceu por último, não a primeira OS de
    // três anos atrás.
    expect(action).toMatch(/sort\(\(a, b\) => b\.data\.localeCompare\(a\.data\)\)/);
  });
});

describe("painel do histórico", () => {
  const painel = lerFonte(PAINEL);

  it("mostra a linha anulada riscada, em vez de escondê-la", () => {
    // Esconder apagaria o fato de que a venda existiu; mostrar o valor
    // normal mentiria sobre ele.
    expect(painel).toContain("line-through");
  });

  it("formata dinheiro pelo módulo, não à mão", () => {
    expect(painel).toContain("formatarReais");
    expect(painel).not.toMatch(/R\$\s*\$\{/);
  });

  it("leva para a OS e para a venda ao clicar", () => {
    expect(painel).toMatch(/\/os\/\$\{item\.id\}/);
    expect(painel).toContain("/vendas?venda=");
  });
});
