import { redirect } from "next/navigation";

/**
 * Inteligência Financeira foi substituída por Fluxo e relatórios (Fase
 * 3-2D, Parte 4) — projeção de saldo, resultado do período e relatórios,
 * com números honestos em vez de MRR/break-even/Curva ABC. Redireciona em
 * vez de 404 pra não quebrar links/favoritos antigos.
 */
export default function FinanceiroInteligenciaPage() {
  redirect("/financeiro/fluxo");
}
