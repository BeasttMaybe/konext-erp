"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DemonstracaoResultados } from "@/app/actions/dashboard";
import { cn } from "@/lib/utils";
import { Superficie, formatarPercentual, formatarValor } from "@/components/ui/pagina";

type TabelaDreProps = {
  dre: DemonstracaoResultados;
};

const AZUL = { color: "var(--t-azul)" };
const VERMELHO = { color: "var(--t-vermelho)" };
const VERDE = { color: "var(--t-verde)" };

export function TabelaDre({ dre }: TabelaDreProps) {
  const [expandida, setExpandida] = useState(false);

  const percentual = (valor: number): string =>
    dre.receitaBruta > 0 ? formatarPercentual((valor / dre.receitaBruta) * 100) : "—";

  // Resultado é verde quando fica dinheiro, vermelho quando não fica.
  const tomResultado = (valor: number) => (valor < 0 ? VERMELHO : VERDE);

  return (
    <Superficie className="gap-0 p-0">
      <div className="flex items-center justify-between gap-2.5 border-b border-border/60 px-3 py-2.5">
        <h2 className="text-[12.5px] font-semibold text-foreground">Demonstração de resultados</h2>
        <button
          type="button"
          onClick={() => setExpandida((atual) => !atual)}
          aria-expanded={expandida}
          disabled={dre.despesasPorTipo.length === 0}
          className="flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-50"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn("h-3.5 w-3.5 transition-transform", expandida && "rotate-90")}
          />
          {expandida ? "Ocultar detalhe" : "Ver detalhado"}
        </button>
      </div>

      <div className="overflow-x-auto px-3 pb-3 pt-2.5">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border/60 text-[11px] tracking-[0.02em] text-muted-foreground">
              <th scope="col" className="pb-1.5 text-left font-medium">Conta</th>
              <th scope="col" className="pb-1.5 text-right font-medium">Valor</th>
              <th scope="col" className="pb-1.5 text-right font-medium">% receita</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60">
              <td className="py-[5px] text-foreground">Receita bruta</td>
              <td className="py-[5px] text-right tabular-nums" style={AZUL}>
                {formatarValor(dre.receitaBruta)}
              </td>
              <td className="py-[5px] text-right tabular-nums text-muted-foreground">
                {dre.receitaBruta > 0 ? formatarPercentual(100) : "—"}
              </td>
            </tr>

            <tr className="border-b border-border/60">
              <td className="py-[5px] text-foreground">(−) Custo de peças</td>
              <td className="py-[5px] text-right tabular-nums" style={VERMELHO}>
                {formatarValor(dre.custoPecas)}
              </td>
              <td className="py-[5px] text-right tabular-nums text-muted-foreground">
                {percentual(dre.custoPecas)}
              </td>
            </tr>

            <tr className="border-b border-border/60">
              <td className="py-[5px] text-foreground">(−) Custo de mercadorias vendidas</td>
              <td className="py-[5px] text-right tabular-nums" style={VERMELHO}>
                {formatarValor(dre.custoMercadorias)}
              </td>
              <td className="py-[5px] text-right tabular-nums text-muted-foreground">
                {percentual(dre.custoMercadorias)}
              </td>
            </tr>

            <tr className="border-t border-border font-semibold">
              <td className="py-[5px] text-foreground">= Lucro bruto</td>
              <td className="py-[5px] text-right tabular-nums" style={tomResultado(dre.lucroBruto)}>
                {formatarValor(dre.lucroBruto)}
              </td>
              <td className="py-[5px] text-right tabular-nums" style={tomResultado(dre.lucroBruto)}>
                {percentual(dre.lucroBruto)}
              </td>
            </tr>

            <tr className="border-b border-border/60">
              <td className="py-[5px] text-foreground">(−) Despesas operacionais</td>
              <td className="py-[5px] text-right tabular-nums" style={VERMELHO}>
                {formatarValor(dre.despesasOperacionais)}
              </td>
              <td className="py-[5px] text-right tabular-nums text-muted-foreground">
                {percentual(dre.despesasOperacionais)}
              </td>
            </tr>

            {expandida
              ? dre.despesasPorTipo.map((linha) => (
                  <tr key={linha.tipo} className="border-b border-border/60">
                    <td className="py-[5px] pl-3.5 text-[12px] text-muted-foreground">
                      {linha.rotulo}
                    </td>
                    <td className="py-[5px] text-right text-[12px] tabular-nums" style={VERMELHO}>
                      {formatarValor(linha.valor)}
                    </td>
                    <td className="py-[5px] text-right text-[12px] tabular-nums text-muted-foreground">
                      {percentual(linha.valor)}
                    </td>
                  </tr>
                ))
              : null}

            <tr className="border-t border-border font-semibold">
              <td className="py-[5px] text-foreground">= Lucro líquido</td>
              <td className="py-[5px] text-right tabular-nums" style={tomResultado(dre.lucroLiquido)}>
                {formatarValor(dre.lucroLiquido)}
              </td>
              <td className="py-[5px] text-right tabular-nums" style={tomResultado(dre.lucroLiquido)}>
                {percentual(dre.lucroLiquido)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Superficie>
  );
}
