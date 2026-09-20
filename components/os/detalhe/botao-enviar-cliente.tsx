"use client";

import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type PropsBotaoEnviarCliente = {
  osId: string;
  numeroOs: string;
  telefone: string | null;
  aceitaWhatsapp: boolean;
};

/**
 * "Enviar ao cliente" (Fase 3-2B, Parte 3) — não existia ação de envio nenhuma antes,
 * só "Copiar Link de Rastreio" (agora no menu "⋮"). Reaproveita o mesmo link público
 * de rastreio: abre o WhatsApp do cliente com a mensagem pronta quando ele aceita
 * WhatsApp, ou cai para copiar o link quando não há telefone cadastrado —
 * nunca falha silenciosamente.
 */
export function BotaoEnviarCliente({ osId, numeroOs, telefone, aceitaWhatsapp }: PropsBotaoEnviarCliente) {
  const enviar = () => {
    const url = `${window.location.origin}/rastreio/${osId}`;

    if (telefone && aceitaWhatsapp) {
      const digitos = telefone.replace(/\D/g, "");
      const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
      const mensagem = encodeURIComponent(`Olá! Acompanhe o andamento da OS ${numeroOs} pelo link: ${url}`);
      window.open(`https://wa.me/${comPais}?text=${mensagem}`, "_blank", "noopener,noreferrer");
      return;
    }

    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copiado com sucesso!", {
        description: "Cliente sem WhatsApp cadastrado — compartilhe o link por outro canal.",
      });
    });
  };

  return (
    <Button type="button" variant="outline" size="sm" className="h-[42px]" onClick={enviar}>
      <Send className="h-4 w-4" aria-hidden="true" />
      Enviar ao cliente
    </Button>
  );
}
