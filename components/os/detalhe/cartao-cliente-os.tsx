"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { iniciais } from "@/components/os/resumo-tecnicos-os";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HistoricoConsertosCliente } from "@/components/os/garantias/historico-consertos-cliente";

function linkWhatsapp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comPais}`;
}

type PropsCartaoClienteOS = {
  osId: string;
  nome: string;
  telefone: string | null;
  aceitaWhatsapp: boolean;
};

/** Cliente da OS — avatar de iniciais, telefone, atalho de WhatsApp e histórico (referência: docs/design/referencia-os-detalhe.html). */
export function CartaoClienteOS({ osId, nome, telefone, aceitaWhatsapp }: PropsCartaoClienteOS) {
  const [historicoAberto, setHistoricoAberto] = useState(false);

  return (
    <div className="p-kx-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kx-cartao text-sm font-extrabold text-kx-texto">
          {iniciais(nome)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold text-kx-texto">{nome}</span>
          {telefone && <span className="text-xs tabular-nums text-kx-legenda">{telefone}</span>}
        </div>
        {telefone && aceitaWhatsapp && (
          <a
            href={linkWhatsapp(telefone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp"
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-sucesso-icone transition-colors hover:bg-kx-superficie"
          >
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={() => setHistoricoAberto(true)}
        className="w-fit text-left text-xs font-semibold text-kx-link hover:text-kx-destaque"
      >
        Ver histórico do cliente ›
      </button>

      <Dialog open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico do cliente</DialogTitle>
          </DialogHeader>
          <HistoricoConsertosCliente osId={historicoAberto ? osId : null} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
