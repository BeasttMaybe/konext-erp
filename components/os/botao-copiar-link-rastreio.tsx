"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface BotaoCopiarLinkRastreioProps {
  /** ID da OS — usado para montar a URL pública de rastreio. */
  osId: string;
}

/**
 * Botão client-side que copia o link de rastreio público para a área de transferência
 * e exibe uma notificação de confirmação via Sonner.
 */
export function BotaoCopiarLinkRastreio({ osId }: BotaoCopiarLinkRastreioProps) {
  function copiarLink() {
    const url = `${window.location.origin}/rastreio/${osId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copiado com sucesso!", {
        description: "Compartilhe com o cliente para ele acompanhar o reparo.",
      });
    });
  }

  return (
    <Button variant="outline" size="sm" className="h-9" onClick={copiarLink}>
      <Copy className="h-4 w-4 mr-2" />
      Copiar Link de Rastreio
    </Button>
  );
}
