import Link from "next/link";
import type { LinhaPendenciaHome } from "@/app/actions/dashboard";
import { Aviso } from "@/components/ui/aviso";
import { formatarMoeda } from "@/components/ui/pagina";

type PendenciasHomeProps = {
  itens: LinhaPendenciaHome[];
};

/**
 * Pendências operacionais + financeiras da home (Fase 3-2A). Sem itens, o
 * bloco simplesmente não aparece — mesma decisão da antiga `FaixaAcoes`, que
 * ela acertava; o bug que ela tinha era `truncate`/`overflow-hidden`/`shrink-0`
 * cortando os itens em vez de quebrar linha, corrigido aqui com `flex-wrap`.
 */
export function PendenciasHome({ itens }: PendenciasHomeProps) {
  if (itens.length === 0) {
    return null;
  }

  return (
    <Aviso variante="alerta" titulo={itens.length === 1 ? "1 pendência" : `${itens.length} pendências`}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {itens.map((item) => (
          <li key={item.chave}>
            <Link href={item.href} className="underline-offset-2 hover:underline">
              {item.texto}
              {item.valor === null ? "" : ` — ${formatarMoeda(item.valor)}`}
            </Link>
          </li>
        ))}
      </ul>
    </Aviso>
  );
}

/** Skeleton das Pendências. */
export function PendenciasHomeCarregando() {
  return <div className="h-16 w-full animate-pulse rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao" />;
}
