import Link from "next/link";
import { Card } from "@/components/ui/card";

type MetaPrioritaria = {
  id: string;
  titulo: string;
  progresso: number;
  status: string;
};

type ResumoMetas = {
  emAndamento: number;
  emAtencao: number;
  atrasadas: number;
  principais: MetaPrioritaria[];
};

type ResumoMetasDashboardProps = {
  resumo?: ResumoMetas;
};

export function ResumoMetasDashboard({ resumo }: ResumoMetasDashboardProps) {
  if (!resumo) {
    return null;
  }

  return (
    <Card className="border-zinc-800 bg-slate-950/40 p-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">Metas em andamento</h2>
          <Link href="/metas" className="text-xs text-sky-300 hover:text-sky-200">
            Ver modulo
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-xs text-zinc-400">Em andamento</p>
            <p className="text-sm font-semibold text-white">{resumo.emAndamento}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-xs text-zinc-400">Em atencao</p>
            <p className="text-sm font-semibold text-amber-300">{resumo.emAtencao}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-xs text-zinc-400">Atrasadas</p>
            <p className="text-sm font-semibold text-red-300">{resumo.atrasadas}</p>
          </div>
        </div>

        <div className="space-y-2">
          {resumo.principais.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem metas prioritarias no momento.</p>
          ) : (
            resumo.principais.map((meta) => (
              <div key={meta.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm text-zinc-100">{meta.titulo}</p>
                  <span className="text-xs text-zinc-400">{meta.status}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${Math.max(0, Math.min(meta.progresso, 100))}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
