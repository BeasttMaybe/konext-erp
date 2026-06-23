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
import type { OrdemServico } from "@/types/os";

export type ConfirmacaoFinalizacaoPayload = {
  prazoGarantiaDias?: number;
};

type ModalFinalizarOSProps = {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  os: OrdemServico | null;
  processando: boolean;
  requerGarantia: boolean;
  onConfirmar: (payload?: ConfirmacaoFinalizacaoPayload) => Promise<void>;
};

function validarPrazoGarantiaDias(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return "Informe o prazo de garantia em dias.";

  const numero = Number(texto);
  if (!Number.isInteger(numero) || numero < 1 || numero > 365) {
    return "Informe um prazo de garantia valido entre 1 e 365 dias.";
  }

  return null;
}

export function ModalFinalizarOS({
  aberta,
  onAbrirMudar,
  os,
  processando,
  requerGarantia,
  onConfirmar,
}: ModalFinalizarOSProps) {
  const [prazoGarantiaDias, setPrazoGarantiaDias] = useState("90");
  const erroPrazo = useMemo(() => validarPrazoGarantiaDias(prazoGarantiaDias), [prazoGarantiaDias]);

  const confirmar = async () => {
    if (requerGarantia) {
      if (erroPrazo) return;
      await onConfirmar({
        prazoGarantiaDias: Number(prazoGarantiaDias),
      });
      return;
    }

    await onConfirmar();
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
            {requerGarantia
              ? `Para finalizar a ${os?.numeroOS ?? "OS selecionada"}, informe o prazo de garantia e gere o termo de garantia.`
              : `Confirme a finalizacao da ${os?.numeroOS ?? "OS selecionada"}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requerGarantia ? (
          <div className="space-y-2">
            <label htmlFor="prazo-garantia-finalizacao" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Prazo de garantia (dias)
            </label>
            <input
              id="prazo-garantia-finalizacao"
              type="number"
              min={1}
              max={365}
              step={1}
              inputMode="numeric"
              value={prazoGarantiaDias}
              onChange={(event) => setPrazoGarantiaDias(event.target.value)}
              disabled={processando}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {erroPrazo ? (
              <p className="text-xs text-red-600 dark:text-red-400">{erroPrazo}</p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Use um prazo de 1 a 365 dias.</p>
            )}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={processando || (requerGarantia && Boolean(erroPrazo))}
            onClick={(event) => {
              event.preventDefault();
              void confirmar();
            }}
          >
            {processando
              ? "Finalizando..."
              : requerGarantia
                ? "Gerar garantia e finalizar"
                : "Finalizar OS"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
