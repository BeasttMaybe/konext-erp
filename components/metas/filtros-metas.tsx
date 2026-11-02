"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { CategoriaMeta, StatusMeta, PrioridadeMeta } from "@prisma/client";
import type { FiltrosMetasInput } from "@/app/actions/metas";

type FiltrosMetasProps = {
  filtros: FiltrosMetasInput;
  onChange: (filtros: FiltrosMetasInput) => void;
};

export function FiltrosMetas({ filtros, onChange }: FiltrosMetasProps) {
  const set = (partial: Partial<FiltrosMetasInput>) =>
    onChange({ ...filtros, ...partial, pagina: 1 });

  const temFiltro =
    !!filtros.busca ||
    (!!filtros.categoria && filtros.categoria !== "TODAS") ||
    (!!filtros.status && filtros.status !== "TODAS") ||
    (!!filtros.prioridade && filtros.prioridade !== "TODAS") ||
    (!!filtros.origemProgresso && filtros.origemProgresso !== "TODAS");

  const limpar = () =>
    onChange({
      busca: "",
      categoria: "TODAS",
      status: "TODAS",
      prioridade: "TODAS",
      origemProgresso: "TODAS",
      pagina: 1,
      tamanhoPagina: filtros.tamanhoPagina ?? 24,
    });

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Input
        placeholder="Buscar meta..."
        value={filtros.busca ?? ""}
        onChange={(e) => set({ busca: e.target.value })}
        className="max-w-xs h-9 text-sm"
      />

      <Select
        value={filtros.categoria ?? "TODAS"}
        onValueChange={(v) => set({ categoria: v === "TODAS" ? "TODAS" : (v as CategoriaMeta) })}
      >
        <SelectTrigger className="w-40 h-9 text-sm">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODAS">Todas categorias</SelectItem>
          <SelectItem value="FINANCEIRA">Financeira</SelectItem>
          <SelectItem value="OPERACIONAL">Operacional</SelectItem>
          <SelectItem value="COMERCIAL">Comercial</SelectItem>
          <SelectItem value="ESTOQUE">Estoque</SelectItem>
          <SelectItem value="ESTRUTURAL">Estrutural</SelectItem>
          <SelectItem value="EQUIPAMENTO">Equipamento</SelectItem>
          <SelectItem value="REFORMA">Reforma</SelectItem>
          <SelectItem value="OUTRA">Outra</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filtros.status ?? "TODAS"}
        onValueChange={(v) => set({ status: v === "TODAS" ? "TODAS" : (v as StatusMeta) })}
      >
        <SelectTrigger className="w-40 h-9 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODAS">Todos os status</SelectItem>
          <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
          <SelectItem value="ATENCAO">Atenção</SelectItem>
          <SelectItem value="ATRASADA">Atrasadas</SelectItem>
          <SelectItem value="CONCLUIDA">Concluídas</SelectItem>
          <SelectItem value="PAUSADA">Pausadas</SelectItem>
          <SelectItem value="CANCELADA">Canceladas</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filtros.prioridade ?? "TODAS"}
        onValueChange={(v) => set({ prioridade: v === "TODAS" ? "TODAS" : (v as PrioridadeMeta) })}
      >
        <SelectTrigger className="w-36 h-9 text-sm">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODAS">Todas</SelectItem>
          <SelectItem value="CRITICA">Crítica</SelectItem>
          <SelectItem value="ALTA">Alta</SelectItem>
          <SelectItem value="MEDIA">Média</SelectItem>
          <SelectItem value="BAIXA">Baixa</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filtros.origemProgresso ?? "TODAS"}
        onValueChange={(v) =>
          set({ origemProgresso: v === "TODAS" ? "TODAS" : (v as FiltrosMetasInput["origemProgresso"]) })
        }
      >
        <SelectTrigger className="w-40 h-9 text-sm">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODAS">Todas origens</SelectItem>
          <SelectItem value="MANUAL">Manual</SelectItem>
          <SelectItem value="AUTOMATICA">Automática</SelectItem>
        </SelectContent>
      </Select>

      {temFiltro && (
        <Button
          variant="ghost"
          size="sm"
          onClick={limpar}
          className="h-9 text-kx-legenda"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
