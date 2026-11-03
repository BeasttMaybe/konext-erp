"use client";

import { Search } from "lucide-react";

import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { Input } from "@/components/ui/input";
import type { FiltrosGarantiaInput, SituacaoGarantia } from "@/app/actions/garantias";

/**
 * Filtros das Garantias.
 *
 * Antes eram: uma busca, dois `select` (status e retorno) e dois campos
 * `dd/mm/aaaa` crus, tudo numa grade de seis colunas. Dois problemas, e o
 * segundo era grave:
 *
 * 1. Os campos de data eram `<input type="date">` soltos, diferentes do
 *    filtro de período que o resto do sistema usa.
 * 2. O `select` de status filtrava DEPOIS da paginação, em memória — ou seja,
 *    escolher "Vencidas" filtrava apenas as 20 linhas da página aberta, e o
 *    total continuava sendo o de tudo. O filtro parecia funcionar e mentia.
 *
 * Agora as situações são ABAS, todas resolvidas no banco, e "vencidas" tem
 * aba própria — que é o que separa o que ainda vale do que já expirou.
 */

const ABAS: ReadonlyArray<{ valor: SituacaoGarantia; rotulo: string; ajuda: string }> = [
  {
    valor: "VIGENTES",
    rotulo: "Vigentes",
    ajuda: "A garantia ainda está valendo.",
  },
  {
    valor: "VENCENDO",
    rotulo: "Vencendo",
    ajuda: "Acaba nos próximos 7 dias.",
  },
  {
    valor: "VENCIDAS",
    rotulo: "Vencidas",
    ajuda: "O prazo já passou — a loja não deve mais cobertura.",
  },
  {
    valor: "COM_RETORNO",
    rotulo: "Com retorno",
    ajuda: "O aparelho voltou pelo menos uma vez.",
  },
  {
    valor: "CANCELADAS",
    rotulo: "Canceladas",
    ajuda: "Termo cancelado, ou OS excluída.",
  },
  { valor: "TODAS", rotulo: "Todas", ajuda: "Sem recorte." },
];

export function FiltrosGarantias({
  filtros,
  onChange,
  fusoHorario,
  totalEncontrado,
}: {
  filtros: FiltrosGarantiaInput;
  onChange: (filtros: FiltrosGarantiaInput) => void;
  fusoHorario?: string;
  /** Quantas linhas o filtro atual encontrou, para a tela dizer o tamanho do recorte. */
  totalEncontrado: number | null;
}) {
  const situacaoAtual = filtros.situacao ?? "VIGENTES";

  return (
    <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-cartao p-kx-4">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Situação da garantia">
        {ABAS.map((aba) => {
          const selecionada = situacaoAtual === aba.valor;

          return (
            <button
              key={aba.valor}
              type="button"
              role="tab"
              aria-selected={selecionada}
              title={aba.ajuda}
              onClick={() => onChange({ ...filtros, situacao: aba.valor, pagina: 1 })}
              className={
                selecionada
                  ? "rounded-kx-pilula bg-kx-primaria px-3.5 py-1.5 text-sm font-semibold text-primary-foreground"
                  : "rounded-kx-pilula border border-kx-painel-borda px-3.5 py-1.5 text-sm font-medium text-kx-texto-2 hover:text-kx-texto"
              }
            >
              {aba.rotulo}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda"
            aria-hidden
          />
          <Input
            id="busca-garantias"
            value={filtros.busca ?? ""}
            onChange={(evento) => onChange({ ...filtros, busca: evento.target.value, pagina: 1 })}
            placeholder="Cliente, nº da OS, telefone, aparelho ou IMEI"
            aria-label="Buscar garantias"
            className="pl-9"
          />
        </div>

        {/* O mesmo filtro de período de Finalizadas e Entregues, e das outras
            seis telas: presets, dois calendários e intervalo — no lugar dos
            dois campos de data soltos. */}
        <FiltroPeriodoPagina
          campos={[{ valor: "garantia-iniciada-em", rotulo: "Garantia iniciada em" }]}
          fusoHorario={fusoHorario}
        />
      </div>

      <p className="text-xs text-kx-legenda">
        {totalEncontrado === null
          ? "Carregando..."
          : totalEncontrado === 1
            ? "1 garantia encontrada"
            : `${totalEncontrado} garantias encontradas`}
        {" · "}
        {ABAS.find((aba) => aba.valor === situacaoAtual)?.ajuda}
      </p>
    </div>
  );
}
