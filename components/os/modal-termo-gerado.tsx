"use client";

import { Printer, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TermoGeradoNaFinalizacao = {
  osId: string;
  numeroOS: string;
  prazoGarantiaDias: number | null;
};

/**
 * O termo de garantia, na hora em que ele nasce.
 *
 * Antes, finalizar uma OS disparava só um toast dizendo "finalizada com
 * garantia gerada" — e quem precisava do papel tinha que ir até a aba
 * Garantias, achar a linha no meio da lista e clicar em imprimir. Um caminho
 * inteiro para buscar o documento que acabou de ser criado, bem no momento em
 * que o cliente está na frente do balcão esperando para assinar.
 *
 * Imprimir abre em aba nova de propósito: a finalização continua onde estava,
 * e quem imprime volta para a lista sem perder o lugar.
 */
export function ModalTermoGerado({
  termo,
  aoFechar,
}: {
  termo: TermoGeradoNaFinalizacao | null;
  aoFechar: () => void;
}) {
  return (
    <Dialog open={termo !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-kx-sucesso-icone" aria-hidden />
            <DialogTitle>{termo?.numeroOS} finalizada</DialogTitle>
          </div>
          <DialogDescription>
            {termo?.prazoGarantiaDias
              ? `O termo de garantia de ${termo.prazoGarantiaDias} dias foi gerado e já pode ser impresso para o cliente assinar.`
              : "O termo de garantia foi gerado e já pode ser impresso para o cliente assinar."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>
            <X className="h-4 w-4" />
            Agora não
          </Button>

          {termo && (
            <Button asChild>
              <a
                href={`/os/${termo.osId}/garantia`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={aoFechar}
              >
                <Printer className="h-4 w-4" />
                Imprimir termo
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
