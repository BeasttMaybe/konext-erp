import { ArrowDownRight, ArrowUpRight, SlidersHorizontal } from "lucide-react";

import type { LinhaMovimentacaoProduto } from "@/app/actions/estoque";

/**
 * As linhas do livro de movimentações de um produto.
 *
 * Extraída do sheet de movimentações quando a página do produto passou a
 * mostrar as mesmas linhas: eram os rótulos de origem e o desenho da linha
 * copiados em dois lugares, e a terceira cópia é sempre a que fica diferente.
 */

const ROTULO_ORIGEM: Record<string, string> = {
  VENDA_PDV: "Venda no balcão",
  PEDIDO_VENDA: "Pedido de venda",
  ESTORNO_VENDA: "Estorno de venda",
  CADASTRO: "Cadastro do produto",
  AJUSTE_MANUAL: "Ajuste manual",
  COMPRA_XML: "Nota de compra",
  INVENTARIO: "Inventário",
  HISTORICO_RECONSTRUIDO: "Histórico reconstruído",
};

export function ListaMovimentacoes({ linhas }: { linhas: LinhaMovimentacaoProduto[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {linhas.map((linha) => (
        <li
          key={linha.id}
          className="rounded-kx-botao border border-kx-painel-borda bg-kx-cartao px-3 py-2.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <IconeTipo tipo={linha.tipo} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-kx-texto">
                  {ROTULO_ORIGEM[linha.origem] ?? linha.origem}
                </p>
                <p className="text-xs text-kx-legenda">
                  {new Date(linha.criadoEm).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p
                className={`text-sm font-bold tabular-nums ${
                  linha.tipo === "SAIDA" ? "text-kx-erro-texto" : "text-kx-sucesso-texto"
                }`}
              >
                {linha.tipo === "SAIDA" ? "−" : "+"}
                {linha.quantidade}
              </p>
              {linha.saldoPosterior !== null && (
                <p className="text-xs tabular-nums text-kx-legenda">
                  saldo: {linha.saldoPosterior}
                </p>
              )}
            </div>
          </div>

          {linha.observacao && <p className="mt-1.5 text-xs text-kx-texto-2">{linha.observacao}</p>}
        </li>
      ))}
    </ul>
  );
}

export function EsqueletoMovimentacoes({ linhas = 6 }: { linhas?: number }) {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: linhas }).map((_, indice) => (
        <li key={indice} className="h-16 animate-pulse rounded-kx-botao bg-kx-superficie" />
      ))}
    </ul>
  );
}

function IconeTipo({ tipo }: { tipo: string }) {
  if (tipo === "SAIDA") {
    return <ArrowDownRight className="mt-0.5 h-4 w-4 shrink-0 text-kx-erro-icone" aria-hidden />;
  }

  if (tipo === "ENTRADA") {
    return <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-kx-sucesso-icone" aria-hidden />;
  }

  return <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-kx-alerta-icone" aria-hidden />;
}
