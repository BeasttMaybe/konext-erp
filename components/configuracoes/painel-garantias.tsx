"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  montarFaixaGarantia,
  TEXTO_COBERTURA_GARANTIA_PADRAO,
  TEXTO_EXCLUSOES_GARANTIA_PADRAO,
  TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
} from "@/lib/configuracoes-os-garantias";
import { SecaoConfiguracoes } from "./secao-configuracoes";

type PropsPainelGarantias = {
  register: UseFormRegister<DadosConfiguracoes>;
  control: Control<DadosConfiguracoes>;
  salvando: boolean;
  configuracaoAtual: DadosConfiguracoes;
};

type CampoToggleGarantia =
  | "permitirGarantiaPersonalizada"
  | "exigirItemParaGarantia"
  | "exigirGarantiaAntesEntrega";

type BlocoToggleGarantiaProps = {
  control: Control<DadosConfiguracoes>;
  campo: CampoToggleGarantia;
  titulo: string;
  descricao: string;
};

function BlocoToggleGarantia({ control, campo, titulo, descricao }: BlocoToggleGarantiaProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3.5">
      <div className="space-y-0.5">
        <Label htmlFor={campo} className="cursor-pointer text-sm font-bold text-kx-texto">
          {titulo}
        </Label>
        <p className="text-xs text-kx-legenda">{descricao}</p>
      </div>
      <Controller
        name={campo}
        control={control}
        render={({ field }) => (
          <Switch id={campo} checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
        )}
      />
    </div>
  );
}

export function PainelGarantias({ register, control, salvando, configuracaoAtual }: PropsPainelGarantias) {
  return (
    <SecaoConfiguracoes
      titulo="Garantias"
      descricao="Gerencie prazos, exigências de emissão e textos padrão do termo de garantia."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-kx-texto">Prazos de garantia</p>
              <p className="mt-1 text-xs text-kx-legenda">
                O backend normaliza o prazo padrão e garante que ele permaneça dentro da faixa configurada.
              </p>
            </div>
            <PilulaStatus variante="neutro" className="shrink-0">
              Faixa atual: {montarFaixaGarantia(configuracaoAtual)}
            </PilulaStatus>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="prazoGarantiaPadraoDias" className="text-xs font-bold text-kx-texto">
                Prazo padrão de garantia
              </Label>
              <Input
                id="prazoGarantiaPadraoDias"
                type="number"
                min={1}
                max={3650}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("prazoGarantiaPadraoDias", { valueAsNumber: true })}
              />
              <p className="text-xs text-kx-legenda">Valor sugerido automaticamente ao gerar um termo de garantia.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prazoMinimoGarantiaDias" className="text-xs font-bold text-kx-texto">
                Prazo mínimo permitido
              </Label>
              <Input
                id="prazoMinimoGarantiaDias"
                type="number"
                min={1}
                max={3650}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("prazoMinimoGarantiaDias", { valueAsNumber: true })}
              />
              <p className="text-xs text-kx-legenda">Menor prazo que poderá ser informado em uma OS.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prazoMaximoGarantiaDias" className="text-xs font-bold text-kx-texto">
                Prazo máximo permitido
              </Label>
              <Input
                id="prazoMaximoGarantiaDias"
                type="number"
                min={1}
                max={3650}
                className="h-11 border-kx-campo-borda bg-kx-superficie"
                {...register("prazoMaximoGarantiaDias", { valueAsNumber: true })}
              />
              <p className="text-xs text-kx-legenda">Maior prazo permitido para uma garantia.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Regras para emissão</p>
            <p className="text-xs text-kx-legenda">
              Essas preferências são lidas na geração do termo e no uso do prazo por OS.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BlocoToggleGarantia
              control={control}
              campo="permitirGarantiaPersonalizada"
              titulo="Permitir prazo personalizado por OS"
              descricao="Permite alterar o prazo no momento de gerar a garantia."
            />
            <BlocoToggleGarantia
              control={control}
              campo="exigirItemParaGarantia"
              titulo="Exigir peça/serviço para gerar garantia"
              descricao="Impede gerar garantia para OS sem item cadastrado."
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Entrega e termo</p>
            <p className="text-xs text-kx-legenda">
              Controla se o termo de garantia precisa existir antes de entregar a OS.
            </p>
          </div>

          <BlocoToggleGarantia
            control={control}
            campo="exigirGarantiaAntesEntrega"
            titulo="Exigir termo antes de entregar"
            descricao="Impede finalizar a OS como entregue sem termo de garantia gerado."
          />
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Textos padrão da garantia</p>
            <p className="text-xs text-kx-legenda">
              Novos termos usam os textos abaixo. Termos antigos continuam abrindo com o conteúdo já salvo.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="textoCoberturaGarantia" className="text-xs font-bold text-kx-texto">
                Texto padrão de cobertura da garantia
              </Label>
              <Textarea
                id="textoCoberturaGarantia"
                rows={4}
                disabled={salvando}
                placeholder={TEXTO_COBERTURA_GARANTIA_PADRAO}
                className="border-kx-campo-borda bg-kx-superficie"
                {...register("textoCoberturaGarantia")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="textoExclusoesGarantia" className="text-xs font-bold text-kx-texto">
                Texto padrão do que não é coberto
              </Label>
              <Textarea
                id="textoExclusoesGarantia"
                rows={4}
                disabled={salvando}
                placeholder={TEXTO_EXCLUSOES_GARANTIA_PADRAO}
                className="border-kx-campo-borda bg-kx-superficie"
                {...register("textoExclusoesGarantia")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="textoResponsabilidadeDados" className="text-xs font-bold text-kx-texto">
                Texto padrão de responsabilidade por dados
              </Label>
              <Textarea
                id="textoResponsabilidadeDados"
                rows={4}
                disabled={salvando}
                placeholder={TEXTO_RESPONSABILIDADE_DADOS_PADRAO}
                className="border-kx-campo-borda bg-kx-superficie"
                {...register("textoResponsabilidadeDados")}
              />
            </div>
          </div>
        </div>
      </div>
    </SecaoConfiguracoes>
  );
}
