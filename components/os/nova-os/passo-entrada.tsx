"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PainelFotosDaEntrada } from "./fotos-da-entrada";

const CAMPO = "h-[46px] rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3.5 text-sm text-kx-texto placeholder:text-kx-placeholder";

export function PassoEntrada() {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-kx-cartao bg-kx-superficie p-4">
        <span className="text-sm font-bold text-kx-texto">Como o aparelho chegou</span>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="relatoCliente" className="text-[13px] font-bold text-kx-texto">
            Relato do cliente <span className="text-kx-erro-icone">*</span>
          </Label>
          <Textarea
            id="relatoCliente"
            placeholder="O que o cliente informou sobre o problema"
            rows={3}
            className="resize-none rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3.5 py-3 text-sm text-kx-texto placeholder:text-kx-placeholder"
            {...register("relatoCliente")}
          />
          {errors.relatoCliente && (
            <p className="text-xs text-kx-erro-texto">{String(errors.relatoCliente.message)}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="condicaoFisica" className="text-[13px] font-bold text-kx-texto">
              Condição física
            </Label>
            <Input id="condicaoFisica" placeholder="Arranhões, trincos, marcas" className={CAMPO} {...register("condicaoFisica")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acessorios" className="text-[13px] font-bold text-kx-texto">
              Acessórios deixados
            </Label>
            <Input id="acessorios" placeholder="Carregador, capa, cartão" className={CAMPO} {...register("acessorios")} />
          </div>
        </div>
      </div>

      <PainelFotosDaEntrada />
    </div>
  );
}
