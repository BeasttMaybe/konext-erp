import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  filtroPrismaDePeriodoDeReceita,
  filtroPrismaDeReceitaRealizada,
  STATUS_DE_RECEITA_REALIZADA,
} from "./receita-realizada";

describe("filtroPrismaDeReceitaRealizada", () => {
  it("conta só RECEBIDO", () => {
    // `PAGO` existe na mesma enum porque ela serve conta a pagar também, e é
    // o estado de uma conta a PAGAR quitada. Contá-lo como receita era o que
    // fazia a meta divergir do painel.
    expect(filtroPrismaDeReceitaRealizada().status).toBe("RECEBIDO");
    expect(STATUS_DE_RECEITA_REALIZADA).toBe("RECEBIDO");
  });

  it("deixa as contas do Bling fora", () => {
    expect(filtroPrismaDeReceitaRealizada().blingParcelaRef).toBeNull();
  });

  it("devolve objeto novo a cada chamada", () => {
    // Constante exportada seria compartilhada por referência, e um chamador
    // que mexesse nela mudaria a regra para todos os outros.
    const a = filtroPrismaDeReceitaRealizada();
    const b = filtroPrismaDeReceitaRealizada();

    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("filtroPrismaDePeriodoDeReceita", () => {
  const intervalo = { gte: new Date("2026-11-01T00:00:00Z"), lte: new Date("2026-11-30T23:59:59Z") };

  it("data por dataRecebimento, com criadoEm de reserva", () => {
    const filtro = filtroPrismaDePeriodoDeReceita(intervalo);

    expect(filtro.OR).toHaveLength(2);
    expect(filtro.OR[0]).toEqual({ dataRecebimento: intervalo });
    expect(filtro.OR[1]).toEqual({ dataRecebimento: null, criadoEm: intervalo });
  });

  it("nunca usa dataVencimento", () => {
    // Vencimento é quando o dinheiro DEVERIA entrar. A meta mede o que
    // entrou. Era essa troca que punha nota de janeiro na meta de novembro.
    expect(JSON.stringify(filtroPrismaDePeriodoDeReceita(intervalo))).not.toContain(
      "dataVencimento"
    );
  });
});

/**
 * Guarda de regra, no estilo de `receita-sem-bling.test.ts`: lê as fontes.
 *
 * O painel financeiro usa SQL cru e as metas usam o Prisma, então o
 * compilador não tem como exigir que as duas respondam igual. Este teste tem.
 */
describe("as metas automáticas não podem ter regra de receita própria", () => {
  const metas = readFileSync(join(process.cwd(), "app/actions/metas.ts"), "utf8");

  it("não contam PAGO como receita", () => {
    expect(metas).not.toContain('"RECEBIDO", "PAGO"');
    expect(metas).not.toContain('"PAGO", "RECEBIDO"');
  });

  it("não datam receita pelo vencimento", () => {
    // A única menção legítima a vencimento numa meta seria outra métrica; se
    // aparecer junto de `dataRecebimento: null`, a reserva voltou a ser o
    // vencimento.
    expect(metas).not.toMatch(/dataRecebimento:\s*null,\s*\n\s*dataVencimento/);
  });

  it("toda consulta de receita passa pela regra compartilhada", () => {
    const consultasDeReceita = metas.match(/origem:\s*"(ORDEM_SERVICO|VENDA_PDV)"/g) ?? [];
    const usosDaRegra = metas.match(/filtroPrismaDeReceitaRealizada\(\)/g) ?? [];

    // Quatro métricas somam dinheiro de conta a receber: FATURAMENTO_OS,
    // TICKET_MEDIO_OS, RECEBIMENTOS_FINANCEIRO e FATURAMENTO_PDV. Se alguém
    // acrescentar uma quinta sem usar a regra, a contagem deixa de bater.
    expect(usosDaRegra.length).toBe(4);
    expect(consultasDeReceita.length).toBeLessThanOrEqual(usosDaRegra.length);
  });

  it("venda estornada não entra na contagem de vendas", () => {
    expect(metas).toMatch(/estornadaEm:\s*null/);
  });

  it("ticket médio divide por OS, não por conta", () => {
    // `_avg` sobre ContaReceber dava média por parcela: quanto mais o cliente
    // parcelava, menor o "ticket médio" aparecia.
    expect(metas).not.toContain("_avg: { valor: true }");
    expect(metas).toContain('distinct: ["ordemServicoId"]');
  });
});
