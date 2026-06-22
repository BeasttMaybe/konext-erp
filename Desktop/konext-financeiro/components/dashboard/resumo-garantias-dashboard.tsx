import Link from "next/link";
import { Card } from "@/components/ui/card";

type ResumoGarantias = {
  ativas: number;
  vencem7Dias: number;
  retornosEmAndamento: number;
  retornosFinalizadosMes: number;
  taxaRetorno: number;
};

type ResumoGarantiasDashboardProps = {
  resumo?: ResumoGarantias;
};

export function ResumoGarantiasDashboard({ resumo }: ResumoGarantiasDashboardProps) {
  if (!resumo) {
    return null;
  }

  return (
    <Card className="border-zinc-800 bg-slate-950/40 p-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">Garantias e retornos</h2>
          <Link href="/os/garantias" className="text-xs text-sky-300 hover:text-sky-200">
            Ver modulo
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-xs text-zinc-400">Ativas</p>
            <p className="text-sm font-semibold text-white">{resumo.ativas}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-xs text-zinc-400">Vencem em 7 dias</p>
            <p className="text-sm font-semibold text-amber-300">{resumo.vencem7Dias}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-xs text-zinc-400">Retornos em andamento</p>
            <p className="text-sm font-semibold text-red-300">{resumo.retornosEmAndamento}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-xs text-zinc-400">Finalizados no mes</p>
            <p className="text-sm font-semibold text-emerald-300">{resumo.retornosFinalizadosMes}</p>
          </div>
        </div>

        <p className="text-xs text-zinc-400">Taxa de retorno: {resumo.taxaRetorno.toFixed(2)}%</p>
      </div>
    </Card>
  );
}
