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
 * Período e categoria de Contas a Receber (Fase 3-2D, Parte 2) — estado via
 * URL, sem useState. As pílulas de status (Em aberto/Atrasados/Recebidos/
 * Todos) ficam em ConteudoReceber — filtram client-side a lista já
 * buscada pelo período daqui, não duplicam outra ida ao servidor.
 */
export function FiltrosReceber() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoje = new Date();
  const mes = searchParams.get("mes") ?? String(hoje.getMonth() + 1);
  const ano = searchParams.get("ano") ?? String(hoje.getFullYear());
  const categoriaCliente = searchParams.get("categoriaCliente") ?? "";
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
  const temFiltrosAtivos = categoriaCliente || mes !== mesHoje || ano !== anoHoje || todasAsContas;

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

      <div className="space-y-1">
        <p className="text-xs font-medium text-kx-legenda">Categoria de Cliente</p>
        <Select value={categoriaCliente || undefined} onValueChange={(v) => atualizarFiltro("categoriaCliente", v)}>
          <SelectTrigger className="h-10 w-48 rounded-kx-botao border-kx-campo-borda bg-kx-superficie">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CLIENTE_FINAL">Cliente Final</SelectItem>
            <SelectItem value="EMPRESA">Empresa</SelectItem>
            <SelectItem value="ORGAO_PUBLICO">Órgão Público</SelectItem>
          </SelectContent>
        </Select>
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
