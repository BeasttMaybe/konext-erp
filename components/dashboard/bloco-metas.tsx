import Link from "next/link";
import type { DashboardExecutivo } from "@/app/actions/dashboard";
import { CabecalhoCard } from "./cabecalho-card";
import { Superficie, formatarPercentual } from "@/components/ui/pagina";

type BlocoMetasProps = {
  resumo: NonNullable<DashboardExecutivo["metasResumo"]>;
};

export function BlocoMetas({ resumo }: BlocoMetasProps) {
  return (
    <Superficie className="gap-0 p-0">
      <CabecalhoCard
        titulo="Metas"
        acao={
          <Link href="/metas" className="hover:text-foreground">
            Abrir metas ↗
          </Link>
        }
      />

      <ul className="px-3 pb-3 pt-2.5">
        {resumo.principais.map((meta) => (
          <li
            key={meta.id}
            className="flex items-center gap-3 border-b border-border/60 py-[7px] last:border-0"
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-foreground">
                {meta.titulo}
              </span>
              <span className="block text-[11px] text-muted-foreground">{meta.status}</span>
            </div>

            <div className="h-[5px] w-24 overflow-hidden rounded-[3px] bg-muted">
              <span
                className="block h-[5px] rounded-[3px]"
                style={{
                  width: `${Math.max(0, Math.min(100, meta.progresso))}%`,
                  backgroundColor: "var(--receita)",
                }}
              />
            </div>

            <span className="w-[34px] text-right text-[12px] tabular-nums text-foreground">
              {formatarPercentual(meta.progresso)}
            </span>
          </li>
        ))}
      </ul>
    </Superficie>
  );
}
