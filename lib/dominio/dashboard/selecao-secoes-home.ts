/**
 * Selecao de secoes da home (`/`) por permissao — dominio puro (Fase
 * 1B-FIX, Parte 1.3).
 *
 * Desde a Fase 3-2A, `app/(dashboard)/page.tsx` chama as duas server actions
 * da home diretamente (`obterPainelOperacionalHomeSeguro` sempre,
 * `obterFaturamentoHomeSeguro` só quando `temPermissao(contexto,
 * "dashboard.financeiro")`) em vez de montar um `DashboardExecutivo` inteiro
 * OU um painel operacional — esse "OU" antigo nao existe mais. Este arquivo
 * fica como o registro da regra de negocio (a home nunca bloqueia por
 * completo; financeiro e metas sao independentes entre si e da secao
 * operacional, que e sempre visivel pra qualquer sessao valida), coberta
 * pelo teste ao lado — nao precisa ser importado pela pagina pra continuar
 * valendo.
 */
export type SelecaoSecoesDashboardHome = {
  /** KPIs de receita, grafico de resultado, saldo, orcamento, DRE, movimentacoes financeiras. */
  financeiro: boolean;
  /** Fila de OS, OS paradas, garantia — sempre visivel para qualquer sessao valida. */
  operacional: true;
  /** Bloco de metas. */
  metas: boolean;
};

export function selecionarSecoesDashboardHome(permissoes: {
  temDashboardFinanceiro: boolean;
  temMetasVer: boolean;
}): SelecaoSecoesDashboardHome {
  return {
    financeiro: permissoes.temDashboardFinanceiro,
    operacional: true,
    metas: permissoes.temMetasVer,
  };
}
