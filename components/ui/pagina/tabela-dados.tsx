import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EstadoVazio } from "./estado-vazio";

export type ColunaTabela<T> = {
  chave: string;
  titulo: string;
  /** Números vão alinhados à direita e com `tabular-nums`. */
  numerica?: boolean;
  className?: string;
  renderizar: (linha: T) => ReactNode;
};

type TabelaDadosProps<T> = {
  colunas: readonly ColunaTabela<T>[];
  linhas: readonly T[];
  chaveLinha: (linha: T) => string;
  mensagemVazia: string;
  /**
   * Torna a linha navegável. O link fica na primeira célula (linha inteira como link
   * não é HTML válido) e a linha inteira ganha realce no hover.
   */
  hrefLinha?: (linha: T) => string;
};

export function TabelaDados<T>({
  colunas,
  linhas,
  chaveLinha,
  mensagemVazia,
  hrefLinha,
}: TabelaDadosProps<T>) {
  if (linhas.length === 0) {
    return <EstadoVazio mensagem={mensagemVazia} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {colunas.map((coluna) => (
              <th
                key={coluna.chave}
                scope="col"
                className={cn("py-2 pr-3 font-normal last:pr-0", coluna.numerica && "text-right")}
              >
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const href = hrefLinha?.(linha);

            return (
              <tr
                key={chaveLinha(linha)}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  href && "hover:bg-muted/40"
                )}
              >
                {colunas.map((coluna, indice) => {
                  const conteudo = coluna.renderizar(linha);

                  return (
                    <td
                      key={coluna.chave}
                      className={cn(
                        "py-2 pr-3 last:pr-0",
                        coluna.numerica ? "text-right tabular-nums text-foreground" : "text-muted-foreground",
                        coluna.className
                      )}
                    >
                      {href && indice === 0 ? (
                        <Link href={href} className="text-foreground hover:underline">
                          {conteudo}
                        </Link>
                      ) : (
                        conteudo
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
