import Link from "next/link";
import type { MetasResumoDashboard } from "@/app/actions/dashboard";
import { Painel } from "@/components/ui/painel";
import { CabecalhoCard } from "./cabecalho-card";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Button } from "@/components/ui/button";
import { formatarPercentual } from "@/components/ui/pagina";

type MetasHomeProps = {
  resumo: MetasResumoDashboard;
};

/**
 * Metas do mês (Fase 3-2A). Sem metas em andamento, mostra UM `EstadoVazio`
 * compacto — nunca um anel de progresso vazio por meta faltando.
 */
export function MetasHome({ resumo }: MetasHomeProps) {
  return (
    <Painel>
      <CabecalhoCard
        titulo="Metas do mês"
        acao={
          <Link href="/metas" className="hover:text-kx-texto">
            Abrir metas ↗
          </Link>
        }
      />

      <div className="px-kx-4 pb-kx-4 pt-kx-3">
        {resumo.principais.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma meta em andamento"
            descricao="Defina uma meta para acompanhar o progresso aqui."
            acao={
              <Button asChild size="sm">
                <Link href="/metas">Definir metas</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-kx-3">
            {resumo.principais.map((meta) => (
              <li key={meta.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-kx-texto">{meta.titulo}</span>
                  <span className="shrink-0 tabular-nums text-kx-legenda">{formatarPercentual(meta.progresso)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-kx-superficie">
                  <div
                    className="h-full rounded-full bg-kx-primaria"
                    style={{ width: `${Math.max(0, Math.min(100, meta.progresso))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Painel>
  );
}

/** Skeleton das Metas do mês. */
export function MetasHomeCarregando() {
  return (
    <Painel>
      <CabecalhoCard titulo="Metas do mês" />
      <div className="flex flex-col gap-kx-3 px-kx-4 pb-kx-4 pt-kx-3">
        {Array.from({ length: 3 }).map((_, indice) => (
          <div key={indice} className="h-8 w-full animate-pulse rounded bg-kx-superficie" />
        ))}
      </div>
    </Painel>
  );
}
