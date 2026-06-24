import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AlertaHoje = {
  tipo: string;
  titulo: string;
  descricao: string;
  valor?: number;
  href?: string;
  criticidade: "INFO" | "ATENCAO" | "CRITICO";
};

type BlocoAtencaoHojeProps = {
  alertas: AlertaHoje[];
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const mapaCriticidade: Record<AlertaHoje["criticidade"], string> = {
  INFO: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  ATENCAO: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  CRITICO: "bg-red-500/20 text-red-300 border-red-500/30",
};

export function BlocoAtencaoHoje({ alertas }: BlocoAtencaoHojeProps) {
  return (
    <Card className="border-zinc-800 bg-slate-950/40 p-5">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
          <h2 className="text-base font-semibold text-white">Atencao hoje</h2>
        </div>

        {alertas.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-400">
            Nenhum alerta critico para hoje.
          </p>
        ) : (
          <div className="space-y-3">
            {alertas.map((alerta) => {
              const conteudo = (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{alerta.titulo}</p>
                    <Badge className={mapaCriticidade[alerta.criticidade]}>{alerta.criticidade}</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">{alerta.descricao}</p>
                  {typeof alerta.valor === "number" ? (
                    <p className="mt-2 text-xs font-medium text-zinc-200">Valor: {formatarMoeda(alerta.valor)}</p>
                  ) : null}
                </div>
              );

              return alerta.href ? (
                <Link key={`${alerta.tipo}-${alerta.titulo}`} href={alerta.href} className="block">
                  {conteudo}
                </Link>
              ) : (
                <div key={`${alerta.tipo}-${alerta.titulo}`}>{conteudo}</div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
