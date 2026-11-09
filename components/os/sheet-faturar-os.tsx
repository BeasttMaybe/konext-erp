"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { verificarStatusCaixa } from "@/app/actions/caixa-pdv";
import {
  obterConfiguracaoPagamentosPDV,
  obterPedidoOSParaPDV,
  processarVendaComOSNoPDV,
  type ConfiguracaoPagamentosPDV,
  type PedidoOSPDV,
} from "@/app/actions/pdv";
import { EtapaPagamentoPdv } from "@/components/pdv/balcao/etapa-pagamento-pdv";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deDecimal, formatarReais } from "@/lib/dinheiro";
import { usePagamentoPdv, type DadosPagamento } from "@/lib/pdv/hooks/usar-pagamento-pdv";

/**
 * Fechar a venda da OS sem sair da OS.
 *
 * O dono descreveu o atrito: "dessa forma não tem a perda de tempo de ficar
 * indo pro PDV e depois voltar pra OS". Entregar um aparelho pronto é o
 * caso mais comum do balcão, e ele não precisa de carrinho: os itens já
 * estão na OS e o cliente já está na OS. O que falta é escolher a forma de
 * pagamento e confirmar.
 *
 * ISTO NÃO É UM SEGUNDO PDV.
 *
 * A tela de pagamento é a MESMA (`EtapaPagamentoPdv`), movida pelo MESMO
 * hook (`usePagamentoPdv`), e a venda é gravada pela MESMA action
 * (`processarVendaComOSNoPDV`). Nada aqui reimplementa troco, forma de
 * pagamento, idempotência ou as travas de boleto e crediário — escrever uma
 * segunda versão dessas regras seria garantir que um dia as duas
 * discordassem, e a que discorda em silêncio é sempre a que ninguém olha.
 *
 * O caminho longo continua existindo: quem precisa ACRESCENTAR produtos à
 * venda da OS abre no PDV pelo link daqui. Esta tela cobre o caso comum;
 * ela não tenta cobrir todos.
 */

type Props = {
  osId: string;
  numeroOs: number | string;
  aoFechar: () => void;
};

export function SheetFaturarOS({ osId, numeroOs, aoFechar }: Props) {
  const router = useRouter();

  const [pedido, setPedido] = useState<PedidoOSPDV | null>(null);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoPagamentosPDV | null>(null);
  const [caixaAberto, setCaixaAberto] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    void Promise.all([
      obterPedidoOSParaPDV(osId),
      obterConfiguracaoPagamentosPDV(),
      verificarStatusCaixa(),
    ])
      .then(([pedidoCarregado, configuracaoCarregada, caixa]) => {
        if (!ativo) return;
        setPedido(pedidoCarregado);
        setConfiguracao(configuracaoCarregada);
        setCaixaAberto(caixa);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        setErro(
          falha instanceof Error ? falha.message : "Não foi possível carregar a OS para faturar."
        );
      });

    return () => {
      ativo = false;
    };
  }, [osId]);

  async function confirmar(dados: DadosPagamento) {
    try {
      const venda = await processarVendaComOSNoPDV(osId, [], dados.pagamentos, {
        chaveIdempotencia: dados.chaveIdempotencia,
      });

      toast.success("Ordem de Serviço faturada!", {
        description: `A OS #${numeroOs} virou venda.`,
      });

      // A OS muda de estado com o faturamento (passa a ter venda vinculada),
      // então a tela precisa refletir isso — senão o botão de faturar
      // continuaria ali, convidando a uma segunda venda que o servidor
      // recusaria.
      router.refresh();

      return { sucesso: true, vendaId: venda.vendaId };
    } catch (falha) {
      return {
        sucesso: false,
        mensagem:
          falha instanceof Error ? falha.message : "Não foi possível faturar a OS. Tente de novo.",
      };
    }
  }

  const pagamento = usePagamentoPdv({
    total: pedido?.valor ?? 0,
    configuracaoPagamento: configuracao,
    // A OS sempre tem cliente — é o que a diferencia de uma venda de balcão.
    // Por isso boleto e crediário podem ser usados aqui sem a trava de
    // "consumidor final" que o PDV precisa aplicar.
    temClienteSelecionado: true,
    tentativaVendaId: 0,
    aoConfirmar: confirmar,
    aoPrecisarDeCliente: () => {
      toast.error("Esta OS está sem cliente. Edite a OS antes de faturar.");
    },
  });

  const carregando = !erro && (pedido === null || configuracao === null || caixaAberto === null);

  return (
    <Sheet
      open
      onOpenChange={(aberto) => {
        if (!aberto) aoFechar();
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-kx-painel-borda px-6 py-5">
          <SheetTitle>Faturar OS #{numeroOs}</SheetTitle>
          <SheetDescription>
            {pedido
              ? `${pedido.nomeCliente} · ${formatarReais(deDecimal(pedido.valor))}`
              : "Carregando os itens da ordem…"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {carregando && (
            <p className="flex items-center gap-2 py-10 text-sm text-kx-legenda">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando…
            </p>
          )}

          {erro && (
            <div className="space-y-3 py-6">
              <p className="rounded-kx-painel border border-kx-erro-borda bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
                {erro}
              </p>
              <Button variant="outline" onClick={aoFechar}>
                Fechar
              </Button>
            </div>
          )}

          {/* Caixa fechado trava a venda no servidor. Dizer isso ANTES de a
              pessoa escolher a forma de pagamento evita que ela monte o
              pagamento inteiro para só então descobrir. */}
          {!carregando && !erro && caixaAberto === false && (
            <div className="space-y-3 py-6 text-center">
              <Lock className="mx-auto h-6 w-6 text-kx-legenda" aria-hidden />
              <p className="text-sm font-semibold text-kx-texto">O caixa está fechado.</p>
              <p className="text-xs text-kx-legenda">
                Abra o caixa no PDV para registrar a venda desta OS.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/pdv">Ir para o PDV</Link>
              </Button>
            </div>
          )}

          {!carregando && !erro && caixaAberto === true && (
            <EtapaPagamentoPdv pagamento={pagamento} />
          )}
        </div>

        {!carregando && !erro && caixaAberto === true && (
          <div className="flex items-center justify-between gap-3 border-t border-kx-painel-borda px-6 py-4">
            {/* O caminho longo continua existindo: esta tela cobre o caso
                comum (só pagamento), e quem precisa acrescentar produtos à
                venda da OS abre no PDV. */}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/pdv?osId=${encodeURIComponent(osId)}`}>
                <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
                Abrir no PDV
              </Link>
            </Button>

            <Button
              onClick={() => pagamento.handleConfirmar()}
              disabled={!pagamento.podeConfirmar || pagamento.vendaFinalizada}
            >
              Confirmar faturamento
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
