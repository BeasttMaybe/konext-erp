"use client";

import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface BarraAcaoLoteProps {
  quantidade: number;
  total: number;
  rotuloAcaoPrincipal: string;
  onAcaoPrincipal: () => void;
  onLimparSelecao: () => void;
}

/**
 * Barra de ações em lote (Fase 3-2D, Parte 5) — aparece só quando há
 * seleção, mesmo componente pra A receber e A pagar. "Exportar
 * selecionadas" fica desabilitado com nota — mesma lógica de Relatórios
 * (Parte 4): não existe exportação no projeto, então nada de simular.
 */
export function BarraAcaoLote({ quantidade, total, rotuloAcaoPrincipal, onAcaoPrincipal, onLimparSelecao }: BarraAcaoLoteProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-kx-painel border border-kx-primaria/40 bg-kx-primaria/10 px-4 py-2.5">
      <span className="text-sm font-bold text-kx-texto">
        {quantidade} {quantidade === 1 ? "selecionado" : "selecionados"} · {formatarMoeda(total)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled title="Exportação ainda não foi implementada nesta fase" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Exportar selecionadas
        </Button>
        <Button type="button" size="sm" onClick={onAcaoPrincipal} className="rounded-kx-botao">
          {rotuloAcaoPrincipal}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onLimparSelecao} className="gap-1 text-kx-legenda">
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>
    </div>
  );
}
