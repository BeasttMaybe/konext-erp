"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

/**
 * Filtro de categoria de cliente de Contas a Receber (Fase 3-2D, Parte 2) —
 * estado via URL, sem useState. Período (antes Mês/Ano/"Todas as contas")
 * saiu daqui na Fase 2A-1: vive agora no `FiltroPeriodo`, renderizado ao
 * lado deste componente em `page.tsx`. As pílulas de status (Em aberto/
 * Atrasados/Recebidos/Todos) ficam em ConteudoReceber — filtram
 * client-side a lista já buscada, não duplicam outra ida ao servidor.
 */
export function FiltrosReceber() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  function limparFiltroDeCategoria() {
    atualizarFiltro("categoriaCliente", "");
  }

  return (
    <div className="flex shrink-0 flex-wrap items-end gap-3">
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

      {categoriaCliente && (
        <Button variant="ghost" size="sm" onClick={limparFiltroDeCategoria} className="text-kx-legenda">
          <X className="mr-1 h-4 w-4" />
          Limpar categoria
        </Button>
      )}
    </div>
  );
}
