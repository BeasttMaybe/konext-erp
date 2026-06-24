"use client";

import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { useCalculadoraPrecosOS } from "@/hooks/useCalculadoraPrecosOS";

const TIPOS_PECA = [
  { value: "TELA", label: "Tela" },
  { value: "BATERIA", label: "Bateria" },
  { value: "CONECTOR_CARGA", label: "Conector de Carga" },
  { value: "TAMPA_IPHONE", label: "Tampa iPhone" },
  { value: "TAMPA_ANDROID", label: "Tampa Android" },
  { value: "OUTROS", label: "Outros" },
];

export function AbaOrcamento() {
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "itensOrcamento",
  });

  const { calcularValorCobrado, calcularTotalOrcamento } = useCalculadoraPrecosOS();
  const itens = watch("itensOrcamento") || [];

  const totalOrcamento = calcularTotalOrcamento(itens);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-slate-900">
        💰 Itens de Orçamento
      </h3>

      {/* Lista de itens */}
      <div className="space-y-4">
        {fields.length === 0 ? (
          <div className="flex items-center justify-center h-24 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 text-slate-400">
            Nenhum item adicionado
          </div>
        ) : (
          fields.map((field, index) => (
            <Card key={field.id} className="border border-slate-200 p-4 transition-all duration-200 hover:shadow-sm">
              <div className="grid grid-cols-5 gap-4 items-start">
                {/* Tipo */}
                <div className="col-span-1 space-y-2">
                  <Label htmlFor={`tipo-${index}`} className="text-xs">
                    Tipo *
                  </Label>
                  <Controller
                    name={`itensOrcamento.${index}.tipo`}
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id={`tipo-${index}`}
                          className="text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
                        >
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_PECA.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Descrição */}
                <div className="col-span-2 space-y-2">
                  <Label htmlFor={`desc-${index}`} className="text-xs">
                    Descrição *
                  </Label>
                  <Input
                    id={`desc-${index}`}
                    placeholder="Ex: Tela OLED 6.1 polegadas"
                    className="text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
                    {...control.register(`itensOrcamento.${index}.descricao`)}
                  />
                </div>

                {/* Custo da Peça */}
                <div className="col-span-1 space-y-2">
                  <Label htmlFor={`custo-${index}`} className="text-xs">
                    Custo (R$) *
                  </Label>
                  <Input
                    id={`custo-${index}`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
                    {...control.register(`itensOrcamento.${index}.custoPeca`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>

                {/* Valor a Cobrar */}
                <div className="col-span-1 space-y-2">
                  <Label htmlFor={`valor-${index}`} className="text-xs">
                    Cobrar (R$)
                  </Label>
                  <Controller
                    name={`itensOrcamento.${index}.valorCobrado`}
                    control={control}
                    render={({ field }) => {
                      const tipo = itens[index]?.tipo;
                      const custoPeca = itens[index]?.custoPeca || 0;
                      const autoCalc =
                        tipo && tipo !== "OUTROS" && custoPeca > 0
                          ? calcularValorCobrado(tipo, custoPeca)
                          : 0;

                      // Se tipo é OUTROS ou ainda não foi calculado, permite edição manual
                      const isReadOnly = tipo && tipo !== "OUTROS" && custoPeca > 0;

                      return (
                        <div>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
                            readOnly={isReadOnly}
                            value={
                              isReadOnly ? autoCalc.toFixed(2) : field.value
                            }
                            onChange={
                              isReadOnly
                                ? () => {}
                                : (e) =>
                                    field.onChange(parseFloat(e.target.value))
                            }
                          />
                          {isReadOnly && (
                            <p className="text-xs text-slate-400 mt-1">
                              Automático
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                </div>

                {/* Botão remover */}
                <div className="col-span-5 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Botão adicionar item */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() =>
          append({
            tipo: "OUTROS",
            descricao: "",
            custoPeca: 0,
            valorCobrado: 0,
          })
        }
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Item
      </Button>

      {/* Total do Orçamento */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6 transition-all duration-200 hover:shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-slate-900">
            Total do Orçamento:
          </span>
          <span className="text-3xl font-bold text-emerald-700">
            {formatarMoeda(totalOrcamento)}
          </span>
        </div>
      </Card>

    </div>
  );
}
