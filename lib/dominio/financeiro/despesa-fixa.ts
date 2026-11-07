/**
 * Despesa fixa mensal: aluguel, internet, contador, sistema.
 *
 * O dono reportou: "quando colocado despesa fixa mensal, aparece parcela, e
 * se deixar como 1 em parcela, a despesa fixa mensal só fica em um mês, sendo
 * que deveria ficar sempre".
 *
 * Ele está certo, e o defeito é de MODELAGEM, não de tela. "Fixa mensal"
 * estava implementada como parcelamento: o cadastro gerava `qtdParcelas`
 * linhas de uma vez e acabava ali. Com 1, virava uma despesa única; com 12,
 * uma despesa que misteriosamente desaparece em novembro do ano seguinte. Uma
 * despesa fixa não tem número de parcelas — ela não termina até alguém dizer
 * que terminou.
 *
 * O desenho aqui é HORIZONTE ROLANTE. A despesa guarda qual foi o primeiro
 * vencimento e segue viva até ganhar um `encerradaEm`. As parcelas são
 * materializadas até doze meses à frente de hoje, e a cada vez que a tela
 * abre o horizonte é empurrado pra frente. Para quem usa, é "sempre".
 *
 * Materializar (em vez de calcular na hora) é o que mantém a despesa fixa
 * igual a qualquer outra conta no resto do sistema: ela aparece no filtro de
 * período, soma nos indicadores, pode ser paga, editada e notificada sem
 * nenhum caminho especial. Uma recorrência virtual exigiria que cada uma
 * dessas telas soubesse da existência dela.
 *
 * Doze meses porque é o que cobre todo relatório anual e todo aviso de
 * vencimento com folga, e é pouco o bastante pra que o custo de empurrar o
 * horizonte seja irrelevante.
 */

import { somarMesesEmDataDeCalendario } from "@/lib/datas";

export const HORIZONTE_DE_MESES_DA_DESPESA_FIXA = 12;

export type ParcelaFixaAGerar = {
  numeroParcela: number;
  dataVencimento: Date;
};

/**
 * Quais parcelas faltam pra despesa fixa cobrir o horizonte.
 *
 * Devolve lista vazia quando já está coberta — é o caso normal, e é o que
 * torna seguro chamar isto a cada carregamento de tela.
 *
 * Todo vencimento é derivado do PRIMEIRO por índice, nunca do anterior. Somar
 * um mês repetidamente a partir da parcela anterior faz a data escorregar e
 * nunca mais voltar: uma despesa que vence dia 31 passaria por 28 de
 * fevereiro e ficaria presa no dia 28 pra sempre.
 */
export function parcelasFaltantesDaDespesaFixa({
  primeiroVencimento,
  ultimoNumeroParcelaExistente,
  hoje,
  encerradaEm,
  horizonteDeMeses = HORIZONTE_DE_MESES_DA_DESPESA_FIXA,
}: {
  primeiroVencimento: Date;
  /** 0 quando a despesa ainda não tem parcela nenhuma. */
  ultimoNumeroParcelaExistente: number;
  hoje: Date;
  /** Preenchido = o dono encerrou a despesa; nada novo é gerado depois disso. */
  encerradaEm: Date | null;
  horizonteDeMeses?: number;
}): ParcelaFixaAGerar[] {
  // O limite é o FIM do mês daqui a `horizonteDeMeses`, não o mesmo dia
  // daqui a tantos meses. A diferença importa: com o dia, uma despesa que
  // vence dia 10 ganharia 12 parcelas e uma que vence dia 5 ganharia 13,
  // porque o último vencimento cairia um pouco antes ou um pouco depois do
  // limite. Fechando no fim do mês, toda despesa fixa cobre exatamente os
  // mesmos meses, independente do dia em que vence.
  const limiteDoHorizonte = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + horizonteDeMeses + 1, 0)
  );

  // Encerrada antes do horizonte: o limite passa a ser a data de encerramento.
  // Uma despesa encerrada em março não ganha parcela de abril, mas mantém as
  // que já venceram — encerrar não é apagar o passado.
  const limite =
    encerradaEm && encerradaEm.getTime() < limiteDoHorizonte.getTime()
      ? encerradaEm
      : limiteDoHorizonte;

  const faltantes: ParcelaFixaAGerar[] = [];

  // Teto defensivo: sem ele, uma `primeiroVencimento` absurda no passado
  // (digitação de ano errado, "2016" em vez de "2026") geraria milhares de
  // linhas numa requisição de tela. O teto não some com nada — a próxima
  // abertura continua de onde parou.
  const TETO_POR_VEZ = 240;

  for (let numero = ultimoNumeroParcelaExistente + 1; faltantes.length < TETO_POR_VEZ; numero += 1) {
    const dataVencimento = somarMesesEmDataDeCalendario(primeiroVencimento, numero - 1);

    if (dataVencimento.getTime() > limite.getTime()) break;

    faltantes.push({ numeroParcela: numero, dataVencimento });
  }

  return faltantes;
}
