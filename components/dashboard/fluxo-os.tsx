import Link from "next/link";
import type { LinhaFluxoEtapaHome } from "@/app/actions/dashboard";
import type { EtapaOS } from "@/lib/dominio/os/etapas";
import { Painel } from "@/components/ui/painel";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { CabecalhoCard } from "./cabecalho-card";
import { cn } from "@/lib/utils";
import { formatarNumero } from "@/components/ui/pagina";

type FluxoOsProps = {
  fluxoEtapas: LinhaFluxoEtapaHome[];
};

const CLASSE_BG_ETAPA: Record<EtapaOS, string> = {
  ORCAMENTO: "bg-kx-orcamento",
  CONSERTO: "bg-kx-conserto",
  PRONTO: "bg-kx-pronto",
  ENTREGUE: "bg-kx-entregue",
};

const CLASSE_TEXTO_ETAPA: Record<EtapaOS, string> = {
  ORCAMENTO: "text-kx-orcamento",
  CONSERTO: "text-kx-conserto",
  PRONTO: "text-kx-pronto",
  ENTREGUE: "text-kx-entregue",
};

/**
 * Fluxo de OS por etapa (Fase 3-2A) — substitui a fila por `status` legado
 * de 7 valores. O Kanban ainda não filtra por etapa/status via query string
 * (ver `app/actions/dashboard.ts`), então toda linha abre o Kanban sem recorte.
 */
export function FluxoOs({ fluxoEtapas }: FluxoOsProps) {
  const total = fluxoEtapas.reduce((soma, linha) => soma + linha.quantidade, 0);

  return (
    <Painel>
      <CabecalhoCard
        titulo="Fluxo de OS"
        acao={
          <Link href="/os?modo=kanban" className="hover:text-kx-texto">
            Abrir Kanban ↗
          </Link>
        }
      />

      <div className="px-kx-4 pb-kx-4 pt-kx-3">
        {total === 0 ? (
          <EstadoVazio titulo="Nenhuma OS em aberto" descricao="Assim que uma OS for aberta, ela aparece aqui." />
        ) : (
          <>
            <div className="mb-kx-4 flex h-2 w-full overflow-hidden rounded-full bg-kx-superficie" aria-hidden="true">
              {fluxoEtapas.map((linha) =>
                linha.quantidade > 0 ? (
                  <span
                    key={linha.etapa}
                    className={cn("h-full", CLASSE_BG_ETAPA[linha.etapa])}
                    style={{ width: `${(linha.quantidade / total) * 100}%` }}
                  />
                ) : null
              )}
            </div>

            <ul className="flex flex-col gap-kx-1">
              {fluxoEtapas.map((linha) => (
                <li key={linha.etapa}>
                  <Link
                    href={linha.href}
                    className="flex items-center justify-between gap-3 rounded-kx-botao px-2 py-1.5 hover:bg-kx-superficie"
                  >
                    <span className="flex items-center gap-2 text-sm text-kx-texto">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", CLASSE_BG_ETAPA[linha.etapa])} aria-hidden="true" />
                      {linha.label}
                    </span>
                    <span className={cn("text-sm font-semibold tabular-nums", CLASSE_TEXTO_ETAPA[linha.etapa])}>
                      {formatarNumero(linha.quantidade)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Painel>
  );
}
