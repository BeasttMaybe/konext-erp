"use client";

import { Loader2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ControleDescontoPdv } from "@/components/pdv/balcao/controle-desconto-pdv";
import type { ConfiguracaoPagamentosPDV } from "@/app/actions/pdv";
import type { ResultadoLimiteDesconto } from "@/lib/dominio/pdv/desconto-input";

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

interface PropsResumoVendaPdv {
  quantidadeItens: number;
  subtotal: number;
  descontoAplicado: number;
  clienteResumo: string;
  total: number;
  dica: string;
  rotuloBotaoPrimario: string;
  atalhoBotaoPrimario: string;
  botaoPrimarioDesabilitado: boolean;
  botaoPrimarioProcessando?: boolean;
  onClickBotaoPrimario: () => void;
  // Desconto (Fase anterior, lógica intocada — só relocada pra um popover)
  configuracaoPagamentosPdv: ConfiguracaoPagamentosPDV | null;
  desconto: number;
  tipoDesconto: "FIXO" | "PERCENTUAL";
  limiteDesconto: ResultadoLimiteDesconto;
  descontoBloqueiaVenda: boolean;
  descontoTextoEmEdicao: string | null;
  onTextoEmEdicaoChange: (texto: string | null) => void;
  onDescontoChange: (valor: number) => void;
  onTipoDescontoChange: (tipo: "FIXO" | "PERCENTUAL") => void;
  descontoPainelAberto: boolean;
  onDescontoPainelAbertoChange: (aberto: boolean) => void;
}

/**
 * Coluna direita FIXA nas 3 etapas (referência:
 * docs/design/referencia-pdv-tres-etapas.html). O botão primário aqui é o
 * ÚNICO caminho de avançar/confirmar a venda — os cliques na barra de
 * etapas (components/pdv/balcao/barra-etapas-pdv.tsx) só navegam. O total
 * NUNCA é repetido dentro de uma etapa: esta coluna é a fonte única dele.
 */
export function ResumoVendaPdv({
  quantidadeItens,
  subtotal,
  descontoAplicado,
  clienteResumo,
  total,
  dica,
  rotuloBotaoPrimario,
  atalhoBotaoPrimario,
  botaoPrimarioDesabilitado,
  botaoPrimarioProcessando = false,
  onClickBotaoPrimario,
  configuracaoPagamentosPdv,
  desconto,
  tipoDesconto,
  limiteDesconto,
  descontoBloqueiaVenda,
  descontoTextoEmEdicao,
  onTextoEmEdicaoChange,
  onDescontoChange,
  onTipoDescontoChange,
  descontoPainelAberto,
  onDescontoPainelAbertoChange,
}: PropsResumoVendaPdv) {
  return (
    <aside
      aria-label="Resumo da venda"
      className="flex min-h-0 flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4"
    >
      <span className="text-[15px] font-bold text-kx-texto">Resumo da venda</span>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[13px] text-kx-texto-2">
          <span>Itens</span>
          <span className="tabular-nums">{quantidadeItens}</span>
        </div>
        <div className="flex justify-between text-[13px] text-kx-texto-2">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatarMoeda(subtotal)}</span>
        </div>
        <div className="flex justify-between text-[13px] text-kx-sucesso-texto">
          <span>Desconto</span>
          <span className="tabular-nums">- {formatarMoeda(descontoAplicado)}</span>
        </div>
        <div className="flex justify-between text-[13px] text-kx-texto-2">
          <span>Cliente</span>
          <span className="truncate font-semibold" title={clienteResumo}>{clienteResumo}</span>
        </div>
      </div>

      <div className="flex items-baseline justify-between rounded-kx-cartao bg-kx-entregue-fundo px-4 py-3.5">
        <span className="text-sm font-bold text-kx-texto">Total</span>
        <span className="text-[28px] font-extrabold tabular-nums text-kx-texto">{formatarMoeda(total)}</span>
      </div>

      {configuracaoPagamentosPdv?.permitirDescontoPDV && (
        <Popover open={descontoPainelAberto} onOpenChange={onDescontoPainelAbertoChange}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-10 w-full justify-center rounded-kx-botao text-[13px] font-semibold">
              <Percent className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Desconto <span className="ml-1.5 text-xs opacity-70">F6</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[300px] border-kx-painel-borda bg-kx-painel p-3 text-kx-texto">
            <ControleDescontoPdv
              desconto={desconto}
              tipoDesconto={tipoDesconto}
              subtotal={subtotal}
              configuracaoPagamentosPdv={configuracaoPagamentosPdv}
              limiteDesconto={limiteDesconto}
              descontoBloqueiaVenda={descontoBloqueiaVenda}
              descontoTextoEmEdicao={descontoTextoEmEdicao}
              onTextoEmEdicaoChange={onTextoEmEdicaoChange}
              onDescontoChange={onDescontoChange}
              onTipoDescontoChange={onTipoDescontoChange}
            />
          </PopoverContent>
        </Popover>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <span className="text-xs leading-relaxed text-kx-legenda">{dica}</span>
        <Button
          type="button"
          onClick={onClickBotaoPrimario}
          disabled={botaoPrimarioDesabilitado || botaoPrimarioProcessando}
          className="h-[54px] w-full rounded-kx-botao text-base font-extrabold"
        >
          {botaoPrimarioProcessando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              {rotuloBotaoPrimario}
              <span className="ml-2 text-xs opacity-80">{atalhoBotaoPrimario}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
