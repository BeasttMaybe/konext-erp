"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
              <SelectTrigger id="status">
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
          {...register("observacoesInternas")}
        />
      </div>

      {/* Info sobre fluxo */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
        <p className="font-semibold text-slate-900 mb-2">📋 Fluxo de Status Recomendado</p>
        <div className="space-y-2 text-slate-700 text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-slate-200 text-slate-800 px-2 py-1 rounded">1</span>
            <span><strong>Aguardando Orçamento:</strong> Equipamento recebido, análise em andamento</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded">2</span>
            <span><strong>Aguardando Aprovação:</strong> Orçamento enviado ao cliente</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded">3</span>
            <span><strong>Aprovado:</strong> Cliente aprovou o orçamento</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded">4</span>
            <span><strong>Aguardando Peça:</strong> Esperando chegada de componentes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-purple-200 text-purple-800 px-2 py-1 rounded">5</span>
            <span><strong>Em Manutenção:</strong> Trabalho sendo realizado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-green-200 text-green-800 px-2 py-1 rounded">6</span>
            <span><strong>Pronto:</strong> Manutenção concluída, testes OK</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-200 text-emerald-800 px-2 py-1 rounded">7</span>
            <span><strong>Entregue:</strong> Equipamento entregue ao cliente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
