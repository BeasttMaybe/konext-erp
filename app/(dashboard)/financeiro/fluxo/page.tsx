import { NavFinanceiro } from "@/components/financeiro/nav-financeiro";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

/**
 * Fluxo e relatórios (Fase 3-2D, Parte 4 — ainda não implementada). Rota
 * criada na Parte 1 só pra a navegação do módulo não apontar pra um 404
 * enquanto as partes seguintes não chegam.
 */
export default async function FinanceiroFluxoPage() {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "financeiro.ver")) {
    return <AcessoNegado />;
  }

  return (
    <div className="flex h-[calc(100vh-72px)] w-full flex-col gap-4 overflow-hidden bg-kx-fundo p-5 lg:h-[calc(100vh-104px)] lg:p-6 xl:h-[calc(100vh-120px)]">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Financeiro</span>
        <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">Fluxo e relatórios</span>
      </div>

      <NavFinanceiro />

      <div className="flex flex-1 items-center justify-center rounded-kx-painel border border-dashed border-kx-painel-borda bg-kx-painel p-8 text-center">
        <div className="max-w-sm space-y-1.5">
          <p className="text-sm font-bold text-kx-texto">Chega na Parte 4 desta fase</p>
          <p className="text-xs text-kx-legenda">
            Projeção de saldo, resultado do período e os relatórios exportáveis ainda não foram construídos.
          </p>
        </div>
      </div>
    </div>
  );
}
