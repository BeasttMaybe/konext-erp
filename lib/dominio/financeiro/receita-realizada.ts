/**
 * O que conta como receita realizada, e em que data.
 *
 * O DEFEITO QUE ISTO CONSERTA
 *
 * O dono: "metas não funcionam direito: parte funciona, dados não se cruzam
 * corretamente". Não era a tela de metas — era a regra.
 *
 * O painel financeiro e as metas automáticas respondiam à mesma pergunta
 * ("quanto entrou no período?") com regras DIFERENTES, cada uma escrita no
 * seu arquivo:
 *
 *  1. STATUS. O painel conta `RECEBIDO`. As metas contavam `RECEBIDO` e
 *     `PAGO`. `StatusPagamento` é compartilhado entre conta a pagar e conta a
 *     receber: `PAGO` é o estado de uma conta a PAGAR quitada. Nada no banco
 *     impede uma conta a receber de ficar `PAGO`, e quando isso acontece ela
 *     entra na meta e não entra no painel.
 *
 *  2. BLING. O painel exclui as contas importadas do Bling, porque elas vêm
 *     sem data de pagamento e datá-las pelo que existe mentiria sobre o mês.
 *     As metas não excluíam. Pior: sem `dataRecebimento`, elas caíam no
 *     ramo de reserva e eram datadas pelo VENCIMENTO — uma nota de janeiro
 *     com vencimento em novembro entrava na meta de novembro. É a mesma
 *     família do falso "faturamento de R$ 97.692,45" que o dono já pegou.
 *
 *  3. DATA. O painel data por `dataRecebimento` e, quando não há, por
 *     `criadoEm` (a conta nasceu quando o dinheiro entrou). As metas usavam
 *     `dataVencimento` como reserva — que é quando o dinheiro DEVERIA entrar,
 *     não quando entrou.
 *
 * Três regras divergentes para uma pergunta só. Agora a regra mora aqui, e
 * `receita-sem-bling.test.ts` é a guarda que impede uma quarta de nascer.
 *
 * O painel usa SQL cru e as metas usam o Prisma; este módulo dá as duas
 * formas da MESMA regra, e o teste de guarda compara as duas.
 */

/**
 * Status de conta a receber que conta como dinheiro que entrou.
 *
 * Um só, de propósito. Ver o item 1 acima: `PAGO` pertence à conta a pagar.
 */
export const STATUS_DE_RECEITA_REALIZADA = "RECEBIDO" as const;

/**
 * As contas importadas do Bling ficam fora.
 *
 * Elas são lidas de `/contas/receber` do Bling, que diz se foi recebida mas
 * (na importação de hoje) não diz QUANDO. Sem a data, a conta só poderia ser
 * datada pela de importação ou pelo vencimento — e um número errado numa tela
 * de dinheiro é pior que um número ausente.
 *
 * Quando a data real de baixa passar a ser buscada no detalhe da conta, esta
 * exclusão sai daqui — de um lugar só, para as duas regras ao mesmo tempo.
 */
export const RECEITA_IGNORA_CONTAS_DO_BLING = true;

/**
 * Filtro Prisma de "conta a receber que conta como receita".
 *
 * Função, e não constante, porque objeto exportado é compartilhado por
 * referência: um chamador que fizesse `where.status = …` mudaria a regra para
 * todos os outros.
 */
export function filtroPrismaDeReceitaRealizada(): {
  status: typeof STATUS_DE_RECEITA_REALIZADA;
  blingParcelaRef: null;
} {
  return { status: STATUS_DE_RECEITA_REALIZADA, blingParcelaRef: null };
}

/**
 * Filtro Prisma de período, datando a conta como o painel data.
 *
 * Equivale exatamente a `COALESCE(dataRecebimento, criadoEm) BETWEEN …` do
 * SQL: o primeiro ramo pega quem tem data de recebimento, o segundo pega
 * quem não tem e usa a data de criação.
 */
export function filtroPrismaDePeriodoDeReceita(intervalo: { gte?: Date; lte?: Date }): {
  OR: Array<{ dataRecebimento: { gte?: Date; lte?: Date } | null; criadoEm?: { gte?: Date; lte?: Date } }>;
} {
  return {
    OR: [
      { dataRecebimento: intervalo },
      { dataRecebimento: null, criadoEm: intervalo },
    ],
  };
}
