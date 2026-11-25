"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  prefeituras: string[];
  filtros: { cliente: string | null; de: string | null; ate: string | null };
};

export function FiltrosPrefeitura({ prefeituras, filtros }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const aplicar = (mudanca: Partial<{ cliente: string; de: string; ate: string }>) => {
    const atual = { cliente: filtros.cliente ?? "", de: filtros.de ?? "", ate: filtros.ate ?? "", ...mudanca };
    const params = new URLSearchParams();
    if (atual.cliente) params.set("cliente", atual.cliente);
    if (atual.de) params.set("de", atual.de);
    if (atual.ate) params.set("ate", atual.ate);
    const qs = params.toString();
    iniciar(() => router.push(qs ? `/prefeitura?${qs}` : "/prefeitura"));
  };

  const temFiltro = Boolean(filtros.cliente || filtros.de || filtros.ate);
  const campo = "rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 py-1.5 text-sm text-kx-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-3">
      <label className="flex min-w-[200px] flex-1 flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">Prefeitura</span>
        <select className={campo} value={filtros.cliente ?? ""} onChange={(e) => aplicar({ cliente: e.target.value })}>
          <option value="">Todas as prefeituras</option>
          {prefeituras.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">De</span>
        <input type="date" className={campo} value={filtros.de ?? ""} max={filtros.ate ?? undefined} onChange={(e) => aplicar({ de: e.target.value })} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">Até</span>
        <input type="date" className={campo} value={filtros.ate ?? ""} min={filtros.de ?? undefined} onChange={(e) => aplicar({ ate: e.target.value })} />
      </label>

      {pendente ? <Loader2 className="mb-2 h-4 w-4 animate-spin text-kx-legenda" aria-hidden /> : null}

      {temFiltro ? (
        <Button type="button" variant="ghost" size="sm" className={cn("mb-0.5", pendente && "opacity-60")} onClick={() => aplicar({ cliente: "", de: "", ate: "" })}>
          <X className="h-3.5 w-3.5" aria-hidden /> Limpar
        </Button>
      ) : null}
    </div>
  );
}
