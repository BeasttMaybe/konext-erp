"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

/**
 * Período de Contas a Pagar (Fase 3-2D, Parte 3) — igual à de A receber,
 * SEM o filtro "Categoria de Cliente": despesa não tem cliente-devedor, o
 * filtro nunca fazia sentido aqui (existia só porque o componente era
 * copiado do de A receber).
 */
export function FiltrosPagar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoje = new Date();
  const mes = searchParams.get("mes") ?? String(hoje.getMonth() + 1);
  const ano = searchParams.get("ano") ?? String(hoje.getFullYear());
  const todasAsContas = searchParams.get("todasAsContas") === "1";

  function atualizarFiltro(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) {
      params.set(chave, valor);
    } else {
      params.delete(chave);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function alternarTodasAsContas() {
    const params = new URLSearchParams(searchParams.toString());
    if (todasAsContas) {
      params.delete("todasAsContas");
    } else {
      params.set("todasAsContas", "1");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function limparFiltros() {
    router.push(pathname);
  }

  const mesHoje = String(hoje.getMonth() + 1);
  const anoHoje = String(hoje.getFullYear());
  const temFiltrosAtivos = mes !== mesHoje || ano !== anoHoje || todasAsContas;

  return (
    <div className="flex shrink-0 flex-wrap items-end gap-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-kx-legenda">Mês</p>
        <Select value={mes} onValueChange={(v) => atualizarFiltro("mes", v)} disabled={todasAsContas}>
          <SelectTrigger className="h-10 w-40 rounded-kx-botao border-kx-campo-borda bg-kx-superficie">
            <SelectValue placeholder="Todos os meses" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>
                {new Date(2024, m - 1).toLocaleDateString("pt-BR", { month: "long" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-kx-legenda">Ano</p>
        <Input
          type="number"
          min={2020}
          max={2050}
          value={ano}
          disabled={todasAsContas}
          onChange={(e) => atualizarFiltro("ano", e.target.value)}
          className="h-10 w-24 rounded-kx-botao border-kx-campo-borda bg-kx-superficie"
        />
      </div>

      <Button
        type="button"
        variant={todasAsContas ? "default" : "outline"}
        className="h-10 rounded-kx-botao text-sm font-semibold"
        onClick={alternarTodasAsContas}
      >
        Todas as contas
      </Button>

      {temFiltrosAtivos && (
        <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-kx-legenda">
          <X className="mr-1 h-4 w-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
