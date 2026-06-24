"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SecaoConfiguracoes } from "./secao-configuracoes";

type PropsPainelOs = {
  register: UseFormRegister<DadosConfiguracoes>;
  control: Control<DadosConfiguracoes>;
  salvando: boolean;
  configuracaoAtual: DadosConfiguracoes;
};

type CampoToggleOs =
  | "exigirItemParaEnviarPDV"
  | "exigirDiagnosticoParaFinalizar"
  | "permitirFinalizarSemPagamento"
  | "habilitarMargemAutomatica";

type BlocoToggleOsProps = {
  control: Control<DadosConfiguracoes>;
  campo: CampoToggleOs;
  titulo: string;
  descricao: string;
};

function BlocoToggleOs({ control, campo, titulo, descricao }: BlocoToggleOsProps) {
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

export function PainelOs({ control, configuracaoAtual }: PropsPainelOs) {
  return (
    <SecaoConfiguracoes
      titulo="Ordens de Serviço"
      descricao="Defina regras operacionais do fluxo de OS, finalização e integração com o PDV."
    >
      <div className="space-y-5">
        <Card className="border-border bg-background">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Fluxo da OS</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Regras aplicadas quando a OS é entregue ou enviada para faturamento.
              </p>
            </div>
            <Badge variant="secondary">Funcional</Badge>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-slate-50/80 p-4">
            <p className="text-sm text-foreground">
              Exigir termo antes de entregar: <span className="font-semibold">{configuracaoAtual.exigirGarantiaAntesEntrega ? "Ativado" : "Desativado"}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A regra é definida na seção Garantias e lida pelo fluxo de status da OS no backend.
            </p>
          </div>
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Validações para finalização</p>
          <p className="text-xs text-muted-foreground">
            Estas verificações são avaliadas server-side ao mover a OS para Entregue.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <BlocoToggleOs
              control={control}
              campo="exigirDiagnosticoParaFinalizar"
              titulo="Exigir diagnóstico técnico para finalizar"
              descricao="Impede finalizar a OS enquanto o diagnóstico técnico estiver vazio."
            />
            <BlocoToggleOs
              control={control}
              campo="permitirFinalizarSemPagamento"
              titulo="Permitir finalizar OS sem pagamento"
              descricao="Permite marcar a OS como entregue mesmo sem confirmação de pagamento."
            />
          </div>
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Integração com PDV</p>
          <p className="text-xs text-muted-foreground">
            Controla a exigência mínima de itens antes de faturar uma OS no PDV.
          </p>

          <BlocoToggleOs
            control={control}
            campo="exigirItemParaEnviarPDV"
            titulo="Exigir peça/serviço para enviar ao PDV"
            descricao="Impede enviar uma OS ao PDV sem ao menos uma peça ou serviço cadastrado."
          />
        </Card>

        <Card className="border-border bg-background">
          <p className="text-sm font-semibold text-foreground">Margem e orçamento</p>
          <p className="text-xs text-muted-foreground">
            Reaproveita a configuração atual de cálculo automático de margem para manter compatibilidade com o orçamento da OS.
          </p>

          <BlocoToggleOs
            control={control}
            campo="habilitarMargemAutomatica"
            titulo="Habilitar cálculo automático de margem na OS"
            descricao="Sugere valores de cobrança com base no custo e margem configurada."
          />
        </Card>
      </div>
    </SecaoConfiguracoes>
  );
}
