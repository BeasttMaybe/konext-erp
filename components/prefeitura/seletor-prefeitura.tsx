"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  prefeituras: string[];
  selecionada: string | null;
};

export function SeletorPrefeitura({ prefeituras, selecionada }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendente, iniciar] = useTransition();

  const trocar = (valor: string) => {
    // Preserva os outros filtros (inicio/fim/campo do período); só mexe no cliente.
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("cliente", valor);
    else params.delete("cliente");
    const qs = params.toString();
    iniciar(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  return (
    <label className="flex min-w-[200px] flex-1 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-kx-legenda">
        Prefeitura
        {pendente ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
      </span>
      <select
        className="rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 py-2 text-sm text-kx-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco"
        value={selecionada ?? ""}
        onChange={(e) => trocar(e.target.value)}
      >
        <option value="">Todas as prefeituras</option>
        {prefeituras.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}
