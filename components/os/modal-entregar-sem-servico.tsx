"use client";

import { useState } from"react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from"@/components/ui/alert-dialog";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import type { OrdemServico } from"@/types/os";

const MOTIVO_MINIMO = 10;
const MOTIVO_MAXIMO = 500;

export type ModalEntregarSemServicoProps = {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  os: Pick<OrdemServico,"id" |"numeroOS"> | null;
  processando: boolean;
  onConfirmar: (motivo: string) => Promise<void>;
};

/**
 * Duas etapas na mesma janela: confirmação ("Encerrar sem serviço?") e só
 * depois a observação obrigatória — nunca as duas juntas, para o operador
 * não digitar um motivo e desistir sem querer no mesmo clique.
 */
export function ModalEntregarSemServico({
  aberta,
  onAbrirMudar,
  os,
  processando,
  onConfirmar,
}: ModalEntregarSemServicoProps) {
  const [etapa, setEtapa] = useState<"confirmar" |"motivo">("confirmar");
  const [motivo, setMotivo] = useState("");

  const motivoValido = motivo.trim().length >= MOTIVO_MINIMO;

  return (
    <AlertDialog open={aberta} onOpenChange={onAbrirMudar}>
      <AlertDialogContent>
        {etapa ==="confirmar" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar sem serviço?</AlertDialogTitle>
              <AlertDialogDescription>
                {`Tem certeza que deseja encerrar sem serviço vinculado na OS ${os?.numeroOS ??""}?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Não, voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(evento) => {
                  evento.preventDefault();
                  setEtapa("motivo");
                }}
              >
                Sim, encerrar sem serviço
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Motivo do encerramento</AlertDialogTitle>
              <AlertDialogDescription>
                {`Explique por que a OS ${os?.numeroOS ??""} está sendo encerrada sem peça ou serviço vinculado.`}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <Label htmlFor="motivo-sem-servico">Observação</Label>
              <Textarea
                id="motivo-sem-servico"
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="Ex.: cliente desistiu do reparo, aparelho irreparável sem custo..."
                minLength={MOTIVO_MINIMO}
                maxLength={MOTIVO_MAXIMO}
                disabled={processando}
                autoFocus
              />
              <p className="text-xs text-kx-legenda">
                {motivo.trim().length}/{MOTIVO_MAXIMO} caracteres (mínimo {MOTIVO_MINIMO})
              </p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={processando || !motivoValido}
                onClick={(evento) => {
                  evento.preventDefault();
                  void onConfirmar(motivo.trim());
                }}
              >
                {processando ?"Encerrando..." :"Sim, encerrar sem serviço"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
