"use client";

import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Cliente } from "@/types/os";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AbaEntradaEquipamentoProps {
  clientes: Cliente[];
}

export function AbaEntradaEquipamento({ clientes }: AbaEntradaEquipamentoProps) {
  const { control, register, formState: { errors } } = useFormContext();
  const [mostrarSenhaAcesso, setMostrarSenhaAcesso] = useState(false);
  const [padraoDesenho, setPadraoDesenho] = useState<number[]>([]);

  const handleSelecionarPontoDesenho = (ponto: number) => {
    setPadraoDesenho((atual) => {
      if (atual.includes(ponto)) return atual;
      return [...atual, ponto];
    });
  };

  const handleLimparDesenho = () => {
    setPadraoDesenho([]);
  };

  const obterOrdemPonto = (ponto: number): number => {
    const indice = padraoDesenho.indexOf(ponto);
    return indice >= 0 ? indice + 1 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Seção 1: Cliente */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          📋 Dados do Cliente
        </h3>
        <div className="space-y-2">
          <Label htmlFor="cliente">Cliente *</Label>
          <Controller
            name="clienteId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="cliente">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.clienteId && (
            <p className="text-xs text-red-500">{String(errors.clienteId.message)}</p>
          )}
        </div>
      </div>

      {/* Seção 2: Dados do Aparelho */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          📱 Dados do Aparelho
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="equipamento">Equipamento *</Label>
            <Input
              id="equipamento"
              placeholder="Ex: iPhone 13, Notebook Dell, FZ25..."
              {...register("equipamento")}
            />
            {errors.equipamento && (
              <p className="text-xs text-red-500">
                {String(errors.equipamento.message)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="marca">Marca</Label>
            <Input
              id="marca"
              placeholder="Ex: Apple, Dell"
              {...register("marca")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelo">Modelo</Label>
            <Input
              id="modelo"
              placeholder="Ex: 13 Pro"
              {...register("modelo")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="numeroSerieImei">IMEI / Nº de Série</Label>
            <Input
              id="numeroSerieImei"
              placeholder="Ex: 358123045237847"
              {...register("numeroSerieImei")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senhaAcesso">Senha do Aparelho</Label>
            <div className="relative">
              <Input
                id="senhaAcesso"
                type={mostrarSenhaAcesso ? "text" : "password"}
                placeholder="••••••••"
                className="pr-11"
                {...register("senhaAcesso")}
              />
              <button
                type="button"
                onClick={() => setMostrarSenhaAcesso((atual) => !atual)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={mostrarSenhaAcesso ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenhaAcesso ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="col-span-2 space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
            <div>
              <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Senha de Desenho (Android)
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Toque nos pontos na ordem para registrar o padrao de desbloqueio.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 w-48 mx-auto">
              {Array.from({ length: 9 }, (_, indice) => indice + 1).map((ponto) => {
                const ordem = obterOrdemPonto(ponto);
                const selecionado = ordem > 0;

                return (
                  <button
                    key={ponto}
                    type="button"
                    onClick={() => handleSelecionarPontoDesenho(ponto)}
                    className={`relative h-12 w-12 rounded-full border transition-all ${
                      selecionado
                        ? "bg-blue-600 border-blue-700 text-white"
                        : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {ordem > 0 && (
                      <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-emerald-600 text-[10px] leading-5 text-white font-bold">
                        {ordem}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-slate-700 dark:text-slate-200">
                <span className="font-medium">Padrao:</span>{" "}
                {padraoDesenho.length > 0 ? padraoDesenho.join("-") : "Nao definido"}
              </div>
              <Button type="button" variant="outline" onClick={handleLimparDesenho}>
                Limpar Desenho
              </Button>
            </div>

            {padraoDesenho.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {padraoDesenho.map((ponto, indice) => (
                  <Badge
                    key={`${ponto}-${indice}`}
                    variant="secondary"
                    className="bg-slate-200 dark:bg-slate-700"
                  >
                    {indice + 1}o ponto: {ponto}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seção 3: Checklist de Entrada */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          ✅ Checklist de Entrada
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="relatoCliente">Relato do Cliente *</Label>
            <Textarea
              id="relatoCliente"
              placeholder="Descreva o que o cliente informou sobre o problema..."
              rows={3}
              {...register("relatoCliente")}
            />
            {errors.relatoCliente && (
              <p className="text-xs text-red-500">
                {String(errors.relatoCliente.message)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="condicaoFisica">Condição Física</Label>
            <Textarea
              id="condicaoFisica"
              placeholder="Ex: Arranhões, tela trincada, bateria inchada..."
              rows={2}
              {...register("condicaoFisica")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acessoriosDeixados">Acessórios Deixados</Label>
            <Textarea
              id="acessoriosDeixados"
              placeholder="Ex: Carregador original, capinha, EarPods..."
              rows={2}
              {...register("acessoriosDeixados")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
