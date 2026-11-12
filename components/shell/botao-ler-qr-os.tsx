"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LeitorCamera } from "@/components/ui/leitor-camera";
import { caminhoDaOS, idDaOSNoQrLido } from "@/lib/dominio/os/link-da-os";

/**
 * "Ler QR da OS", na barra de cima de toda tela.
 *
 * Fica na moldura, e nao dentro da tela de OS, porque o gesto do tecnico e
 * "peguei o aparelho na bancada, quero a OS dele" — de onde quer que esteja
 * no sistema. Abre a OS pelo caminho interno; o endereco lido nunca e seguido
 * (ver lib/dominio/os/link-da-os.ts).
 */
export function BotaoLerQrDaOS() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Ler QR code da OS" onClick={() => setAberto(true)}>
        <QrCode className="h-5 w-5" />
      </Button>
      <LeitorCamera
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Abrir OS pelo QR code"
        instrucao="Aponte para o QR code impresso na ordem de serviço."
        onLido={(texto) => {
          const id = idDaOSNoQrLido(texto);
          if (!id) {
            toast.error("Este código não é o QR de uma OS.");
            return;
          }
          router.push(caminhoDaOS(id));
        }}
      />
    </>
  );
}
