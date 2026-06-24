"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FiltrosGarantiaInput, StatusGarantia } from "@/app/actions/garantias";

type FiltrosGarantiasProps = {
  filtros: FiltrosGarantiaInput;
  onChange: (filtros: FiltrosGarantiaInput) => void;
};

const opcoesStatus: Array<{ valor: "TODAS" | StatusGarantia; label: string }> = [
  { valor: "TODAS", label: "Todas" },
  { valor: "ATIVA", label: "Ativas" },
  { valor: "PERTO_DO_VENCIMENTO", label: "Perto do vencimento" },
  { valor: "VENCIDA", label: "Vencidas" },
  { valor: "RETORNO_EM_ANDAMENTO", label: "Retorno em andamento" },
  { valor: "RETORNO_FINALIZADO", label: "Retorno finalizado" },
  { valor: "SEM_COBERTURA", label: "Sem cobertura" },
  { valor: "CANCELADA", label: "Canceladas" },
];

const opcoesRetorno: Array<{ valor: "TODAS" | "COM_RETORNO" | "SEM_RETORNO"; label: string }> = [
  { valor: "TODAS", label: "Todas" },
  { valor: "COM_RETORNO", label: "Com retorno" },
  { valor: "SEM_RETORNO", label: "Sem retorno" },
];

export function FiltrosGarantias({ filtros, onChange }: FiltrosGarantiasProps) {
  const statusAtual = useMemo(() => filtros.status ?? "TODAS", [filtros.status]);
  const retornoAtual = useMemo(() => filtros.retorno ?? "TODAS", [filtros.retorno]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="lg:col-span-2 space-y-2">
        <Label htmlFor="busca-garantias">Buscar por cliente, OS, telefone, aparelho ou IMEI</Label>
        <Input
          id="busca-garantias"
          value={filtros.busca ?? ""}
          onChange={(evento) => onChange({ ...filtros, busca: evento.target.value, pagina: 1 })}
          placeholder="Ex: Maria, OS-2026-123, iPhone, IMEI..."
        />
      </div>

      <div className="space-y-2">
        <Label>Status da garantia</Label>
        <Select
          value={statusAtual}
          onValueChange={(valor) => onChange({ ...filtros, status: valor as "TODAS" | StatusGarantia, pagina: 1 })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status da garantia" />
          </SelectTrigger>
          <SelectContent>
            {opcoesStatus.map((opcao) => (
              <SelectItem key={opcao.valor} value={opcao.valor}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Retorno</Label>
        <Select
          value={retornoAtual}
          onValueChange={(valor) =>
            onChange({
              ...filtros,
              retorno: valor as "TODAS" | "COM_RETORNO" | "SEM_RETORNO",
              pagina: 1,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Com ou sem retorno" />
          </SelectTrigger>
          <SelectContent>
            {opcoesRetorno.map((opcao) => (
              <SelectItem key={opcao.valor} value={opcao.valor}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="periodo-inicio">Período inicial</Label>
        <Input
          id="periodo-inicio"
          type="date"
          value={filtros.dataInicio ?? ""}
          onChange={(evento) => onChange({ ...filtros, dataInicio: evento.target.value, pagina: 1 })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="periodo-fim">Período final</Label>
        <Input
          id="periodo-fim"
          type="date"
          value={filtros.dataFim ?? ""}
          onChange={(evento) => onChange({ ...filtros, dataFim: evento.target.value, pagina: 1 })}
        />
      </div>
    </div>
  );
}
