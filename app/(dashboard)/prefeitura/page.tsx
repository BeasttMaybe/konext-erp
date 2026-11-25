import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, Landmark, Percent, Receipt, TrendingUp, Wallet } from "lucide-react";

import { obterPainelPrefeitura, type ResumoNotaPrefeitura } from "@/app/actions/prefeitura";
import { FiltrosPrefeitura } from "@/components/prefeitura/filtros-prefeitura";
import { formatarReais } from "@/lib/dinheiro";

export const metadata = { title: "Prefeitura | TechOS" };

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

function Indicador({
  rotulo,
  valor,
  nota,
  icone: Icone,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  icone: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-kx-legenda">
        <Icone className="h-3.5 w-3.5" /> {rotulo}
      </span>
      <span className="text-2xl font-extrabold text-kx-texto">{valor}</span>
      {nota ? <span className="text-xs text-kx-legenda">{nota}</span> : null}
    </div>
  );
}

function LinhaNota({ nota }: { nota: ResumoNotaPrefeitura }) {
  return (
    <Link
      href={`/prefeitura/${nota.id}`}
      className="group flex items-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 transition-colors hover:border-kx-destaque focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-kx-texto">
            Nota {nota.numero}
            {nota.serie ? `/${nota.serie}` : ""}
          </span>
          <span className="text-xs text-kx-legenda">{data(nota.dataEmissao)}</span>
          {nota.custoCompleto ? null : (
            <span className="rounded-kx-pilula bg-kx-alerta-fundo px-2 py-0.5 text-[11px] font-bold text-kx-alerta-texto">
              {nota.temBaseDeCusto ? `faltam ${nota.itensSemCusto} custo(s)` : "sem custo"}
            </span>
          )}
        </div>
        <span className="truncate text-xs text-kx-legenda">{nota.clienteNome ?? nota.descricaoItens ?? "—"}</span>
      </div>

      <div className="hidden shrink-0 gap-6 sm:flex">
        <div className="flex flex-col items-end">
          <span className="text-[11px] uppercase tracking-wide text-kx-legenda">Receita</span>
          <span className="text-sm font-bold text-kx-texto">{formatarReais(nota.receitaCentavos)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] uppercase tracking-wide text-kx-legenda">Lucro bruto</span>
          <span className="text-sm font-bold text-kx-texto">{nota.custoCompleto ? formatarReais(nota.lucroBrutoCentavos) : "—"}</span>
        </div>
        <div className="flex w-14 flex-col items-end">
          <span className="text-[11px] uppercase tracking-wide text-kx-legenda">Margem</span>
          <span className="text-sm font-bold text-kx-texto">{nota.custoCompleto ? pct(nota.margemBrutaPct) : "—"}</span>
        </div>
      </div>

      <ArrowRight className="h-5 w-5 shrink-0 text-kx-legenda group-hover:text-kx-texto" aria-hidden />
    </Link>
  );
}

type Props = { searchParams: Promise<{ cliente?: string; de?: string; ate?: string }> };

export default async function PrefeituraPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { periodo, notas, prefeituras, filtros } = await obterPainelPrefeitura({ cliente: sp.cliente, de: sp.de, ate: sp.ate });
  const semNotasNoSistema = prefeituras.length === 0;

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs text-kx-legenda">
          <Landmark className="h-3.5 w-3.5" /> Vendas públicas
        </span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Prefeitura</h1>
        <p className="text-sm text-kx-legenda">
          Custo, lucro e margem das notas emitidas para a prefeitura — puxadas do Bling. Lance o custo de cada nota para apurar o lucro.
        </p>
      </div>

      {semNotasNoSistema ? (
        <div className="flex flex-col items-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-kx-botao bg-kx-info-fundo text-kx-info-texto">
            <Landmark className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-sm font-bold text-kx-texto">Nenhuma nota da prefeitura ainda</p>
          <p className="max-w-md text-sm text-kx-legenda">
            As notas aparecem aqui sozinhas quando o nome do cliente contém “prefeitura” ou “município”, ou quando o cliente está cadastrado
            como órgão público. Sincronize o Bling em Financeiro → Notas Fiscais para o reconhecimento rodar.
          </p>
          <Link
            href="/financeiro/notas-fiscais"
            className="rounded-kx-botao bg-kx-primaria px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            Ir para Notas Fiscais
          </Link>
        </div>
      ) : (
        <>
          <FiltrosPrefeitura prefeituras={prefeituras} filtros={filtros} />

          {notas.length === 0 ? (
            <p className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel px-4 py-10 text-center text-sm text-kx-legenda">
              Nenhuma nota da prefeitura com esse filtro. Ajuste a prefeitura ou o período.
            </p>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
            <Indicador rotulo="Receita" valor={formatarReais(periodo.receitaTotalCentavos)} nota={`${periodo.notas} nota(s)`} icone={Receipt} />
            <Indicador rotulo="Custo lançado" valor={formatarReais(periodo.custoLancadoCentavos)} icone={Wallet} />
            <Indicador
              rotulo="Lucro bruto"
              valor={formatarReais(periodo.lucroBrutoApuradoCentavos)}
              nota="das notas com custo"
              icone={TrendingUp}
            />
            <Indicador rotulo="Margem" valor={pct(periodo.margemBrutaPct)} icone={Percent} />
            <Indicador rotulo="Lucro líquido" valor={formatarReais(periodo.lucroLiquidoApuradoCentavos)} nota="− impostos" icone={Banknote} />
            <Indicador
              rotulo="Custo pendente"
              valor={`${periodo.notasComCustoPendente}`}
              nota="nota(s) a lançar"
              icone={Receipt}
            />
          </div>

          {periodo.notasComCustoPendente > 0 ? (
            <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-3 py-2 text-xs text-kx-legenda">
              O lucro e a margem consideram só as notas com custo totalmente lançado. Lance os custos das {periodo.notasComCustoPendente} nota(s)
              pendente(s) para o resultado ficar completo.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            {notas.map((nota) => (
              <LinhaNota key={nota.id} nota={nota} />
            ))}
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
