"use client";

import { Check } from "lucide-react";
import type { EtapaPdv } from "@/lib/dominio/pdv/etapas-pdv";

interface DefinicaoEtapa {
  etapa: EtapaPdv;
  numero: number;
  titulo: string;
  atalho: string;
  completa: boolean;
}

interface PropsBarraEtapasPdv {
  etapaAtual: EtapaPdv;
  quantidadeItens: number;
  clienteResumo: string;
  totalFormatado: string;
  produtoCompleta: boolean;
  clienteCompleta: boolean;
  pagamentoCompleta: boolean;
  onEscolher: (etapa: EtapaPdv) => void;
}

/**
 * Barra de 3 etapas (referência: docs/design/referencia-pdv-tres-etapas.html).
 * Clicável em qualquer ordem — só NAVEGA, nunca confirma nada (quem
 * avança/confirma é sempre o botão primário da coluna "Resumo da venda",
 * ver components/pdv/balcao/resumo-venda-pdv.tsx). O subtítulo de cada bolha
 * é a contagem "ao vivo" correspondente àquela etapa: itens (Produto),
 * cliente escolhido (Cliente) e total (Pagamento).
 */
export function BarraEtapasPdv({
  etapaAtual,
  quantidadeItens,
  clienteResumo,
  totalFormatado,
  produtoCompleta,
  clienteCompleta,
  pagamentoCompleta,
  onEscolher,
}: PropsBarraEtapasPdv) {
  const etapas: DefinicaoEtapa[] = [
    { etapa: "produto", numero: 1, titulo: "Produto", atalho: "Alt+1", completa: produtoCompleta },
    { etapa: "cliente", numero: 2, titulo: "Cliente", atalho: "Alt+2", completa: clienteCompleta },
    { etapa: "pagamento", numero: 3, titulo: "Pagamento", atalho: "Alt+3", completa: pagamentoCompleta },
  ];

  const detalhePorEtapa: Record<EtapaPdv, string> = {
    produto: `${quantidadeItens} ${quantidadeItens === 1 ? "item" : "itens"}`,
    cliente: clienteResumo,
    pagamento: totalFormatado,
  };

  return (
    <div className="flex gap-1 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-1" role="tablist" aria-label="Etapas da venda">
      {etapas.map((info) => {
        const ativa = etapaAtual === info.etapa;

        return (
          <button
            key={info.etapa}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onEscolher(info.etapa)}
            className={`flex h-[52px] flex-1 items-center gap-3 rounded-kx-cartao px-4 text-left transition-colors ${
              ativa ? "bg-kx-superficie text-kx-texto" : "bg-transparent text-kx-texto-2 hover:bg-kx-superficie/60"
            }`}
          >
            <span
              // Cada estado tem o SEU par fundo+texto. Antes os tres usavam
              // texto branco: no estado "ainda nao feito" o fundo era a cor de
              // borda, e no tema claro isso era branco sobre cinza-claro
              // (1,26:1) — o numero da etapa simplesmente nao aparecia. No
              // "completo", branco sobre o verde-claro de indicador tambem
              // ficava abaixo do minimo de leitura.
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                info.completa
                  ? "bg-kx-sucesso-fundo text-kx-sucesso-texto"
                  : ativa
                    ? "bg-kx-primaria text-primary-foreground"
                    : "border border-kx-campo-borda text-kx-legenda"
              }`}
            >
              {info.completa ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : info.numero}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-extrabold leading-tight">{info.titulo}</span>
              <span className="truncate text-[11px] leading-tight text-kx-legenda">{detalhePorEtapa[info.etapa]}</span>
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-kx-legenda">{info.atalho}</span>
          </button>
        );
      })}
    </div>
  );
}
