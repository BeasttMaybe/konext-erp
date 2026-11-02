import { describe, expect, it } from "vitest";

import { deDecimal, paraMoeda } from "@/lib/dinheiro";
import {
  calcularEsperadoFechamento,
  decidirDestinoDoEstorno,
  pedidoPodeSerEstornado,
  type SessaoCaixa,
} from "./estorno";

const caixaDeHoje: SessaoCaixa = { id: "sessao-hoje", status: "ABERTO" };
const caixaDeOntem: SessaoCaixa = { id: "sessao-ontem", status: "FECHADO" };

describe("lib/dominio/financeiro/estorno — quem absorve o estorno", () => {
  it("caixa da venda ainda aberto: cai na mesma sessao", () => {
    const destino = decidirDestinoDoEstorno(caixaDeHoje, caixaDeHoje);

    expect(destino.sessaoDestinoId).toBe("sessao-hoje");
    expect(destino.motivo).toContain("mesma sessao");
  });

  it("caixa da venda ja fechado: cai no caixa aberto, nao no antigo", () => {
    const destino = decidirDestinoDoEstorno(caixaDeOntem, caixaDeHoje);

    expect(destino.sessaoDestinoId).toBe("sessao-hoje");
    expect(destino.sessaoDestinoId).not.toBe(caixaDeOntem.id);
    expect(destino.motivo).toContain("sem alterar o fechamento conferido");
  });

  it("venda sem caixa vinculado: cai no caixa aberto", () => {
    const destino = decidirDestinoDoEstorno(null, caixaDeHoje);

    expect(destino.sessaoDestinoId).toBe("sessao-hoje");
  });

  it("nenhum caixa aberto: registra sem sessao em vez de travar o estorno", () => {
    const destino = decidirDestinoDoEstorno(caixaDeOntem, null);

    expect(destino.sessaoDestinoId).toBeNull();
    expect(destino.motivo).toContain("Nenhum caixa aberto");
  });
});

describe("lib/dominio/financeiro/estorno — esperado de fechamento", () => {
  it("soma abertura com as vendas da sessao", () => {
    const esperado = calcularEsperadoFechamento({
      aberturaCentavos: deDecimal(100),
      vendasDaSessaoCentavos: deDecimal(1250.5),
      estornosAbsorvidosCentavos: 0,
    });

    expect(paraMoeda(esperado)).toBe(1350.5);
  });

  it("estorno absorvido pela sessao sai do esperado dela", () => {
    const esperado = calcularEsperadoFechamento({
      aberturaCentavos: deDecimal(100),
      vendasDaSessaoCentavos: deDecimal(1250.5),
      estornosAbsorvidosCentavos: deDecimal(250.5),
    });

    expect(paraMoeda(esperado)).toBe(1100);
  });

  /**
   * A propriedade que a regra existe pra garantir. A sessao de ontem fechou
   * conferida com R$ 1.100,00 na gaveta; uma venda dela e estornada hoje. O
   * esperado de ONTEM nao pode mudar, porque aquela diferenca de fechamento
   * ja foi conferida e assinada.
   */
  it("estorno de venda antiga NAO move o esperado da sessao ja fechada", () => {
    const aberturaOntem = deDecimal(100);
    const vendasOntem = deDecimal(1000);

    const esperadoOntemAntes = calcularEsperadoFechamento({
      aberturaCentavos: aberturaOntem,
      vendasDaSessaoCentavos: vendasOntem,
      estornosAbsorvidosCentavos: 0,
    });

    // Hoje, a venda de R$ 300 de ontem e estornada. O estorno cai em HOJE.
    const destino = decidirDestinoDoEstorno(caixaDeOntem, caixaDeHoje);
    expect(destino.sessaoDestinoId).toBe(caixaDeHoje.id);

    // Ontem nao absorveu nada: a venda continua na sessao dela, intacta.
    const esperadoOntemDepois = calcularEsperadoFechamento({
      aberturaCentavos: aberturaOntem,
      vendasDaSessaoCentavos: vendasOntem,
      estornosAbsorvidosCentavos: 0,
    });

    expect(esperadoOntemDepois).toBe(esperadoOntemAntes);
    expect(paraMoeda(esperadoOntemDepois)).toBe(1100);

    // E hoje sai R$ 300 da gaveta, que e onde o dinheiro de fato sai.
    const esperadoHoje = calcularEsperadoFechamento({
      aberturaCentavos: deDecimal(50),
      vendasDaSessaoCentavos: deDecimal(800),
      estornosAbsorvidosCentavos: deDecimal(300),
    });

    expect(paraMoeda(esperadoHoje)).toBe(550);
  });

  it("venda estornada na mesma sessao se anula: esperado volta pra antes dela", () => {
    const abertura = deDecimal(100);
    const semAVenda = calcularEsperadoFechamento({
      aberturaCentavos: abertura,
      vendasDaSessaoCentavos: deDecimal(700),
      estornosAbsorvidosCentavos: 0,
    });

    const comAVendaEstornada = calcularEsperadoFechamento({
      aberturaCentavos: abertura,
      // A venda de R$ 89,90 entrou e foi estornada na mesma sessao.
      vendasDaSessaoCentavos: deDecimal(789.9),
      estornosAbsorvidosCentavos: deDecimal(89.9),
    });

    expect(comAVendaEstornada).toBe(semAVenda);
  });

  it("estorno maior que as vendas do dia deixa o esperado abaixo da abertura", () => {
    // Nao e erro: a loja devolveu dinheiro de venda de outro dia, e a gaveta
    // fecha com menos do que abriu. O numero tem que mostrar isso.
    const esperado = calcularEsperadoFechamento({
      aberturaCentavos: deDecimal(100),
      vendasDaSessaoCentavos: deDecimal(50),
      estornosAbsorvidosCentavos: deDecimal(300),
    });

    expect(paraMoeda(esperado)).toBe(-150);
  });

  it("soma em centavo: tres estornos de 0,07 saem exatos", () => {
    const esperado = calcularEsperadoFechamento({
      aberturaCentavos: 0,
      vendasDaSessaoCentavos: deDecimal(1),
      estornosAbsorvidosCentavos: deDecimal(0.07) * 3,
    });

    expect(paraMoeda(esperado)).toBe(0.79);
  });
});

describe("lib/dominio/financeiro/estorno — elegibilidade", () => {
  it("so pedido aprovado pode ser estornado", () => {
    expect(pedidoPodeSerEstornado("APROVADO")).toBe(true);
    expect(pedidoPodeSerEstornado("CANCELADO")).toBe(false);
    expect(pedidoPodeSerEstornado("PENDENTE")).toBe(false);
    expect(pedidoPodeSerEstornado("")).toBe(false);
  });
});
