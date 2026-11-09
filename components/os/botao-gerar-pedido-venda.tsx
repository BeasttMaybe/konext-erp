"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";

import { SheetFaturarOS } from "@/components/os/sheet-faturar-os";
import { Button } from "@/components/ui/button";

/**
 * "Enviar para o PDV" passa a FATURAR AQUI.
 *
 * Antes, o botão levava para `/pdv?osId=…`: o PDV abria com os itens e o
 * cliente já carregados e o operador escolhia a forma de pagamento por lá.
 * Funcionava, mas tirava a pessoa da OS — e entregar um aparelho pronto é o
 * caso mais comum do balcão, onde não há carrinho a montar.
 *
 * Agora o clique abre o pagamento sobre a própria OS. A tela de pagamento é
 * a mesma do PDV e a venda é gravada pela mesma action; o que muda é só onde
 * ela aparece. E de dentro dela existe um link "Abrir no PDV", para quando
 * for preciso acrescentar produtos à venda.
 */

type PropsBotaoGerarPedidoVenda = {
  osId: string;
  numeroOs: number | string;
  desabilitado?: boolean;
  mensagemBloqueio?: string;
};

export function BotaoGerarPedidoVenda({
  osId,
  numeroOs,
  desabilitado = false,
  mensagemBloqueio,
}: PropsBotaoGerarPedidoVenda) {
  const [faturando, setFaturando] = useState(false);

  if (desabilitado) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="h-[42px]"
        title={mensagemBloqueio}
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        Faturar venda
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-[42px]"
        onClick={() => setFaturando(true)}
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        Faturar venda
      </Button>

      {/* Montado só quando abre: o estado do pagamento nasce limpo a cada
          tentativa, sem nenhum reset manual. */}
      {faturando && (
        <SheetFaturarOS osId={osId} numeroOs={numeroOs} aoFechar={() => setFaturando(false)} />
      )}
    </>
  );
}
