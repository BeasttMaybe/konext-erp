"use client";

import { useEffect, useState } from "react";
import { Clock, TrendingUp } from "lucide-react";

import {
  obterCurvaABC,
  obterProdutosParados,
  type LinhaCurvaABC,
  type ProdutoParado,
} from "@/app/actions/estoque";
import { PilulaStatus } from "@/components/ui/pilula-status";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CLASSE_ABC: Record<LinhaCurvaABC["classe"], { variante: "sucesso" | "alerta" | "neutro"; texto: string }> =
  {
    A: { variante: "sucesso", texto: "A" },
    B: { variante: "alerta", texto: "B" },
    C: { variante: "neutro", texto: "C" },
  };

/**
 * Os dois relatórios que respondem as perguntas que o estoque não respondia:
 * "o que paga a loja" e "o que está parado custando dinheiro".
 *
 * Os dois leem do histórico de vendas (`ItemVenda`), não do livro de
 * movimentações: o livro só registra a partir de 02/11/2026, e ler dele faria
 * os relatórios ignorarem todo o passado da loja. A venda é contada uma vez,
 * pela tabela que a representa — as duas fontes nunca são somadas.
 */
export function RelatoriosEstoque() {
  const [diasCurva, setDiasCurva] = useState(90);
  const [diasParado, setDiasParado] = useState(60);

  /**
   * Guarda o resultado JUNTO com o período que o produziu. "Carregando" é
   * então derivado — se o período guardado não é o pedido, os dados na tela
   * são de outro intervalo e ainda não chegaram os novos.
   *
   * Sem isso seria preciso um `setCarregando(true)` síncrono dentro do
   * efeito, que a regra `react-hooks/set-state-in-effect` barra com razão:
   * dispara uma renderização em cascata, e o estado derivado já diz a mesma
   * coisa sem render extra.
   */
  const [resultado, setResultado] = useState<{
    diasCurva: number;
    diasParado: number;
    curva: LinhaCurvaABC[];
    parados: ProdutoParado[];
  } | null>(null);

  const carregando =
    resultado === null ||
    resultado.diasCurva !== diasCurva ||
    resultado.diasParado !== diasParado;

  const curva = carregando ? null : resultado.curva;
  const parados = carregando ? null : resultado.parados;

  useEffect(() => {
    let ativo = true;

    Promise.all([obterCurvaABC(diasCurva), obterProdutosParados(diasParado)]).then(
      ([curvaResultado, paradosResultado]) => {
        if (!ativo) return;
        setResultado({
          diasCurva,
          diasParado,
          curva: curvaResultado,
          parados: paradosResultado,
        });
      }
    );

    return () => {
      ativo = false;
    };
  }, [diasCurva, diasParado]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-kx-sucesso-icone" aria-hidden />
            <h2 className="text-sm font-bold text-kx-texto">O que puxa o faturamento</h2>
          </div>
          <SeletorPeriodo valor={diasCurva} aoMudar={setDiasCurva} />
        </header>

        <p className="mt-1 text-xs text-kx-legenda">
          Classe A são os produtos que somam os primeiros 80% da receita; B até 95%; C o resto.
        </p>

        {carregando && <Esqueleto linhas={5} />}

        {!carregando && curva !== null && curva.length === 0 && (
          <p className="py-8 text-center text-sm text-kx-legenda">
            Nenhuma venda de produto registrada neste período.
          </p>
        )}

        {!carregando && curva !== null && curva.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {curva.map((linha) => (
              <li
                key={linha.produtoId}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-kx-botao border border-kx-painel-borda bg-kx-cartao px-3 py-2"
              >
                <PilulaStatus variante={CLASSE_ABC[linha.classe].variante}>
                  {CLASSE_ABC[linha.classe].texto}
                </PilulaStatus>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-kx-texto">{linha.nome}</p>
                  <p className="text-xs text-kx-legenda">
                    {linha.unidadesVendidas} un · {linha.participacao.toFixed(1)}% da receita
                  </p>
                </div>
                <span className="text-right text-sm font-bold tabular-nums text-kx-texto">
                  {formatarMoeda(linha.receita)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-kx-alerta-icone" aria-hidden />
            <h2 className="text-sm font-bold text-kx-texto">Capital parado</h2>
          </div>
          <SeletorPeriodo valor={diasParado} aoMudar={setDiasParado} />
        </header>

        <p className="mt-1 text-xs text-kx-legenda">
          Tem estoque e não vende desde então. Inclui o que nunca vendeu.
        </p>

        {carregando && <Esqueleto linhas={5} />}

        {!carregando && parados !== null && parados.length === 0 && (
          <p className="py-8 text-center text-sm text-kx-legenda">
            Nada parado nesse intervalo. Todo produto com estoque vendeu.
          </p>
        )}

        {!carregando && parados !== null && parados.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {parados.map((produto) => (
              <li
                key={produto.produtoId}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-kx-botao border border-kx-painel-borda bg-kx-cartao px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-kx-texto">{produto.nome}</p>
                  <p className="text-xs text-kx-legenda">
                    {produto.quantidadeEstoque} un ·{" "}
                    {produto.diasSemVender === null
                      ? "nunca vendeu"
                      : `${produto.diasSemVender} dias sem vender`}
                  </p>
                </div>
                {produto.capitalParado !== null && (
                  <span className="text-right text-sm font-bold tabular-nums text-kx-alerta-texto">
                    {formatarMoeda(produto.capitalParado)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SeletorPeriodo({ valor, aoMudar }: { valor: number; aoMudar: (dias: number) => void }) {
  const opcoes = [30, 60, 90, 180];

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Período">
      {opcoes.map((dias) => (
        <button
          key={dias}
          type="button"
          onClick={() => aoMudar(dias)}
          aria-pressed={valor === dias}
          className={`rounded-kx-pilula border px-2.5 py-1 text-xs font-bold transition-colors ${
            valor === dias
              ? "border-kx-primaria bg-kx-primaria text-primary-foreground"
              : "border-kx-painel-borda bg-kx-superficie text-kx-texto-2 hover:border-kx-destaque"
          }`}
        >
          {dias}d
        </button>
      ))}
    </div>
  );
}

function Esqueleto({ linhas }: { linhas: number }) {
  return (
    <ul className="mt-3 flex flex-col gap-1.5" aria-hidden>
      {Array.from({ length: linhas }).map((_, indice) => (
        <li key={indice} className="h-12 animate-pulse rounded-kx-botao bg-kx-superficie" />
      ))}
    </ul>
  );
}
