import { Suspense } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Repeat } from "lucide-react";
import {
  listarParcelasPagarFiltradas,
  obterResumoPagar,
} from "@/app/actions/financeiro-pagar";
import { NavFinanceiro } from "@/components/financeiro/nav-financeiro";
import { FiltrosPagar } from "./components/FiltrosPagar";
import { ConteudoPagar } from "./components/ConteudoPagar";
import { CartaoIndicador } from "@/components/ui/cartao-indicador";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

export const metadata = { title: "Contas a Pagar | Konext" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function obterParam(params: Record<string, string | string[] | undefined>, chave: string): string | undefined {
  const valor = params[chave];
  return Array.isArray(valor) ? valor[0] : valor;
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

/**
 * Contas a Pagar (Fase 3-2D, Parte 3) — referência:
 * docs/design/referencia-financeiro-pagar.html. "Categoria de Cliente"
 * sai daqui (não fazia sentido — despesa não tem cliente-devedor); Mês/Ano
 * continuam, com o mesmo "todasAsContas" da Parte 2.
 */
export default async function FinanceiroPagarPage({ searchParams }: PageProps) {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "financeiro.ver")) {
    return <AcessoNegado />;
  }

  const params = await searchParams;

  const filtros = {
    mes: obterParam(params, "mes"),
    ano: obterParam(params, "ano"),
    todoPeriodo: obterParam(params, "todasAsContas") === "1",
  };

  const [parcelas, resumo] = await Promise.all([
    listarParcelasPagarFiltradas(filtros),
    obterResumoPagar(filtros),
  ]);

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-5 pb-8 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Financeiro</span>
        <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">Contas a Pagar</span>
      </div>

      <NavFinanceiro />

      <div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <CartaoIndicador variante="erro" titulo="Atrasado" valor={formatarMoeda(resumo.totalAtrasado)} icone={<AlertTriangle />} />
        <CartaoIndicador variante="alerta" titulo="Pendente" valor={formatarMoeda(resumo.totalPendente)} icone={<CalendarClock />} />
        <CartaoIndicador variante="sucesso" titulo="Vence hoje" valor={formatarMoeda(resumo.venceHoje)} icone={<CheckCircle2 />} />
        <CartaoIndicador
          variante="primaria"
          titulo={filtros.todoPeriodo ? "Total (todas as contas)" : "Total no período"}
          valor={formatarMoeda(resumo.totalPeriodo)}
          icone={<Repeat />}
        />
      </div>

      <Suspense fallback={<div className="h-11 shrink-0 animate-pulse rounded-kx-botao bg-kx-superficie" />}>
        <FiltrosPagar />
      </Suspense>

      <ConteudoPagar parcelas={parcelas} />
    </div>
  );
}
