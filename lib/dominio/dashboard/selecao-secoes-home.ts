/**
 * Selecao de secoes da home (`/`) por permissao — dominio puro (Fase
 * 1B-FIX, Parte 1.3).
 *
 * Antes, a home buscava e renderizava um unico `DashboardExecutivo` que
 * exigia `dashboard.financeiro` incondicionalmente: sem essa permissao (o
 * caso de USUARIO), a pagina inteira falhava e mostrava so uma mensagem de
 * erro — ninguem sem acesso financeiro conseguia ver a fila de OS, OS
 * paradas ou garantias na propria home.
 *
 * A home nunca bloqueia por completo: quem tem sessao valida sempre ve pelo
 * menos a secao operacional. Financeiro e metas sao independentes entre si
 * e da secao operacional.
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
