"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

type PropsBotaoGerarPedidoVenda = {
  osId: string;
  desabilitado?: boolean;
  mensagemBloqueio?: string;
};

export function BotaoGerarPedidoVenda({
  osId,
  desabilitado = false,
  mensagemBloqueio,
}: PropsBotaoGerarPedidoVenda) {
  if (desabilitado) {
    return (
      <Button
        type="button"
        size="sm"
        disabled
        className="h-9 bg-emerald-600 text-white"
        title={mensagemBloqueio}
      >
        <ShoppingCart className="h-4 w-4 mr-2" />
        Enviar para o PDV
      </Button>
    );
  }

  return (
    <Button
      asChild
      type="button"
      size="sm"
      className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
    >
      <Link href={`/pdv?osId=${encodeURIComponent(osId)}`}>
        <ShoppingCart className="h-4 w-4 mr-2" />
        Enviar para o PDV
      </Link>
    </Button>
  );
}