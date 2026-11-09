import { Suspense } from "react";

import { listarNotasFiscais } from "@/app/actions/notas-fiscais";
import { NavFinanceiro } from "@/components/financeiro/nav-financeiro";
import { PaginaNotasFiscais } from "@/components/financeiro/notas-fiscais/pagina-notas-fiscais";
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { AcessoNegado } from "@/components/ui/acesso-negado";
import { calcularPresetEsteMes } from "@/lib/filtro-periodo";
import { temPermissao } from "@/lib/auth/permissoes";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

export const dynamic = "force-dynamic";

function comoTexto(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export default async function FinanceiroNotasFiscaisPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string }>;
}) {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "financeiro.ver")) {
    return <AcessoNegado />;
  }

  // Mesmo filtro de período das outras telas do Financeiro, pelo mesmo
  // motivo: o dono confere o mês, não o acumulado de todos os tempos.
  const parametros = await searchParams;
  const preset = calcularPresetEsteMes(contexto.fusoHorario);

  const inicio = parametros.inicio ?? comoTexto(preset.inicio);
  const fim = parametros.fim ?? comoTexto(preset.fim);

  const resultado = await listarNotasFiscais({ inicio, fim });

  return (
    <div className="min-h-full w-full px-6 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <NavFinanceiro />
        <Suspense fallback={null}>
          <FiltroPeriodoPagina
            campos={[{ valor: "emissao", rotulo: "Emissão" }]}
            fusoHorario={contexto.fusoHorario}
          />
        </Suspense>
        <PaginaNotasFiscais
          notasIniciais={resultado.sucesso ? resultado.dados : []}
          periodo={{ inicio, fim }}
        />
      </div>
    </div>
  );
}
