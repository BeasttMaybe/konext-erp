"use client";

import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ClipboardList } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OS = [
  { value: "AGUARDANDO_ORCAMENTO", label: "Aguardando Orçamento" },
  { value: "AGUARDANDO_APROVACAO", label: "Aguardando Aprovação" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "AGUARDANDO_PECA", label: "Aguardando Peça" },
  { value: "EM_MANUTENCAO", label: "Em Manutenção" },
  { value: "PRONTO", label: "Pronto" },
  { value: "ENTREGUE", label: "Entregue" },
];

export function AbaHistoricoStatus() {
  const { control, register } = useFormContext();
  const [isFlowOpen, setIsFlowOpen] = useState(false);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-slate-900">
        📊 Status & Observações
      </h3>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Status da OS</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="status" className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35">
                <SelectValue placeholder="Selecione um status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Observações Internas */}
      <div className="space-y-2">
        <Label htmlFor="observacoes">
          Observações Internas
          <span className="text-xs text-slate-500 ml-2">(Não visível para cliente)</span>
        </Label>
        <Textarea
          id="observacoes"
          placeholder="Adicione notas, problemas encontrados, ou informações importantes sobre a manutenção..."
          rows={5}
          className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
          {...register("observacoesInternas")}
        />
      </div>

      <Card className="border-border/70 bg-muted/30 p-4">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between px-0 py-0"
          onClick={() => setIsFlowOpen((current) => !current)}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="h-4 w-4 text-primary" />
            Fluxo de Status Recomendado
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isFlowOpen ? "rotate-180" : ""}`}
          />
        </Button>

        <div
          className={`grid transition-all duration-300 ease-out ${
            isFlowOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-200 px-2 py-1 text-slate-800">1</span>
              <span><strong>Aguardando Orçamento:</strong> Equipamento recebido, análise em andamento</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-yellow-200 px-2 py-1 text-yellow-800">2</span>
              <span><strong>Aguardando Aprovação:</strong> Orçamento enviado ao cliente</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-200 px-2 py-1 text-blue-800">3</span>
              <span><strong>Aprovado:</strong> Cliente aprovou o orçamento</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-orange-200 px-2 py-1 text-orange-800">4</span>
              <span><strong>Aguardando Peça:</strong> Esperando chegada de componentes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-200 px-2 py-1 text-purple-800">5</span>
              <span><strong>Em Manutenção:</strong> Trabalho sendo realizado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-green-200 px-2 py-1 text-green-800">6</span>
              <span><strong>Pronto:</strong> Manutenção concluída, testes OK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-200 px-2 py-1 text-emerald-800">7</span>
              <span><strong>Entregue:</strong> Equipamento entregue ao cliente</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
