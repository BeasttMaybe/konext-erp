import { obterRelatorioPecas } from "@/app/actions/relatorio-pecas";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { formatarReais } from "@/lib/dinheiro";
import { deSearchParams } from "@/lib/filtro-periodo";
import { AcessoNegado } from "@/components/ui/acesso-negado";
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";

export const metadata = { title: "Relatório de peças | Konext" };

function formatarPercentual(valor: number | null): string {
  if (valor === null) return "—";
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * Relatório de peças por tipo e marca.
 *
 * Existe porque peça de conserto não é item de estoque nesta loja: é comprada
 * por serviço, sem entrada por nota, e por isso não tem saldo para relatar. O
 * que tem é o custo lançado na OS contra o valor cobrado do cliente — e é a
 * marca cadastrada que torna isso agrupável.
 */
export default async function RelatorioPecasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const contexto = await exigirContextoTenant();

  if (!temPermissao(contexto, "os.ver_custos")) {
    return <AcessoNegado />;
  }

  const params = await searchParams;
  const { intervalo } = deSearchParams(new URLSearchParams(params as Record<string, string>));

  const relatorio = await obterRelatorioPecas(
    intervalo?.inicio.toISOString(),
    intervalo?.fim.toISOString()
  );

  const { linhas, totais } = relatorio;

  return (
    <div className="flex w-full flex-col gap-5 bg-kx-fundo p-5 lg:p-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-kx-legenda">Ordens de serviço</span>
        <h1 className="text-2xl font-extrabold text-kx-texto">Relatório de peças</h1>
        <p className="text-sm text-kx-legenda">
          Custo e margem das peças lançadas nas OS, agrupadas por tipo e marca. Peças de OS não movimentam
          estoque — são custo direto do serviço.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <FiltroPeriodoPagina
          campos={[{ valor: "lancadas-em", rotulo: "Peças lançadas em" }]}
          fusoHorario={contexto.fusoHorario}
        />
        <span className="text-xs text-kx-legenda">
          {formatarData(relatorio.inicio)} até {formatarData(relatorio.fim)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { rotulo: "Peças no período", valor: String(totais.quantidade) },
          { rotulo: "Custo total", valor: formatarReais(totais.custoTotalCentavos) },
          { rotulo: "Cobrado do cliente", valor: formatarReais(totais.cobradoTotalCentavos) },
          {
            rotulo: "Margem",
            valor: `${formatarReais(totais.margemCentavos)} · ${formatarPercentual(totais.margemPercentual)}`,
          },
        ].map((cartao) => (
          <div
            key={cartao.rotulo}
            className="flex flex-col gap-1 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4"
          >
            <span className="text-xs font-semibold text-kx-legenda">{cartao.rotulo}</span>
            <span className="text-lg font-extrabold tabular-nums text-kx-texto">{cartao.valor}</span>
          </div>
        ))}
      </div>

      {relatorio.itensSemMarca > 0 ? (
        <p className="rounded-kx-botao border border-kx-painel-borda bg-kx-superficie px-3 py-2.5 text-xs text-kx-texto-2">
          {relatorio.itensSemMarca === 1
            ? "1 peça do período foi lançada sem marca"
            : `${relatorio.itensSemMarca} peças do período foram lançadas sem marca`}{" "}
          — são itens anteriores ao cadastro de marcas. Aparecem agrupadas como &quot;sem marca&quot;, para não
          diluir as médias das marcas reais.
        </p>
      ) : null}

      <div className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
        {linhas.length === 0 ? (
          <p className="py-10 text-center text-sm text-kx-legenda">
            Nenhuma peça lançada neste período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-xs font-semibold text-kx-legenda">
                  <th className="px-2.5 pb-2 text-left">Tipo</th>
                  <th className="px-2.5 pb-2 text-left">Marca</th>
                  <th className="px-2.5 pb-2 text-right">Qtd.</th>
                  <th className="px-2.5 pb-2 text-right">Custo</th>
                  <th className="px-2.5 pb-2 text-right">Cobrado</th>
                  <th className="px-2.5 pb-2 text-right">Margem</th>
                  <th className="px-2.5 pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr
                    key={`${linha.tipoPeca}-${linha.marcaNome ?? "sem-marca"}`}
                    className="border-t border-kx-painel-borda"
                  >
                    <td className="px-2.5 py-2.5 text-kx-texto-2">{linha.tipoPeca.replaceAll("_", " ")}</td>
                    <td className="px-2.5 py-2.5 font-medium text-kx-texto">
                      {linha.marcaNome ?? <span className="text-kx-legenda">sem marca</span>}
                    </td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums text-kx-texto-2">{linha.quantidade}</td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums text-kx-erro-icone">
                      {formatarReais(linha.custoTotalCentavos)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums text-kx-texto">
                      {formatarReais(linha.cobradoTotalCentavos)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-bold tabular-nums text-kx-texto">
                      {formatarReais(linha.margemCentavos)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums text-kx-texto-2">
                      {formatarPercentual(linha.margemPercentual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
