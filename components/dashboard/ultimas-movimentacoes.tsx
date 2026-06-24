import Link from "next/link";
import { Card } from "@/components/ui/card";

type Movimentacao = {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo?: string;
  valor?: number;
  data: string;
  status: string;
  href?: string;
};

type UltimasMovimentacoesProps = {
  itens: Movimentacao[];
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function UltimasMovimentacoes({ itens }: UltimasMovimentacoesProps) {
  return (
    <Card className="border-zinc-800 bg-slate-950/40 p-5">
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white">Ultimas movimentacoes</h2>

        {itens.length === 0 ? (
          <p className="text-sm text-zinc-400">Sem movimentacoes relevantes no periodo.</p>
        ) : (
          <div className="space-y-2">
            {itens.map((item) => {
              const valorNumero = typeof item.valor === "number" ? item.valor : null;
              const valorTexto =
                valorNumero === null
                  ? null
                  : `${valorNumero >= 0 ? "+" : "-"}${moeda.format(Math.abs(valorNumero))}`;

              const linha = (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{item.titulo}</p>
                      {item.subtitulo ? <p className="text-xs text-zinc-400">{item.subtitulo}</p> : null}
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">
                        {item.tipo} • {item.status} • {new Date(item.data).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {valorTexto ? (
                      <p className={`text-sm font-semibold ${valorNumero !== null && valorNumero >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {valorTexto}
                      </p>
                    ) : null}
                  </div>
                </div>
              );

              return item.href ? (
                <Link key={item.id} href={item.href} className="block">
                  {linha}
                </Link>
              ) : (
                <div key={item.id}>{linha}</div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
