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
 * Barra de filtros para Contas a Pagar.
 * Gerencia estado exclusivamente via URL Search Params — sem useState para filtros.
 */
export function FiltrosPagar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Adota o mês e ano correntes como padrão quando não informados na URL.
  const hoje = new Date();
  const mes = searchParams.get("mes") ?? String(hoje.getMonth() + 1);
  const ano = searchParams.get("ano") ?? String(hoje.getFullYear());
  const categoriaCliente = searchParams.get("categoriaCliente") ?? "";

  function atualizarFiltro(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) {
      params.set(chave, valor);
    } else {
      params.delete(chave);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function limparFiltros() {
    router.push(pathname);
  }

  // Considera filtros "ativos" quando difere dos padrões do mês corrente ou há categoria selecionada.
  const mesHoje = String(hoje.getMonth() + 1);
  const anoHoje = String(hoje.getFullYear());
  const temFiltrosAtivos =
    categoriaCliente || mes !== mesHoje || ano !== anoHoje;

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Filtro: Mês */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Mês</p>
        <Select value={mes} onValueChange={(v) => atualizarFiltro("mes", v)}>
          <SelectTrigger className="w-40">
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

      {/* Filtro: Ano */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Ano</p>
        <Input
          type="number"
          min={2020}
          max={2050}
          value={ano}
          onChange={(e) => atualizarFiltro("ano", e.target.value)}
          className="w-24"
        />
      </div>

      {/* Filtro: Categoria de Cliente */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Categoria de Cliente</p>
        <Select
          value={categoriaCliente || undefined}
          onValueChange={(v) => atualizarFiltro("categoriaCliente", v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CLIENTE_FINAL">Cliente Final</SelectItem>
            <SelectItem value="EMPRESA">Empresa</SelectItem>
            <SelectItem value="ORGAO_PUBLICO">Órgão Público</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Botão para limpar filtros ativos */}
      {temFiltrosAtivos && (
        <Button variant="ghost" size="sm" onClick={limparFiltros} className="self-end">
          <X className="h-4 w-4 mr-1" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
