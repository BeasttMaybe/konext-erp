import Link from "next/link";
import type { LinhaFilaOS } from "@/app/actions/dashboard";
import { CabecalhoCard } from "./cabecalho-card";
import { Superficie, formatarNumero } from "@/components/ui/pagina";

type FilaOsProps = {
  fila: LinhaFilaOS[];
};

// Rampa ordinal de matiz única: a posição na fila define o passo, não o valor.
function corDaFaixa(indice: number, total: number): string {
  const passo = Math.min(3, Math.floor((indice * 4) / Math.max(1, total)));
  return `var(--fila-os-${passo + 1})`;
}

export function FilaOs({ fila }: FilaOsProps) {
  const maiorQuantidade = fila.reduce((maior, linha) => Math.max(maior, linha.quantidade), 0);

  return (
    <Superficie className="gap-0 p-0">
      <CabecalhoCard
        titulo="Fila de OS por status"
        acao={
          <Link href="/os?modo=kanban" className="hover:text-foreground">
            Ver todas ↗
          </Link>
        }
      />

      <ul className="flex flex-col gap-[7px] px-3 pb-3 pt-2.5">
        {fila.map((linha, indice) => {
          const proporcao = maiorQuantidade > 0 ? (linha.quantidade / maiorQuantidade) * 100 : 0;

          return (
            <li key={linha.status}>
              <Link
                href={linha.href}
                className="group grid grid-cols-[9.5rem_minmax(0,1fr)_2rem] items-center gap-2.5"
              >
                <span className="truncate text-[12px] text-muted-foreground group-hover:text-foreground group-hover:underline">
                  {linha.label}
                </span>

                {/* Fila em zero mostra o trilho, nunca uma barra preenchida. */}
                <span className="block h-[7px] rounded-[3px] bg-muted" aria-hidden="true">
                  {linha.quantidade > 0 ? (
                    <span
                      className="block h-[7px] rounded-[3px]"
                      style={{
                        width: `${proporcao}%`,
                        backgroundColor: corDaFaixa(indice, fila.length),
                      }}
                    />
                  ) : null}
                </span>

                <span className="text-right text-[12.5px] tabular-nums text-foreground">
                  {formatarNumero(linha.quantidade)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Superficie>
  );
}
