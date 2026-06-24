"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <Controller
          name={campo}
          control={control}
          render={({ field }) => (
            <Checkbox
              id={campo}
              checked={Boolean(field.value)}
              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
            />
          )}
        />

        <div className="space-y-1">
          <Label htmlFor={campo} className="cursor-pointer text-sm font-semibold text-foreground">
            {titulo}
          </Label>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
    </div>
  );
}

export function PainelGarantias({ register, control, salvando, configuracaoAtual }: PropsPainelGarantias) {
  return (
    <SecaoConfiguracoes
      titulo="Garantias"
      descricao="Gerencie prazos, exigências de emissão e textos padrão do termo de garantia."
    >
      <div className="space-y-5">
        <Card className="border-border bg-background">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Prazos de garantia</p>
              <p className="mt-1 text-xs text-muted-foreground">
                O backend normaliza o prazo padrão e garante que ele permaneça dentro da faixa configurada.
              </p>
            </div>
            <Badge variant="secondary">Faixa atual: {montarFaixaGarantia(configuracaoAtual)}</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="prazoGarantiaPadraoDias">Prazo padrão de garantia</Label>
              <Input
                id="prazoGarantiaPadraoDias"
                type="number"
                min={1}
                max={3650}
                {...register("prazoGarantiaPadraoDias", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">Valor sugerido automaticamente ao gerar um termo de garantia.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazoMinimoGarantiaDias">Prazo mínimo permitido</Label>
              <Input
                id="prazoMinimoGarantiaDias"
                type="number"
                min={1}
                max={3650}
                {...register("prazoMinimoGarantiaDias", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">Menor prazo que poderá ser informado em uma OS.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazoMaximoGarantiaDias">Prazo máximo permitido</Label>
              <Input
                id="prazoMaximoGarantiaDias"
                type="number"
                min={1}
                max={3650}
                {...register("prazoMaximoGarantiaDias", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">Maior prazo permitido para uma garantia.</p>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Regras para emissão</p>
          <p className="text-xs text-muted-foreground">
            Essas preferências são lidas na geração do termo e no uso do prazo por OS.
          </p>

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
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Entrega e termo</p>
          <p className="text-xs text-muted-foreground">
            Controla se o termo de garantia precisa existir antes de entregar a OS.
          </p>

          <BlocoToggleGarantia
            control={control}
            campo="exigirGarantiaAntesEntrega"
            titulo="Exigir termo antes de entregar"
            descricao="Impede finalizar a OS como entregue sem termo de garantia gerado."
          />
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Textos padrão da garantia</p>
          <p className="text-xs text-muted-foreground">
            Novos termos usam os textos abaixo. Termos antigos continuam abrindo com o conteúdo já salvo.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="textoCoberturaGarantia">Texto padrão de cobertura da garantia</Label>
              <Textarea
                id="textoCoberturaGarantia"
                rows={4}
                disabled={salvando}
                placeholder={TEXTO_COBERTURA_GARANTIA_PADRAO}
                {...register("textoCoberturaGarantia")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textoExclusoesGarantia">Texto padrão do que não é coberto</Label>
              <Textarea
                id="textoExclusoesGarantia"
                rows={4}
                disabled={salvando}
                placeholder={TEXTO_EXCLUSOES_GARANTIA_PADRAO}
                {...register("textoExclusoesGarantia")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textoResponsabilidadeDados">Texto padrão de responsabilidade por dados</Label>
              <Textarea
                id="textoResponsabilidadeDados"
                rows={4}
                disabled={salvando}
                placeholder={TEXTO_RESPONSABILIDADE_DADOS_PADRAO}
                {...register("textoResponsabilidadeDados")}
              />
            </div>
          </div>
        </Card>
      </div>
    </SecaoConfiguracoes>
  );
}
