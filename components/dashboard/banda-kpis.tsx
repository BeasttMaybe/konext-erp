import type { PainelFinanceiro } from "@/app/actions/dashboard";
import { Medidor } from "./medidor";
import { FiguraKPI, formatarMoeda, formatarPercentual } from "@/components/ui/pagina";

type BandaKpisProps = {
  painel: PainelFinanceiro;
};

const moedaOuTraco = (valor: number | null): string =>
  valor === null ? "—" : formatarMoeda(valor);

export function BandaKpis({ painel }: BandaKpisProps) {
  const { kpis } = painel;
  const alvo = painel.margemLiquidaAlvo;

  // Único valor cuja cor é calculada: saldo positivo fica, negativo sai.
  const tomSaldo =
    kpis.saldoPeriodo.valor !== null && kpis.saldoPeriodo.valor < 0 ? "vermelho" : "verde";

  return (
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-[repeat(2,minmax(0,1fr))_210px_repeat(2,minmax(0,1fr))]">
      <FiguraKPI
        rotulo="Faturamento"
        valor={moedaOuTraco(kpis.faturamento.valor)}
        tom="azul"
        comparacao={kpis.faturamento}
      />
      <FiguraKPI
        rotulo="Despesas"
        valor={moedaOuTraco(kpis.despesas.valor)}
        tom="vermelho"
        comparacao={kpis.despesas}
      />

      <div className="order-first col-span-2 flex flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-card p-3 xl:order-none xl:col-span-1 xl:row-span-2">
        <Medidor
          rotulo="Margem líquida"
          percentual={painel.margemLiquidaPercentual}
          corSerie="var(--lucro)"
          textoCentro={
            painel.margemLiquidaPercentual === null
              ? "—"
              : formatarPercentual(painel.margemLiquidaPercentual)
          }
          apoio={alvo === null ? undefined : `Objetivo: ${formatarPercentual(alvo)}`}
          tamanho={108}
        />
      </div>

      <FiguraKPI
        rotulo="A receber"
        valor={moedaOuTraco(kpis.aReceber.valor)}
        tom="verde"
        comparacao={kpis.aReceber}
      />
      <FiguraKPI
        rotulo="A pagar"
        valor={moedaOuTraco(kpis.aPagar.valor)}
        tom="vermelho"
        comparacao={kpis.aPagar}
      />

      <FiguraKPI
        rotulo="Lucro líquido"
        valor={moedaOuTraco(kpis.lucroLiquido.valor)}
        tom="verde"
        comparacao={kpis.lucroLiquido}
      />
      <FiguraKPI
        rotulo="Saldo do período"
        valor={moedaOuTraco(kpis.saldoPeriodo.valor)}
        tom={tomSaldo}
        comparacao={kpis.saldoPeriodo}
      />

      <FiguraKPI
        rotulo="Valor em aberto (OS)"
        valor={moedaOuTraco(kpis.valorEmAbertoOS.valor)}
        tom="azul"
        comparacao={kpis.valorEmAbertoOS}
      />
      <FiguraKPI
        rotulo="Ticket médio"
        valor={moedaOuTraco(kpis.ticketMedio.valor)}
        tom="azul"
        comparacao={kpis.ticketMedio}
      />
    </div>
  );
}
