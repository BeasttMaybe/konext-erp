"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { DadosConfiguracoes } from "@/app/actions/configuracoes";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  | "custoPecaOSJaPago"
  | "habilitarMargemAutomatica";

type BlocoToggleOsProps = {
  control: Control<DadosConfiguracoes>;
  campo: CampoToggleOs;
  titulo: string;
  descricao: string;
};

function BlocoToggleOs({ control, campo, titulo, descricao }: BlocoToggleOsProps) {
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

export function PainelOs({ control, configuracaoAtual }: PropsPainelOs) {
  return (
    <SecaoConfiguracoes
      titulo="Ordens de Serviço"
      descricao="Defina regras operacionais do fluxo de OS, finalização e integração com o PDV."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-kx-texto">Fluxo da OS</p>
              <p className="mt-1 text-xs text-kx-legenda">
                Regras aplicadas quando a OS é entregue ou enviada para faturamento.
              </p>
            </div>
            <PilulaStatus variante="sucesso" className="shrink-0">
              Funcional
            </PilulaStatus>
          </div>

          <div className="rounded-kx-botao border border-dashed border-kx-campo-borda bg-kx-superficie p-4">
            <p className="text-sm text-kx-texto">
              Exigir termo antes de entregar:{" "}
              <span className="font-bold">{configuracaoAtual.exigirGarantiaAntesEntrega ? "Ativado" : "Desativado"}</span>
            </p>
            <p className="mt-1 text-xs text-kx-legenda">
              A regra é definida na seção Garantias e lida pelo fluxo de status da OS no backend.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Validações para finalização</p>
            <p className="text-xs text-kx-legenda">
              Estas verificações são avaliadas server-side ao mover a OS para Entregue.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BlocoToggleOs
              control={control}
              campo="exigirDiagnosticoParaFinalizar"
              titulo="Exigir diagnóstico técnico para finalizar"
              descricao="Impede finalizar a OS enquanto o diagnóstico técnico estiver vazio."
            />
            <BlocoToggleOs
              control={control}
              campo="custoPecaOSJaPago"
              titulo="Peça do conserto já vem paga"
              descricao="O custo da peça entra no financeiro como despesa já quitada, em vez de conta a pagar esperando baixa. Desligue se você compra peça faturada."
            />
            <BlocoToggleOs
              control={control}
              campo="permitirFinalizarSemPagamento"
              titulo="Permitir finalizar OS sem pagamento"
              descricao="Permite marcar a OS como entregue mesmo sem confirmação de pagamento."
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Integração com PDV</p>
            <p className="text-xs text-kx-legenda">
              Controla a exigência mínima de itens antes de faturar uma OS no PDV.
            </p>
          </div>

          <BlocoToggleOs
            control={control}
            campo="exigirItemParaEnviarPDV"
            titulo="Exigir peça/serviço para enviar ao PDV"
            descricao="Impede enviar uma OS ao PDV sem ao menos uma peça ou serviço cadastrado."
          />
        </div>

        <div className="flex flex-col gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-4 md:p-5">
          <div>
            <p className="text-sm font-bold text-kx-texto">Margem e orçamento</p>
            <p className="text-xs text-kx-legenda">
              Reaproveita a configuração atual de cálculo automático de margem para manter compatibilidade com o orçamento da OS.
            </p>
          </div>

          <BlocoToggleOs
            control={control}
            campo="habilitarMargemAutomatica"
            titulo="Habilitar cálculo automático de margem na OS"
            descricao="Sugere valores de cobrança com base no custo e margem configurada."
          />
        </div>
      </div>
    </SecaoConfiguracoes>
  );
}
