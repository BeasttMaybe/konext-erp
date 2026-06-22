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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrdemServico } from "@/types/os";

type ModalFinalizarOSProps = {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  os: OrdemServico | null;
  processando: boolean;
  onConfirmar: (prazoGarantiaDias: number) => Promise<void>;
};

function validarPrazo(valor: string): string | null {
  if (!valor.trim()) return "Informe o prazo de garantia.";

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 365) {
    return "Informe um prazo de garantia valido.";
  }

  return null;
}

export function ModalFinalizarOS({ aberta, onAbrirMudar, os, processando, onConfirmar }: ModalFinalizarOSProps) {
  const [prazoGarantiaDias, setPrazoGarantiaDias] = useState("90");
  const erro = useMemo(() => validarPrazo(prazoGarantiaDias), [prazoGarantiaDias]);

  const confirmar = async () => {
    const erroAtual = validarPrazo(prazoGarantiaDias);
    if (erroAtual) return;

    await onConfirmar(Number(prazoGarantiaDias));
  };

  return (
    <AlertDialog
      open={aberta}
      onOpenChange={(novoEstado) => {
        if (processando) return;
        onAbrirMudar(novoEstado);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar ordem de servico</AlertDialogTitle>
          <AlertDialogDescription>
            {`Confirme a finalizacao da ${os?.numeroOS ?? "OS selecionada"} e informe o prazo da garantia.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="prazo-garantia-dias">Prazo de garantia (dias)</Label>
          <Input
            id="prazo-garantia-dias"
            type="number"
            min={1}
            max={365}
            step={1}
            inputMode="numeric"
            placeholder="Ex: 90"
            value={prazoGarantiaDias}
            onChange={(event) => setPrazoGarantiaDias(event.target.value)}
            disabled={processando}
          />
          <p className="text-xs text-slate-500">Informe quantos dias de garantia este aparelho tera.</p>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={Boolean(erro) || processando}
            onClick={(event) => {
              event.preventDefault();
              void confirmar();
            }}
          >
            {processando ? "Finalizando..." : "Finalizar OS"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
