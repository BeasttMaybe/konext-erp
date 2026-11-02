"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, SlidersHorizontal } from "lucide-react";

import {
  listarMovimentacoesProduto,
  type LinhaMovimentacaoProduto,
} from "@/app/actions/estoque";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

/**
 * Movimentações de um produto — o que o dono pediu como "movimentações
 * também dentro de cada produto".
 *
 * A tela diz explicitamente desde quando o livro existe. Sem isso, um produto
 * vendido durante dois anos apareceria com histórico vazio e pareceria que
 * nunca se moveu — o que é pior do que não ter a aba, porque o número errado
 * passa por certo.
 */
export function SheetMovimentacoesProduto({
  produtoId,
  produtoNome,
  aberto,
  aoFechar,
}: {
  produtoId: string | null;
  produtoNome: string | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  /**
   * O resultado guarda de QUAL produto ele é. "Carregando" sai disso: se o
   * produto guardado não é o aberto, o que está em mãos é de outro produto.
   *
   * É o que evita o `setLinhas(null)` síncrono dentro do efeito — e evita
   * também mostrar, por um instante, o histórico do produto anterior no painel
   * do produto novo.
   */
  const [resultado, setResultado] = useState<{
    produtoId: string;
    linhas: LinhaMovimentacaoProduto[];
  } | null>(null);

  const carregando = produtoId !== null && resultado?.produtoId !== produtoId;
  const linhas = carregando ? null : (resultado?.linhas ?? null);

  useEffect(() => {
    if (!aberto || !produtoId) return;

    let ativo = true;

    listarMovimentacoesProduto(produtoId).then((movimentacoes) => {
      if (ativo) setResultado({ produtoId, linhas: movimentacoes });
    });

    return () => {
      ativo = false;
    };
  }, [aberto, produtoId]);

  return (
    <Sheet open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Movimentações</SheetTitle>
        </SheetHeader>

        <div className="mt-1 px-4">
          <p className="truncate text-sm font-semibold text-kx-texto">{produtoNome}</p>
          <p className="mt-1 text-xs text-kx-legenda">
            O registro de movimentações começou em 02/11/2026. Venda anterior a essa data não
            aparece aqui.
          </p>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-4 pb-6">
          {carregando && (
            <ul className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 6 }).map((_, indice) => (
                <li key={indice} className="h-16 animate-pulse rounded-kx-botao bg-kx-superficie" />
              ))}
            </ul>
          )}

          {!carregando && linhas !== null && linhas.length === 0 && (
            <p className="py-10 text-center text-sm text-kx-legenda">
              Nenhuma movimentação registrada para este produto ainda.
            </p>
          )}

          {!carregando && linhas !== null && linhas.length > 0 && (
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
                        <p className="text-xs text-kx-legenda tabular-nums">
                          saldo: {linha.saldoPosterior}
                        </p>
                      )}
                    </div>
                  </div>

                  {linha.observacao && (
                    <p className="mt-1.5 text-xs text-kx-texto-2">{linha.observacao}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
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
