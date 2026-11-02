/**
 * Conversao de `Meta.valorAlvo`/`valorAtual` e
 * `HistoricoMeta.valorAnterior`/`valorNovo` da borda do banco pra tela.
 *
 * Desde a Fase 2A-3 essas quatro colunas sao `Decimal(14,4)` — antes eram
 * `Float`. Elas foram as ultimas a sair do ponto flutuante, e sairam por
 * ultimo porque sao POLIMORFICAS: `Meta.tipoValor` decide em tempo de
 * execucao se o numero e dinheiro, quantidade ou percentual. Por isso
 * `lib/dinheiro` NAO se aplica aqui — `deDecimal` converte pra centavos, e
 * centavo nao quer dizer nada numa meta de "80 OS por mes" ou de "taxa de
 * retorno abaixo de 5%".
 *
 * O que a coluna Decimal garante e o armazenamento e a SOMA EM SQL exatos
 * (`prisma.meta.aggregate` sobre metas de DINHEIRO soma em numeric, nao em
 * double). A conta de progresso, do outro lado, e razao e comparacao: ali a
 * escala nao muda o resultado.
 *
 * `Number(String(valor))` e nao `Number(valor)` de proposito: o segundo
 * funciona por coercao implicita de objeto, que e exatamente a porta por
 * onde um `Decimal` passou a ser concatenado como string nos KPIs do
 * financeiro. Passar pelo texto e explicito e nao depende de `valueOf`.
 */
export function numeroDaMeta(valor: unknown): number {
  if (valor === null || valor === undefined) return 0;
  const numero = Number(String(valor));
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Igual a `numeroDaMeta`, mas preserva `null` — uma meta de CHECKLIST nao
 * tem alvo numerico, e `0` ali mentiria dizendo que o alvo e zero.
 */
export function numeroDaMetaOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const numero = Number(String(valor));
  return Number.isFinite(numero) ? numero : null;
}
