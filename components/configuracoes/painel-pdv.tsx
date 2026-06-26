"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecaoConfiguracoes } from "./secao-configuracoes";

type PropsPainelPdv = {
  register: UseFormRegister<DadosConfiguracoes>;
  control: Control<DadosConfiguracoes>;
  salvando: boolean;
  configuracaoAtual: DadosConfiguracoes;
};

type CampoTogglePdv =
  | "permitirPagamentoMisto"
  | "permitirDescontoPDV"
  | "permitirVendaFiado"
  | "habilitarPix"
  | "habilitarDinheiro"
  | "habilitarCartaoDebito"
  | "habilitarCartaoCredito"
  | "habilitarBoleto"
  | "habilitarCrediario";

type BlocoToggleProps = {
  control: Control<DadosConfiguracoes>;
  campo: CampoTogglePdv;
  titulo: string;
  descricao: string;
};

function BlocoToggle({ control, campo, titulo, descricao }: BlocoToggleProps) {
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

const CAMPOS_TAXA_CREDITO: Array<{ campo: keyof DadosConfiguracoes; label: string }> = [
  { campo: "taxaCartaoCredito1xPercentual", label: "Crédito 1x" },
  { campo: "taxaCartaoCredito2xPercentual", label: "Crédito 2x" },
  { campo: "taxaCartaoCredito3xPercentual", label: "Crédito 3x" },
  { campo: "taxaCartaoCredito4xPercentual", label: "Crédito 4x" },
  { campo: "taxaCartaoCredito5xPercentual", label: "Crédito 5x" },
  { campo: "taxaCartaoCredito6xPercentual", label: "Crédito 6x" },
  { campo: "taxaCartaoCredito7xPercentual", label: "Crédito 7x" },
  { campo: "taxaCartaoCredito8xPercentual", label: "Crédito 8x" },
  { campo: "taxaCartaoCredito9xPercentual", label: "Crédito 9x" },
  { campo: "taxaCartaoCredito10xPercentual", label: "Crédito 10x" },
  { campo: "taxaCartaoCredito11xPercentual", label: "Crédito 11x" },
  { campo: "taxaCartaoCredito12xPercentual", label: "Crédito 12x" },
];

export function PainelPdv({ register, control, salvando, configuracaoAtual }: PropsPainelPdv) {
  return (
    <SecaoConfiguracoes
      titulo="PDV e Vendas"
      descricao="Defina regras de recebimento, descontos, crediário e taxas de pagamento aplicadas ao caixa."
    >
      <div className="space-y-5">
        <Card className="border-border bg-background">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Regras comerciais no caixa</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Estas preferências são validadas no backend antes de concluir vendas no PDV.
              </p>
            </div>
            <Badge variant="secondary">
              Até {configuracaoAtual.maxParcelasCartaoCredito}x no crédito
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BlocoToggle
              control={control}
              campo="permitirPagamentoMisto"
              titulo="Permitir pagamento misto"
              descricao="Autoriza dividir uma venda em várias formas de pagamento."
            />
            <BlocoToggle
              control={control}
              campo="permitirDescontoPDV"
              titulo="Permitir desconto no PDV"
              descricao="Habilita desconto manual no fechamento da venda."
            />
            <BlocoToggle
              control={control}
              campo="permitirVendaFiado"
              titulo="Permitir venda fiado"
              descricao="Permite gerar venda sem recebimento imediato."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="descontoMaximoPDVPercentual">Desconto máximo no PDV (%)</Label>
              <Input
                id="descontoMaximoPDVPercentual"
                type="number"
                min={0}
                max={100}
                step="0.01"
                disabled={salvando || !configuracaoAtual.permitirDescontoPDV}
                {...register("descontoMaximoPDVPercentual", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxParcelasCartaoCredito">Máximo de parcelas no crédito</Label>
              <Input
                id="maxParcelasCartaoCredito"
                type="number"
                min={1}
                max={12}
                disabled={salvando || !configuracaoAtual.habilitarCartaoCredito}
                {...register("maxParcelasCartaoCredito", { valueAsNumber: true })}
              />
            </div>
          </div>
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Formas de pagamento habilitadas</p>
          <p className="text-xs text-muted-foreground">
            Mantenha pelo menos uma forma ativa para o fluxo de vendas continuar funcionando.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <BlocoToggle
              control={control}
              campo="habilitarPix"
              titulo="PIX"
              descricao="Permite recebimento instantâneo por chave ou QR Code."
            />
            <BlocoToggle
              control={control}
              campo="habilitarDinheiro"
              titulo="Dinheiro"
              descricao="Mantém recebimento em espécie no fechamento do caixa."
            />
            <BlocoToggle
              control={control}
              campo="habilitarCartaoDebito"
              titulo="Cartão de débito"
              descricao="Habilita pagamentos no débito com taxa configurável."
            />
            <BlocoToggle
              control={control}
              campo="habilitarCartaoCredito"
              titulo="Cartão de crédito"
              descricao="Permite parcelamento com taxa por quantidade de parcelas."
            />
            <BlocoToggle
              control={control}
              campo="habilitarBoleto"
              titulo="Boleto"
              descricao="Permite venda com vencimento futuro por boleto."
            />
            <BlocoToggle
              control={control}
              campo="habilitarCrediario"
              titulo="Crediário"
              descricao="Habilita recebimento a prazo com vencimento configurado."
            />
          </div>
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Taxas e vencimentos</p>
          <p className="text-xs text-muted-foreground">
            Use taxas em percentual e prazos em dias. Exemplo: 2,5 significa 2,5%.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="taxaCartaoDebitoPercentual">Taxa no débito (%)</Label>
              <Input
                id="taxaCartaoDebitoPercentual"
                type="number"
                min={0}
                step="0.01"
                disabled={salvando || !configuracaoAtual.habilitarCartaoDebito}
                {...register("taxaCartaoDebitoPercentual", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazoPadraoBoletoDias">Prazo padrão do boleto (dias)</Label>
              <Input
                id="prazoPadraoBoletoDias"
                type="number"
                min={1}
                max={365}
                disabled={salvando || !configuracaoAtual.habilitarBoleto}
                {...register("prazoPadraoBoletoDias", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazoPadraoCrediarioDias">Prazo padrão do crediário (dias)</Label>
              <Input
                id="prazoPadraoCrediarioDias"
                type="number"
                min={1}
                max={365}
                disabled={salvando || !configuracaoAtual.habilitarCrediario}
                {...register("prazoPadraoCrediarioDias", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {CAMPOS_TAXA_CREDITO.map((item) => (
              <div key={String(item.campo)} className="space-y-2">
                <Label htmlFor={String(item.campo)}>{item.label} (%)</Label>
                <Input
                  id={String(item.campo)}
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={salvando || !configuracaoAtual.habilitarCartaoCredito}
                  {...register(item.campo as keyof DadosConfiguracoes, { valueAsNumber: true })}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </SecaoConfiguracoes>
  );
}
