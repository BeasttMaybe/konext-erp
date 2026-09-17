"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
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
import type { CodigoPendenciaFinalizacao, PendenciaFinalizacao } from "@/lib/dominio/os/regras-finalizacao";
import type { OrdemServico } from "@/types/os";

/**
 * Atalho de cada pendencia: para onde levar o operador para resolve-la.
 * Codigos sem entrada aqui (ex.: PRAZO_GARANTIA_INVALIDO, que se resolve no
 * proprio campo deste dialogo) nao ganham botao.
 */
const ATALHOS_PENDENCIA: Partial<Record<CodigoPendenciaFinalizacao, { rotulo: string; obterHref: (osId: string) => string }>> = {
  SEM_ITENS: { rotulo: "Abrir OS", obterHref: (osId) => `/os/${osId}` },
  ITEM_SEM_CUSTO: { rotulo: "Editar item", obterHref: (osId) => `/os/${osId}` },
  ITEM_SEM_PRECO_VENDA: { rotulo: "Editar item", obterHref: (osId) => `/os/${osId}` },
  SEM_DIAGNOSTICO: { rotulo: "Abrir OS", obterHref: (osId) => `/os/${osId}` },
  SEM_VENDA_VINCULADA: { rotulo: "Abrir no PDV", obterHref: (osId) => `/pdv?osId=${encodeURIComponent(osId)}` },
};

export type ConfirmacaoFinalizacaoPayload = {
  prazoGarantiaDias?: number;
};

type ModalFinalizarOSProps = {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  os: Pick<OrdemServico, "id" | "numeroOS"> | null;
  processando: boolean;
  /** OS de retorno de garantia nao emite termo novo. */
  exigePrazoGarantia: boolean;
  prazoPadraoDias: number;
  prazoMinimoDias: number;
  prazoMaximoDias: number;
  /** Bloqueios devolvidos pelo servidor na ultima tentativa. */
  pendencias: readonly PendenciaFinalizacao[];
  onConfirmar: (payload?: ConfirmacaoFinalizacaoPayload) => Promise<void>;
};

export function ModalFinalizarOS({
  aberta,
  onAbrirMudar,
  os,
  processando,
  exigePrazoGarantia,
  prazoPadraoDias,
  prazoMinimoDias,
  prazoMaximoDias,
  pendencias,
  onConfirmar,
}: ModalFinalizarOSProps) {
  const [prazoGarantiaDias, setPrazoGarantiaDias] = useState(String(prazoPadraoDias));

  // A faixa vem das configuracoes da empresa. Antes o modal usava 1..365 fixo
  // enquanto o servidor aplicava outra faixa, entao um valor aceito aqui podia
  // ser recusado depois (AUDIT_REPORT 16.3-5).
  const erroPrazo = useMemo(() => {
    if (!exigePrazoGarantia) return null;

    const texto = prazoGarantiaDias.trim();
    if (!texto) return "Informe o prazo de garantia em dias.";

    const numero = Number(texto);
    if (!Number.isInteger(numero) || numero < prazoMinimoDias || numero > prazoMaximoDias) {
      return `Informe um prazo entre ${prazoMinimoDias} e ${prazoMaximoDias} dias.`;
    }

    return null;
  }, [exigePrazoGarantia, prazoGarantiaDias, prazoMinimoDias, prazoMaximoDias]);

  const confirmar = async () => {
    if (erroPrazo) return;

    await onConfirmar(
      exigePrazoGarantia ? { prazoGarantiaDias: Number(prazoGarantiaDias) } : undefined
    );
  };

  const bloqueada = pendencias.length > 0;

  return (
    <AlertDialog open={aberta} onOpenChange={onAbrirMudar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {bloqueada ? "Não é possível finalizar esta OS" : "Finalizar e entregar OS"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {bloqueada
              ? `Resolva as pendências abaixo para entregar a OS ${os?.numeroOS ?? ""}.`
              : `A OS ${os?.numeroOS ?? ""} será marcada como entregue e arquivada. ${
                  exigePrazoGarantia
                    ? "O termo de garantia é emitido agora, com início na data de hoje."
                    : "OS de retorno de garantia não emite termo novo."
                }`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {bloqueada ? (
          <ul className="space-y-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            {pendencias.map((pendencia, indice) => {
              const atalho = ATALHOS_PENDENCIA[pendencia.codigo];

              return (
                <li
                  key={`${pendencia.codigo}-${pendencia.itemId ?? indice}`}
                  className="flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                      aria-hidden
                    />
                    <span className="text-amber-900 dark:text-amber-200">{pendencia.mensagem}</span>
                  </div>
                  {atalho && os ? (
                    <Link
                      href={atalho.obterHref(os.id)}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
                    >
                      {atalho.rotulo}
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : exigePrazoGarantia ? (
          <div className="space-y-2">
            <Label htmlFor="prazo-garantia-finalizacao">Prazo de garantia (dias)</Label>
            <Input
              id="prazo-garantia-finalizacao"
              inputMode="numeric"
              value={prazoGarantiaDias}
              onChange={(evento) => setPrazoGarantiaDias(evento.target.value)}
              disabled={processando}
            />
            <p className="text-xs text-muted-foreground">
              Entre {prazoMinimoDias} e {prazoMaximoDias} dias, conforme as configurações da empresa.
            </p>
            {erroPrazo ? (
              <p className="text-xs text-red-600 dark:text-red-400">{erroPrazo}</p>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={processando}>
            {bloqueada ? "Fechar" : "Cancelar"}
          </AlertDialogCancel>
          {bloqueada ? null : (
            <AlertDialogAction
              onClick={(evento) => {
                evento.preventDefault();
                void confirmar();
              }}
              disabled={processando || Boolean(erroPrazo)}
            >
              {processando ? "Finalizando..." : "Finalizar e entregar"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
