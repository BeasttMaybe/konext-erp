/**
 * Quanto está em aberto no mês — a conta por trás dos cartões "A receber" e
 * "A pagar" da visão geral do Financeiro.
 *
 * O DEFEITO QUE ISTO CONSERTA
 *
 * O dono reportou: o painel mostrava R$ 61.803,94 em contas a pagar, "o que
 * não é verdade". E não era mesmo — o número somava TODA parcela pendente
 * que existe no banco, sem limite de data, num cartão sob o título "Visão
 * geral do mês". Pergunta e resposta não eram a mesma.
 *
 * Isso sempre esteve errado, mas antes passava despercebido porque as
 * parcelas futuras iam se esgotando com o tempo. Quando a despesa fixa
 * mensal virou recorrência de verdade — com doze meses sempre materializados
 * à frente, empurrados a cada abertura de tela —, o estoque de parcelas
 * futuras deixou de acabar. Aí um ano inteiro de aluguel, internet e
 * contador passou a aparecer como se fosse dívida do mês.
 *
 * A PERGUNTA CERTA
 *
 * "Quanto eu ainda devo que vence até o fim deste mês?"
 *
 * Isso inclui o que está ATRASADO de meses anteriores, porque atraso é
 * dívida de agora — não deixa de ser devido por ter vencido em setembro. E
 * exclui o que vence depois do fim do mês, porque isso é compromisso futuro,
 * não conta do mês.
 */

import { somar } from "@/lib/dinheiro";

export type ParcelaEmAberto = {
  /** Data de calendário (meia-noite UTC), como manda a convenção do projeto. */
  dataVencimento: Date;
  valorCentavos: number;
  /** PAGO/RECEBIDO/ESTORNADO não contam; o resto está em aberto. */
  estaLiquidada: boolean;
};

export type AbertoDoMes = {
  /** Tudo que vence até o fim do mês e ainda não foi liquidado. */
  totalCentavos: number;
  /** A parte disso que já passou do vencimento. */
  atrasadoCentavos: number;
};

/**
 * `hoje` e `fimDoMes` entram como parâmetro em vez de serem lidos do relógio
 * aqui dentro: é o que torna esta regra testável nos dias que importam — o
 * dia 1, o último dia do mês, a virada do ano — sem depender de quando o
 * teste roda.
 */
export function calcularAbertoDoMes({
  parcelas,
  hoje,
  fimDoMes,
}: {
  parcelas: ParcelaEmAberto[];
  hoje: Date;
  fimDoMes: Date;
}): AbertoDoMes {
  const emAberto = parcelas.filter(
    (parcela) =>
      !parcela.estaLiquidada && parcela.dataVencimento.getTime() <= fimDoMes.getTime()
  );

  const atrasadas = emAberto.filter(
    (parcela) => parcela.dataVencimento.getTime() < hoje.getTime()
  );

  return {
    totalCentavos: somar(...emAberto.map((parcela) => parcela.valorCentavos)),
    atrasadoCentavos: somar(...atrasadas.map((parcela) => parcela.valorCentavos)),
  };
}
