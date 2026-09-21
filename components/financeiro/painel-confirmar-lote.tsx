"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface PainelConfirmarLoteProps {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  titulo: string;
  quantidade: number;
  total: number;
  /** Texto sobre por que não há valor/desconto por item — mostrado sempre, já que o lote nunca aceita ajuste por entrada. */
  avisoValorOriginal: string;
  comObservacao?: boolean;
  confirmando: boolean;
  rotuloConfirmar: string;
  onConfirmar: (observacao?: string) => void;
}

/**
 * Confirmação de ação em lote (Fase 3-2D, Parte 5) — pergunta UMA vez por
 * campo compartilhado (aqui, só a observação opcional de A receber; A
 * pagar não tem esse campo no fluxo de uma parcela só, então não ganha um
 * aqui). Nunca pede valor por entrada — é sempre o valor original de cada
 * uma, dito explicitamente na tela.
 */
export function PainelConfirmarLote({
  aberto,
  onOpenChange,
  titulo,
  quantidade,
  total,
  avisoValorOriginal,
  comObservacao = false,
  confirmando,
  rotuloConfirmar,
  onConfirmar,
}: PainelConfirmarLoteProps) {
  const [observacao, setObservacao] = useState("");

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {quantidade} {quantidade === 1 ? "entrada selecionada" : "entradas selecionadas"} · {formatarMoeda(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="rounded-kx-botao bg-kx-superficie px-3 py-2.5 text-xs leading-relaxed text-kx-legenda">{avisoValorOriginal}</p>

          {comObservacao && (
            <div className="space-y-2">
              <Label>Observação (aplicada a todas, opcional)</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: recebido via depósito em lote, conferência de 20/09"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmando}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirmar(comObservacao ? observacao : undefined)} disabled={confirmando || quantidade === 0}>
            {confirmando ? "Processando..." : `${rotuloConfirmar} · ${quantidade}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
