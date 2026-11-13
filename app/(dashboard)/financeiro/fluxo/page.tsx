import { Suspense } from "react";
import { obterDadosFluxoDeCaixa, obterDadosResultadoPeriodo } from "@/app/actions/financeiro-fluxo";
import { NavFinanceiro } from "@/components/financeiro/nav-financeiro";
import { ConteudoFluxo } from "./components/ConteudoFluxo";
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { calcularPresetEsteMes, validarIntervalo } from "@/lib/filtro-periodo";
import { dataDeCalendario } from "@/lib/datas";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

export const metadata = { title: "Fluxo e Relatórios | TechOS" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function obterParam(params: Record<string, string | string[] | undefined>, chave: string): string | undefined {
  const valor = params[chave];
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Fluxo e relatórios (Fase 3-2D, Parte 4) — substitui a antiga Inteligência
 * Financeira. Mesma permissão que o item de navegação já exigia
 * (`dashboard.financeiro`, não `financeiro.ver` como o resto do módulo) —
 * preservada tal como estava, não uma escolha nova desta parte.
 *
 * Fase 2A-1 (`FiltroPeriodo`): esta tela não tinha filtro de período algum
 * antes — "Resultado do período"/"Serviço × Produto"/"Quanto sobrou por OS"
 * eram sempre o mês corrente, sem opção de escolher outro. Ganha o
 * `FiltroPeriodo` (sem seletor de campo — um único período pra tela
 * inteira); como as três sub-consultas de `obterDadosResultadoPeriodo` são
 * inerentemente MENSAIS (resumo do mês que contém uma data de referência,
 * não um intervalo arbitrário de dias — ver o comentário na action), o
 * início do intervalo escolhido vira a "referência" de mês. A aba "Fluxo"
 * (saldo atual, projeção, próximos lançamentos) não depende de período —
 * é sempre "agora pra frente" — então não é afetada por este filtro.
 */
export default async function FinanceiroFluxoPage({ searchParams }: PageProps) {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "dashboard.financeiro")) {
    return <AcessoNegado />;
  }

  const params = await searchParams;
  const intervaloPadrao = calcularPresetEsteMes(contexto.fusoHorario);

  const inicioTexto = obterParam(params, "inicio");
  const fimTexto = obterParam(params, "fim");
  const inicioValido = inicioTexto ? dataDeCalendario(inicioTexto) : null;
  const fimValido = fimTexto ? dataDeCalendario(fimTexto) : null;
  const referencia =
    inicioValido && fimValido && validarIntervalo(inicioValido, fimValido).valido
      ? inicioValido
      : intervaloPadrao.inicio;

  const [dadosFluxo, dadosResultado] = await Promise.all([
    obterDadosFluxoDeCaixa(),
    obterDadosResultadoPeriodo(referencia),
  ]);

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Financeiro</span>
        <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">Fluxo e relatórios</span>
      </div>

      <NavFinanceiro />

      <Suspense fallback={<div className="h-11 shrink-0 animate-pulse rounded-kx-botao bg-kx-superficie" />}>
        <FiltroPeriodoPagina
          campos={[{ valor: "referencia", rotulo: "Período" }]}
          fusoHorario={contexto.fusoHorario}
        />
      </Suspense>

      <ConteudoFluxo dadosFluxo={dadosFluxo} dadosResultado={dadosResultado} />
    </div>
  );
}
