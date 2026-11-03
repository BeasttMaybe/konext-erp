import { TrendingUp } from "lucide-react";

import type { ResumoProduto } from "@/app/actions/estoque";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string, fusoHorario: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: fusoHorario,
  }).format(new Date(iso));
}

/**
 * Resumo do produto: as quatro perguntas que se faz olhando um item do estoque.
 *
 * "Vendidos no mês" sai de `ItemVenda`, e não do livro de movimentações, de
 * propósito: o livro começou na Fase 4 e as saídas anteriores foram
 * reconstruídas sem saldo, então contar por ele daria número menor que a
 * realidade em qualquer produto com histórico. A ENTRADA é o contrário — só
 * existe no livro.
 *
 * As linhas de dinheiro desaparecem para quem não tem `estoque.ver_custos`: a
 * action devolve `null`, e `null` aqui não vira R$ 0,00, que mentiria.
 */
export function PainelResumo({
  resumo,
  saldo,
  unidade,
  fusoHorario,
}: {
  resumo: ResumoProduto;
  saldo: number;
  unidade: string;
  fusoHorario: string;
}) {
  const linhas: Array<{ rotulo: string; valor: string }> = [
    {
      rotulo: "Vendidos em 30 dias",
      valor: `${resumo.vendidasNoMes} ${unidade.toLowerCase()}`,
    },
    {
      rotulo: "Vendidos no total",
      valor: `${resumo.vendidasNoTotal} ${unidade.toLowerCase()}`,
    },
    {
      rotulo: "Última entrada",
      valor: resumo.ultimaEntrada
        ? [
            formatarData(resumo.ultimaEntrada.quando, fusoHorario),
            resumo.ultimaEntrada.custoUnitario !== null
              ? formatarMoeda(resumo.ultimaEntrada.custoUnitario)
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "Nenhuma registrada",
    },
  ];

  if (resumo.valorParado !== null) {
    linhas.push({
      rotulo: "Parado na prateleira",
      valor: `${formatarMoeda(resumo.valorParado)} (${saldo} ${unidade.toLowerCase()})`,
    });
  }

  return (
    <div className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-kx-legenda" aria-hidden />
        <h2 className="text-base font-semibold text-kx-texto">Resumo</h2>
      </div>

      <dl className="mt-4 space-y-2.5">
        {linhas.map((linha) => (
          <div key={linha.rotulo} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-kx-legenda">{linha.rotulo}</dt>
            <dd className="text-sm font-semibold tabular-nums text-kx-texto">{linha.valor}</dd>
          </div>
        ))}
      </dl>

      {resumo.vendidasNoTotal === 0 && (
        <p className="mt-3 text-xs text-kx-legenda">
          Este produto nunca foi vendido pelo sistema.
        </p>
      )}
    </div>
  );
}
