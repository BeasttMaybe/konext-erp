import { Card } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";

type VariacaoPercentual = {
  tipo: "percentual" | "sem_base" | "sem_variacao";
  valor?: number;
  texto: string;
};

type CardExecutivoProps = {
  titulo: string;
  valor: string;
  descricao?: string;
  variacao?: VariacaoPercentual;
  destaque?: "verde" | "azul" | "ambar" | "vermelho";
  rodape?: string;
  icone?: React.ReactNode;
};

const mapaDestaque: Record<NonNullable<CardExecutivoProps["destaque"]>, string> = {
  verde: "border-emerald-500/30 bg-emerald-500/5",
  azul: "border-blue-500/30 bg-blue-500/5",
  ambar: "border-amber-500/30 bg-amber-500/5",
  vermelho: "border-red-500/30 bg-red-500/5",
};

export function CardExecutivo({
  titulo,
  valor,
  descricao,
  variacao,
  destaque = "azul",
  rodape,
  icone,
}: CardExecutivoProps) {
  const corContainer = mapaDestaque[destaque];
  const mostrarPercentual = variacao?.tipo === "percentual" && typeof variacao.valor === "number";

  return (
    <Card className={`border ${corContainer} p-5`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-zinc-300">{titulo}</p>
          {icone ? <div className="text-zinc-400">{icone}</div> : null}
        </div>

        <div>
          <p className="text-2xl font-bold text-white">{valor}</p>
          {descricao ? <p className="mt-1 text-xs text-zinc-400">{descricao}</p> : null}
        </div>

        {variacao ? (
          <div className="text-xs text-zinc-400">
            {mostrarPercentual ? (
              <span className="inline-flex items-center gap-1">
                {Number(variacao.valor) >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className={Number(variacao.valor) >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {Number(variacao.valor) >= 0 ? "+" : ""}
                  {Number(variacao.valor).toFixed(1)}%
                </span>
                <span>vs. mes anterior</span>
              </span>
            ) : (
              <span>{variacao.texto}</span>
            )}
          </div>
        ) : null}

        {rodape ? <p className="text-xs text-zinc-400">{rodape}</p> : null}
      </div>
    </Card>
  );
}
