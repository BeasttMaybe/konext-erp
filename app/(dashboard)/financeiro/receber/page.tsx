import { Suspense } from "react";
import {
  listarContasReceberFiltradas,
  obterResumoReceber,
} from "@/app/actions/financeiro-receber";
import { NavFinanceiro } from "@/components/financeiro/nav-financeiro";
import { FiltrosReceber } from "./components/FiltrosReceber";
import { ConteudoReceber } from "./components/ConteudoReceber";
import { CartaoIndicador } from "@/components/ui/cartao-indicador";
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { Wallet, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { AcessoNegado } from "@/components/ui/acesso-negado";

export const metadata = { title: "Contas a Receber | Konext" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function obterParam(
  params: Record<string, string | string[] | undefined>,
  chave: string
): string | undefined {
  const valor = params[chave];
  return Array.isArray(valor) ? valor[0] : valor;
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

/**
 * Contas a Receber (Fase 3-2D, Parte 2) — referência:
 * docs/design/referencia-financeiro-receber.html. Categoria de Cliente
 * continua existindo (URL: ?categoriaCliente=EMPRESA) — o que muda é o
 * "Dar baixa", que sai do menu de ações da linha e vira o painel lateral
 * fixo (ConteudoReceber), e o filtro de status, que vira pílulas
 * (client-side, sobre a lista já buscada — sem novo parâmetro de servidor).
 *
 * Fase 2A-1 (`FiltroPeriodo`): o Select de mês + Input de ano + botão
 * "Todas as contas" (antes em `FiltrosReceber`) deram lugar ao filtro de
 * período compartilhado, filtrando por `dataVencimento` via `?inicio=&fim=`
 * em vez de `?mes=&ano=`. "Todas as contas" não tem mais equivalente na
 * UI — "Período customizado" cobre o caso (a capacidade de pular a janela
 * inteira continua existindo na action, `todoPeriodo`, só usada
 * internamente pelos indicadores "em aberto" — ver `app/actions/financeiro-hub.ts`).
 */
export default async function FinanceiroReceberPage({ searchParams }: PageProps) {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "financeiro.ver")) {
    return <AcessoNegado />;
  }

  const params = await searchParams;

  const filtros = {
    inicio: obterParam(params, "inicio"),
    fim: obterParam(params, "fim"),
    categoriaCliente: obterParam(params, "categoriaCliente"),
  };

  const [contas, resumo] = await Promise.all([
    listarContasReceberFiltradas(filtros),
    obterResumoReceber(filtros),
  ]);

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Financeiro</span>
        <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">Contas a Receber</span>
      </div>

      <NavFinanceiro />

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:gap-3">
        <CartaoIndicador variante="alerta" titulo="Pendente" valor={formatarMoeda(resumo.totalPendente)} icone={<Wallet />} />
        <CartaoIndicador variante="erro" titulo="Atrasado" valor={formatarMoeda(resumo.totalAtrasado)} icone={<AlertTriangle />} />
        <CartaoIndicador variante="sucesso" titulo="Recebido" valor={formatarMoeda(resumo.totalRecebido)} icone={<CheckCircle2 />} />
        <CartaoIndicador
          variante="primaria"
          titulo="Total no período"
          valor={formatarMoeda(resumo.totalPeriodo)}
          icone={<TrendingUp />}
        />
      </div>

      <Suspense fallback={<div className="h-11 shrink-0 animate-pulse rounded-kx-botao bg-kx-superficie" />}>
        <div className="flex shrink-0 flex-wrap items-end gap-3">
          <FiltroPeriodoPagina
            campos={[{ valor: "vencimento", rotulo: "Vencimento" }]}
            fusoHorario={contexto.fusoHorario}
          />
          <FiltrosReceber />
        </div>
      </Suspense>

      <ConteudoReceber contas={contas} />
    </div>
  );
}
