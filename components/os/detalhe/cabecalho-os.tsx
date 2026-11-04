"use client";

import Link from "next/link";
import { ChevronLeft, Copy, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import type { ModeloImpressaoOS } from "@prisma/client";
import type { EtapaOS, SituacaoOS } from "@/types/os";
import { ROTULOS_ETAPA_OS, ROTULOS_SITUACAO_OS } from "@/lib/dominio/os/maquina-estados";
import { PilulaStatus } from "@/components/ui/pilula-status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MenuImprimirOS } from "@/components/os/menu-imprimir-os";
import { AcaoEntregaOS } from "@/components/os/acao-entrega-os";
import { AcaoExcluirOS } from "@/components/os/acao-excluir-os";
import { BotaoGerarPedidoVenda } from "@/components/os/botao-gerar-pedido-venda";
import { BotaoEnviarCliente } from "@/components/os/detalhe/botao-enviar-cliente";
import { caminhoDeRastreio, useSlugDaLoja } from "@/contextos/contexto-loja";

const VARIANTE_ETAPA: Record<EtapaOS, "orcamento" | "conserto" | "pronto" | "entregue"> = {
  ORCAMENTO: "orcamento",
  CONSERTO: "conserto",
  PRONTO: "pronto",
  ENTREGUE: "entregue",
};

type PropsCabecalhoOS = {
  osId: string;
  numeroOs: string;
  etapa: EtapaOS;
  situacao: SituacaoOS | null;
  entregueSemServico: boolean;
  motivoSemServico: string | null;
  modeloImpressaoPadrao: ModeloImpressaoOS;
  clienteTelefone: string | null;
  clienteAceitaWhatsapp: boolean;
  statusEhEntregue: boolean;
  ehRetornoGarantia: boolean;
  possuiItens: boolean;
  prazoGarantiaPadraoDias: number;
  prazoMinimoGarantiaDias: number;
  prazoMaximoGarantiaDias: number;
  podeEnviarAoPdv: boolean;
  podeGerarPedidoVenda: boolean;
  possuiPedidoVenda: boolean;
  podeExcluir: boolean;
};

/** Cabeçalho da tela de detalhe da OS (referência: docs/design/referencia-os-detalhe.html). */
export function CabecalhoOS({
  osId,
  numeroOs,
  etapa,
  situacao,
  entregueSemServico,
  motivoSemServico,
  modeloImpressaoPadrao,
  clienteTelefone,
  clienteAceitaWhatsapp,
  statusEhEntregue,
  ehRetornoGarantia,
  possuiItens,
  prazoGarantiaPadraoDias,
  prazoMinimoGarantiaDias,
  prazoMaximoGarantiaDias,
  podeEnviarAoPdv,
  podeGerarPedidoVenda,
  possuiPedidoVenda,
  podeExcluir,
}: PropsCabecalhoOS) {
  const slugDaLoja = useSlugDaLoja();

  const copiarLinkRastreio = () => {
    const url = `${window.location.origin}${caminhoDeRastreio(slugDaLoja, osId)}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copiado com sucesso!", {
        description: "Compartilhe com o cliente para ele acompanhar o reparo.",
      });
    });
  };

  return (
    <header className="flex flex-wrap items-center gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/os" className="inline-flex items-center text-xs text-kx-legenda hover:text-kx-texto-2">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Ordens de Serviço
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xl font-extrabold tracking-tight text-kx-texto">OS {numeroOs}</span>
          <PilulaStatus variante={VARIANTE_ETAPA[etapa]}>{ROTULOS_ETAPA_OS[etapa]}</PilulaStatus>
          {situacao && <PilulaStatus variante="alerta">{ROTULOS_SITUACAO_OS[situacao]}</PilulaStatus>}
          {entregueSemServico && (
            <PilulaStatus variante="neutro" title={motivoSemServico ?? undefined}>
              Entregue sem serviço
            </PilulaStatus>
          )}
          {!podeGerarPedidoVenda && possuiPedidoVenda && (
            <PilulaStatus variante="sucesso">Pedido de venda já gerado</PilulaStatus>
          )}
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <MenuImprimirOS osId={osId} modeloPadrao={modeloImpressaoPadrao} />
        <BotaoEnviarCliente
          osId={osId}
          numeroOs={numeroOs}
          telefone={clienteTelefone}
          aceitaWhatsapp={clienteAceitaWhatsapp}
        />
        {podeGerarPedidoVenda && <BotaoGerarPedidoVenda osId={osId} />}
        {podeEnviarAoPdv && !possuiItens && (
          <BotaoGerarPedidoVenda
            osId={osId}
            desabilitado
            mensagemBloqueio="Cadastre uma peça ou serviço antes de enviar a OS ao PDV."
          />
        )}
        {!statusEhEntregue && (
          <AcaoEntregaOS
            osId={osId}
            numeroOs={numeroOs}
            ehRetornoGarantia={ehRetornoGarantia}
            possuiItens={possuiItens}
            prazoGarantiaPadraoDias={prazoGarantiaPadraoDias}
            prazoMinimoGarantiaDias={prazoMinimoGarantiaDias}
            prazoMaximoGarantiaDias={prazoMaximoGarantiaDias}
          />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mais ações"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-texto-2 transition-colors hover:bg-kx-superficie"
            >
              <MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={copiarLinkRastreio}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar link de rastreio
            </DropdownMenuItem>
            {podeExcluir && (
              <>
                <DropdownMenuSeparator />
                <AcaoExcluirOS osId={osId} numeroOs={numeroOs} />
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
