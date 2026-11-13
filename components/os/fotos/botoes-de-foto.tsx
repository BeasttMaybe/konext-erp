"use client";

import { useRef } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Os dois jeitos de pegar foto do aparelho, lado a lado:
 *
 * - "Tirar foto": `capture="environment"` abre direto a camera traseira. Sem
 *   isso, o Android mostra so a galeria (o pedido do dono: o tecnico precisa
 *   fotografar na hora, com o aparelho na mao).
 * - "Galeria": sem `capture`, para a foto que ja foi tirada antes.
 *
 * Por que dois campos e nao um so: `capture` e tudo-ou-nada — com ele o
 * celular esconde a galeria, sem ele o Android esconde a camera.
 *
 * No computador (`pointer-fine`, mouse) `capture` nao faz nada, entao fica so
 * um botao, "Adicionar", que abre o seletor de arquivos.
 */
export function BotoesDeFoto({
  onArquivos,
  desabilitado = false,
  ocupado = false,
  textoOcupado = "Enviando...",
  tamanho = "sm",
  className,
}: {
  onArquivos: (arquivos: FileList | null) => void;
  desabilitado?: boolean;
  ocupado?: boolean;
  textoOcupado?: string;
  tamanho?: "sm" | "lg";
  className?: string;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const aoEscolher = (evento: React.ChangeEvent<HTMLInputElement>) => {
    onArquivos(evento.target.files);
    // Limpa para a mesma foto poder ser escolhida de novo depois de removida.
    evento.target.value = "";
  };

  const grande = tamanho === "lg";
  const bloqueado = desabilitado || ocupado;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={aoEscolher} />
      <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={aoEscolher} />

      <Button
        type="button"
        size={grande ? "lg" : "sm"}
        className={cn("pointer-fine:hidden", grande && "h-14 flex-1 text-base font-bold")}
        disabled={bloqueado}
        onClick={() => camera.current?.click()}
      >
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
        {ocupado ? textoOcupado : "Tirar foto"}
      </Button>

      <Button
        type="button"
        size={grande ? "lg" : "sm"}
        variant="outline"
        className={cn(grande && "h-14 flex-1 text-base")}
        disabled={bloqueado}
        onClick={() => galeria.current?.click()}
      >
        {ocupado ? (
          <Loader2 className="h-4 w-4 animate-spin pointer-coarse:hidden" aria-hidden />
        ) : (
          <ImagePlus className="h-4 w-4" aria-hidden />
        )}
        <span className="pointer-coarse:hidden">{ocupado ? textoOcupado : "Adicionar"}</span>
        <span className="pointer-fine:hidden">Galeria</span>
      </Button>
    </div>
  );
}
