"use client";

import { CheckCircle, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatarMoeda } from "@/lib/pdv/formatacao-pagamento-pdv";

interface PropsModalVendaConcluidaPdv {
  aberto: boolean;
  vendaIdGerada: string | null;
  totalVendaFinalizada: number;
  aoNovaVenda: () => void;
}

/**
 * Estado terminal de sucesso da venda — antes vivia dentro de
 * components/pdv/modal-pagamento.tsx (branch `vendaFinalizada`). Continua
 * como um modal (diferente da Etapa Pagamento, que virou tela): depois de
 * confirmada, a venda já não é mais "uma etapa em edição", é um resultado —
 * e imprimir/enviar recibo por cima da tela (em vez de navegar pra outro
 * lugar) preserva o fluxo rápido de balcão. Nenhuma lógica de recibo/
 * WhatsApp/nova-venda mudou aqui.
 */
export function ModalVendaConcluidaPdv({
  aberto,
  vendaIdGerada,
  totalVendaFinalizada,
  aoNovaVenda,
}: PropsModalVendaConcluidaPdv) {
  const urlRecibo = vendaIdGerada ? `/recibo/${vendaIdGerada}` : null;

  return (
    <Dialog open={aberto} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-[95vw] max-w-md flex-col overflow-hidden rounded-[26px] border-kx-painel-borda bg-kx-painel p-0"
      >
        <div className="flex max-h-[90vh] flex-col items-center justify-center space-y-5 overflow-y-auto px-6 py-6 text-center">
          <DialogTitle className="sr-only">Venda finalizada com sucesso</DialogTitle>
          <DialogDescription className="sr-only">
            Resumo da venda concluída, com opções de imprimir ou enviar o recibo.
          </DialogDescription>
          <CheckCircle size={64} className="text-kx-sucesso-icone animate-pulse" />

          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-kx-texto">Venda Finalizada com Sucesso!</h3>
            <p className="text-kx-legenda">
              Total da venda: <span className="font-semibold text-kx-texto">{formatarMoeda(totalVendaFinalizada)}</span>
            </p>
            {vendaIdGerada && (
              <p className="text-kx-legenda">
                Comprovante: <span className="font-semibold text-kx-texto">#{vendaIdGerada.slice(0, 8)}</span>
              </p>
            )}
          </div>

          {urlRecibo && (
            <div className="w-full overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao">
              <iframe src={`${urlRecibo}?embed=1`} title="Preview do recibo" className="h-56 w-full" />
            </div>
          )}

          <div className="w-full space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!urlRecibo) return;
                window.open(`${urlRecibo}?autoprint=1`, "_blank", "noopener,noreferrer");
              }}
              disabled={!urlRecibo}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Recibo
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(
                    `Olá! Segue o comprovante da sua compra. Total: ${formatarMoeda(totalVendaFinalizada)}${
                      vendaIdGerada ? ` | Venda: #${vendaIdGerada.slice(0, 8)}` : ""
                    }`
                  )}`,
                  "_blank"
                )
              }
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar pelo WhatsApp
            </Button>

          </div>

          <div className="w-full border-t border-kx-painel-borda pt-4">
            <Button type="button" className="h-12 w-full text-base" onClick={aoNovaVenda}>
              Nova Venda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
