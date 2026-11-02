import { AlertTriangle, Boxes, PackageX, TrendingUp, Wallet } from "lucide-react";

import type { IndicadoresEstoque } from "@/app/actions/estoque";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Indicadores do topo do Estoque.
 *
 * "Abaixo do mínimo" e "sem estoque" são cartões separados de propósito: um
 * ainda vende e precisa de reposição, o outro já deixou de vender. Juntar os
 * dois num número só esconderia a diferença entre "repõe esta semana" e
 * "está perdendo venda agora".
 *
 * Os cartões de dinheiro desaparecem para quem não tem a permissão
 * `estoque.ver_custos` — a action devolve `null`, e aqui `null` não vira R$ 0,00,
 * que mentiria dizendo que o estoque não vale nada.
 */
export function IndicadoresEstoque({ dados }: { dados: IndicadoresEstoque }) {
  const cartoes = [
    {
      chave: "itens",
      rotulo: "Produtos ativos",
      valor: String(dados.totalItens),
      detalhe: `${dados.unidadesTotais} unidades no total`,
      icone: Boxes,
      classeIcone: "text-kx-info-icone",
      classeCartao: "border-kx-painel-borda bg-kx-cartao",
    },
    dados.valorACusto !== null
      ? {
          chave: "custo",
          rotulo: "Valor a custo",
          valor: formatarMoeda(dados.valorACusto),
          detalhe: "O que está imobilizado na prateleira",
          icone: Wallet,
          classeIcone: "text-kx-info-icone",
          classeCartao: "border-kx-info bg-kx-info-fundo",
        }
      : null,
    dados.margemPotencial !== null
      ? {
          chave: "margem",
          rotulo: "Lucro potencial",
          valor: formatarMoeda(dados.margemPotencial),
          detalhe: "Se vendesse todo o estoque pelo preço atual",
          icone: TrendingUp,
          classeIcone: "text-kx-sucesso-icone",
          classeCartao: "border-kx-sucesso bg-kx-sucesso-fundo",
        }
      : null,
    {
      chave: "minimo",
      rotulo: "Abaixo do mínimo",
      valor: String(dados.abaixoDoMinimo),
      detalhe: "Ainda vende, mas precisa repor",
      icone: AlertTriangle,
      classeIcone: "text-kx-alerta-icone",
      classeCartao:
        dados.abaixoDoMinimo > 0
          ? "border-kx-alerta bg-kx-alerta-fundo"
          : "border-kx-painel-borda bg-kx-cartao",
    },
    {
      chave: "zerado",
      rotulo: "Sem estoque",
      valor: String(dados.semEstoque),
      detalhe: "Já deixou de vender",
      icone: PackageX,
      classeIcone: "text-kx-erro-icone",
      classeCartao:
        dados.semEstoque > 0
          ? "border-kx-erro-borda bg-kx-erro-fundo"
          : "border-kx-painel-borda bg-kx-cartao",
    },
  ].filter((cartao): cartao is NonNullable<typeof cartao> => cartao !== null);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cartoes.map((cartao) => {
        const Icone = cartao.icone;

        return (
          <div
            key={cartao.chave}
            className={`rounded-kx-cartao border p-4 ${cartao.classeCartao}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-kx-legenda">
                {cartao.rotulo}
              </p>
              <Icone className={`h-4 w-4 shrink-0 ${cartao.classeIcone}`} aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-kx-texto">{cartao.valor}</p>
            <p className="mt-1 text-xs text-kx-legenda">{cartao.detalhe}</p>
          </div>
        );
      })}
    </div>
  );
}
