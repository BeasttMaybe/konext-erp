import { obterDadosFluxoDeCaixa, obterDadosResultadoPeriodo } from "@/app/actions/financeiro-fluxo";
import { NavFinanceiro } from "@/components/financeiro/nav-financeiro";
import { ConteudoFluxo } from "./components/ConteudoFluxo";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

export const metadata = { title: "Fluxo e Relatórios | Konext" };

/**
 * Fluxo e relatórios (Fase 3-2D, Parte 4) — substitui a antiga Inteligência
 * Financeira. Mesma permissão que o item de navegação já exigia
 * (`dashboard.financeiro`, não `financeiro.ver` como o resto do módulo) —
 * preservada tal como estava, não uma escolha nova desta parte.
 */
export default async function FinanceiroFluxoPage() {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "dashboard.financeiro")) {
    return <AcessoNegado />;
  }

  const [dadosFluxo, dadosResultado] = await Promise.all([obterDadosFluxoDeCaixa(), obterDadosResultadoPeriodo()]);

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-5 pb-8 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Financeiro</span>
        <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">Fluxo e relatórios</span>
      </div>

      <NavFinanceiro />

      <ConteudoFluxo dadosFluxo={dadosFluxo} dadosResultado={dadosResultado} />
    </div>
  );
}
