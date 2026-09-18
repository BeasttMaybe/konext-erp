import Link from "next/link";
import type { OperacaoDashboard } from "@/app/actions/dashboard";
import { CabecalhoCard } from "./cabecalho-card";
import { Superficie, formatarNumero, formatarPercentual } from "@/components/ui/pagina";

type BlocoGarantiaProps = {
  garantia: OperacaoDashboard["garantia"];
};

export function BlocoGarantia({ garantia }: BlocoGarantiaProps) {
  const vencendo = garantia.vencem7Dias > 0;

  return (
    <Superficie className="gap-0 p-0">
      <CabecalhoCard
        titulo="Garantia"
        acao={
          <Link href="/os?modo=garantia" className="hover:text-foreground">
            Abrir garantias ↗
          </Link>
        }
      />

      <div className="px-3 pb-3 pt-2.5">
        <p className="text-[11px] text-muted-foreground">Taxa de retorno</p>
        <p
          className="text-[26px] font-semibold leading-tight tracking-[-0.02em]"
          style={{ color: "var(--t-verde)" }}
        >
          {garantia.taxaRetorno === null ? "—" : formatarPercentual(garantia.taxaRetorno)}
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {garantia.taxaRetorno === null
            ? `Nenhuma OS entregue nos últimos ${garantia.janelaDias} dias`
            : `${formatarNumero(garantia.retornosJanela)} retornos sobre ${formatarNumero(garantia.entreguesJanela)} OS entregues nos últimos ${garantia.janelaDias} dias`}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-border/60 pt-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Termos ativos</p>
            <p className="text-base font-semibold text-foreground">
              {formatarNumero(garantia.ativas)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Vencem em 7 dias</p>
            <p
              className="text-base font-semibold"
              style={vencendo ? { color: "var(--t-vermelho)" } : undefined}
            >
              {formatarNumero(garantia.vencem7Dias)}
            </p>
          </div>
        </div>
      </div>
    </Superficie>
  );
}
