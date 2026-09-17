"use client";

import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROTULOS_STATUS_OS } from "@/lib/dominio/os/maquina-estados";
import type { StatusOS } from "@/types/os";
import type { OrdemServico } from "@/types/os";

const MOTIVO_MINIMO = 10;

/** Mesmos destinos aceitos pela action `reabrirOrdemServico`. */
const DESTINOS: readonly StatusOS[] = ["PRONTO", "AGUARDANDO_PECA", "EM_MANUTENCAO"];

export type ConfirmacaoReaberturaPayload = {
  motivo: string;
  statusDestino: StatusOS;
};

type ModalReabrirOSProps = {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  os: OrdemServico | null;
  processando: boolean;
  onConfirmar: (payload: ConfirmacaoReaberturaPayload) => Promise<void>;
};

export function ModalReabrirOS({
  aberta,
  onAbrirMudar,
  os,
  processando,
  onConfirmar,
}: ModalReabrirOSProps) {
  const [motivo, setMotivo] = useState("");
  const [statusDestino, setStatusDestino] = useState<StatusOS>("EM_MANUTENCAO");

  const erroMotivo = useMemo(() => {
    const texto = motivo.trim();
    if (texto.length === 0) return "Informe o motivo da reabertura.";
    if (texto.length < MOTIVO_MINIMO) {
      return `Descreva o motivo com pelo menos ${MOTIVO_MINIMO} caracteres.`;
    }
    if (texto.length > 500) return "O motivo excede 500 caracteres.";
    return null;
  }, [motivo]);

  return (
    <AlertDialog open={aberta} onOpenChange={onAbrirMudar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reabrir OS {os?.numeroOS ?? ""}</AlertDialogTitle>
          <AlertDialogDescription>
            A OS volta para o quadro e sai da lista de finalizadas. O termo de garantia já emitido é
            preservado — a reabertura não reinicia nem cancela a garantia do cliente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status-destino-reabertura">Voltar para</Label>
            <select
              id="status-destino-reabertura"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={statusDestino}
              onChange={(evento) => setStatusDestino(evento.target.value as StatusOS)}
              disabled={processando}
            >
              {DESTINOS.map((destino) => (
                <option key={destino} value={destino}>
                  {ROTULOS_STATUS_OS[destino]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo-reabertura">Motivo da reabertura</Label>
            <Textarea
              id="motivo-reabertura"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ex.: cliente retornou relatando que o aparelho voltou a desligar sozinho."
              rows={3}
              disabled={processando}
            />
            {erroMotivo ? (
              <p className="text-xs text-red-600 dark:text-red-400">{erroMotivo}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                O motivo fica registrado na auditoria da OS.
              </p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(evento) => {
              evento.preventDefault();
              if (erroMotivo) return;
              void onConfirmar({ motivo: motivo.trim(), statusDestino });
            }}
            disabled={processando || Boolean(erroMotivo)}
          >
            {processando ? "Reabrindo..." : "Reabrir OS"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
