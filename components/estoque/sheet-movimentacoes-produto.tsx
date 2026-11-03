"use client";

import { useEffect, useState } from "react";

import {
  listarMovimentacoesProduto,
  type LinhaMovimentacaoProduto,
} from "@/app/actions/estoque";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  EsqueletoMovimentacoes,
  ListaMovimentacoes,
} from "@/components/estoque/lista-movimentacoes";


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
            <EsqueletoMovimentacoes />
          )}

          {!carregando && linhas !== null && linhas.length === 0 && (
            <p className="py-10 text-center text-sm text-kx-legenda">
              Nenhuma movimentação registrada para este produto ainda.
            </p>
          )}

          {!carregando && linhas !== null && linhas.length > 0 && (
            <ListaMovimentacoes linhas={linhas} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
