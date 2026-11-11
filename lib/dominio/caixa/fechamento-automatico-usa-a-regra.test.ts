import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { calcularEsperadoFechamento } from "@/lib/dominio/financeiro/estorno";

/**
 * O fechamento automatico grava como "valor de fechamento" o proprio
 * esperado. O historico do caixa recalcula o esperado, ao vivo, por
 * `calcularEsperadoFechamento`, e mostra a diferenca entre os dois.
 *
 * Se a rotina calcular o esperado por QUALQUER outra conta, o historico passa
 * a exibir sobra ou falta num caixa que ninguem contou.
 */
describe("o esperado do fechamento automatico", () => {
  it("o caso que a primeira versao errava: caixa que absorveu o estorno de uma venda de outro dia", () => {
    // Caixa de terca: abriu com R$ 100, vendeu R$ 500, e devolveu ao cliente
    // os R$ 80 de uma venda de SEGUNDA.
    const abertura = 100_00;
    const vendasDeTerca = 500_00;
    const estornoDaVendaDeSegunda = 80_00;

    const pelaRegra = calcularEsperadoFechamento({
      aberturaCentavos: abertura,
      vendasDaSessaoCentavos: vendasDeTerca,
      estornosAbsorvidosCentavos: estornoDaVendaDeSegunda,
    });

    // "abertura + vendas nao estornadas": nenhuma venda de terca foi
    // estornada, entao a conta antiga nao descontava nada.
    const pelaContaAntiga = abertura + vendasDeTerca;

    expect(pelaRegra).toBe(520_00);
    expect(pelaContaAntiga - pelaRegra).toBe(estornoDaVendaDeSegunda); // a "sobra" fantasma
  });

  it("venda estornada no proprio caixa: entra e sai, e o esperado volta a abertura", () => {
    expect(
      calcularEsperadoFechamento({
        aberturaCentavos: 100_00,
        vendasDaSessaoCentavos: 80_00,
        estornosAbsorvidosCentavos: 80_00,
      })
    ).toBe(100_00);
  });
});

/**
 * GUARDA: a rota usa a regra, e nao volta a filtrar vendas por conta propria.
 */
describe("rota de fechamento automatico", () => {
  const fonte = readFileSync(join(process.cwd(), "app/api/cron/fechar-caixa/route.ts"), "utf8");
  // So o codigo: o comentario da rota CITA a conta antiga para explicar o erro.
  const codigo = fonte
    .split("\n")
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join("\n");

  it("calcula o esperado pela funcao de dominio", () => {
    expect(codigo).toContain("calcularEsperadoFechamento({");
  });

  it("le os estornos que ESTE caixa absorveu", () => {
    expect(codigo).toContain("vendasEstornadasAqui: { select: { valorTotal: true } }");
    expect(codigo).toContain("estornosAbsorvidosCentavos:");
  });

  it("nao descarta venda estornada da soma da sessao — a venda nunca sai da sessao dela", () => {
    expect(codigo).not.toContain("estornadaEm");
  });
});
