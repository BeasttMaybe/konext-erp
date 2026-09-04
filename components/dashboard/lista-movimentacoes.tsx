import Link from "next/link";
import type { DashboardExecutivo } from "@/app/actions/dashboard";
import { Superficie, formatarDataCurta, formatarMoeda } from "@/components/ui/pagina";

type ListaMovimentacoesProps = {
  itens: DashboardExecutivo["ultimasMovimentacoes"];
};

export function ListaMovimentacoes({ itens }: ListaMovimentacoesProps) {
  return (
    <Superficie className="gap-0 p-0">
      <div className="flex items-center justify-between gap-2.5 border-b border-border/60 px-3 py-2.5">
        <h2 className="text-[12.5px] font-semibold text-foreground">Últimas movimentações</h2>
        <Link href="/financeiro" className="text-[11.5px] text-muted-foreground hover:text-foreground">
          Ver histórico ↗
        </Link>
      </div>

      <div className="px-3 pb-3 pt-2.5">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <table className="w-full text-[12.5px]">
            <tbody>
              {itens.map((item) => {
                const valor = typeof item.valor === "number" ? item.valor : null;
                const entrada = valor !== null && valor >= 0;

                const descricao = (
                  <td className="border-b border-border/60 py-1.5 pr-3">
                    <span className="block truncate text-foreground">{item.titulo}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {formatarDataCurta(item.data)}
                      {item.subtitulo ? ` · ${item.subtitulo}` : ""}
                    </span>
                  </td>
                );

                return (
                  <tr key={item.id}>
                    {item.href ? (
                      <td className="border-b border-border/60 py-1.5 pr-3">
                        <Link href={item.href} className="block hover:underline">
                          <span className="block truncate text-foreground">{item.titulo}</span>
                          <span className="block truncate text-[11.5px] text-muted-foreground">
                            {formatarDataCurta(item.data)}
                            {item.subtitulo ? ` · ${item.subtitulo}` : ""}
                          </span>
                        </Link>
                      </td>
                    ) : (
                      descricao
                    )}

                    {valor === null ? (
                      <td className="border-b border-border/60 py-1.5" />
                    ) : (
                      <td
                        className="whitespace-nowrap border-b border-border/60 py-1.5 text-right tabular-nums"
                        style={{ color: entrada ? "var(--t-verde)" : "var(--t-vermelho)" }}
                      >
                        {/* O sinal é encoding secundário obrigatório, não enfeite. */}
                        {entrada ? "+" : "−"} {formatarMoeda(Math.abs(valor))}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Superficie>
  );
}
