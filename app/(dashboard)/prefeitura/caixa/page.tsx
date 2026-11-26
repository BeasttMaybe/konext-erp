import { HandCoins, Landmark } from "lucide-react";

import { obterCaixaPrefeitura } from "@/app/actions/prefeitura";
import { CaixaBloco } from "@/components/prefeitura/caixa-bloco";
import { SeletorPrefeitura } from "@/components/prefeitura/seletor-prefeitura";
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { calcularPresetEsteMes, validarIntervalo } from "@/lib/filtro-periodo";
import { dataDeCalendario } from "@/lib/datas";

export const metadata = { title: "Caixa | Prefeitura | TechOS" };

const umParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const paraUrl = (d: Date) =>
  `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CaixaPrefeituraPage({ searchParams }: Props) {
  const { fusoHorario } = await exigirContextoTenant();
  const sp = await searchParams;

  const cliente = umParam(sp.cliente)?.trim() || undefined;

  // Período por VENCIMENTO, abrindo no mês atual (igual à tela de resultado).
  const intervaloPadrao = calcularPresetEsteMes(fusoHorario);
  const inicioParam = umParam(sp.inicio);
  const fimParam = umParam(sp.fim);
  const inicioValido = inicioParam ? dataDeCalendario(inicioParam) : null;
  const fimValido = fimParam ? dataDeCalendario(fimParam) : null;
  const periodoSel =
    inicioValido && fimValido && validarIntervalo(inicioValido, fimValido).valido
      ? { inicio: inicioValido, fim: fimValido }
      : intervaloPadrao;

  const caixa = await obterCaixaPrefeitura({ cliente, de: paraUrl(periodoSel.inicio), ate: paraUrl(periodoSel.fim) });

  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs text-kx-legenda">
          <Landmark className="h-3.5 w-3.5" /> Prefeitura
        </span>
        <h1 className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight text-kx-texto">
          <HandCoins className="h-5 w-5" aria-hidden /> Caixa
        </h1>
        <p className="text-sm text-kx-legenda">
          Contas a receber da prefeitura: o que vence (e venceu) no período, o que já entrou e em quantos dias, em média, a prefeitura paga.
        </p>
      </div>

      {caixa.prefeituras.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-3">
          <SeletorPrefeitura prefeituras={caixa.prefeituras} selecionada={caixa.filtros.cliente} />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">Vencimento</span>
            <FiltroPeriodoPagina campos={[{ valor: "vencimento", rotulo: "Vencimento" }]} fusoHorario={fusoHorario} />
          </div>
        </div>
      ) : null}

      <CaixaBloco caixa={caixa} />
    </div>
  );
}
