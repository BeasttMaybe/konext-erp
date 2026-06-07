"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

type PropsBotaoGerarPedidoVenda = {
  osId: string;
  desabilitado?: boolean;
};

export function BotaoGerarPedidoVenda({ osId, desabilitado = false }: PropsBotaoGerarPedidoVenda) {
  return (
    <Button
      asChild
      type="button"
      disabled={desabilitado}
      className="bg-emerald-600 hover:bg-emerald-700 text-white"
    >
      <Link href={`/pdv?osId=${encodeURIComponent(osId)}`}>
        <ShoppingCart className="h-4 w-4 mr-2" />
        Enviar para o PDV
      </Link>
    </Button>
  );
}