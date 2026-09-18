import { DollarSign, PackageCheck, ShieldCheck, Wrench } from "lucide-react";
import type { FaturamentoHome, LinhaFluxoEtapaHome, OperacaoDashboard } from "@/app/actions/dashboard";
import type { EtapaOS } from "@/lib/dominio/os/etapas";
import { CartaoIndicador } from "@/components/ui/cartao-indicador";
import { formatarMoeda, formatarNumero, formatarPercentual } from "@/components/ui/pagina";

type KpisHomeProps = {
  temFinanceiro: boolean;
  faturamento: FaturamentoHome | null;
  fluxoEtapas: LinhaFluxoEtapaHome[];
  prontasAguardandoRetirada: OperacaoDashboard["prontasAguardandoRetirada"];
  garantia: OperacaoDashboard["garantia"];
};

function quantidadePorEtapa(fluxoEtapas: LinhaFluxoEtapaHome[], etapa: EtapaOS): number {
  return fluxoEtapas.find((linha) => linha.etapa === etapa)?.quantidade ?? 0;
}

/** Linha de 4 KPIs da home (Fase 3-2A). Faturamento só aparece com `dashboard.financeiro`. */
export function KpisHome({
  temFinanceiro,
  faturamento,
  fluxoEtapas,
  prontasAguardandoRetirada,
  garantia,
}: KpisHomeProps) {
  const emOrcamento = quantidadePorEtapa(fluxoEtapas, "ORCAMENTO");
  const emConserto = quantidadePorEtapa(fluxoEtapas, "CONSERTO");
  const osEmAndamento = emOrcamento + emConserto;

  return (
    <div className="grid grid-cols-1 gap-kx-4 sm:grid-cols-2 xl:grid-cols-4">
      {temFinanceiro && faturamento ? (
        <CartaoIndicador
          variante="primaria"
          titulo="Faturamento"
          valor={faturamento.comparativo.valor === null ? "—" : formatarMoeda(faturamento.comparativo.valor)}
          tendenciaPercentual={
            faturamento.comparativo.variacaoPercentual === null
              ? undefined
              : Number(faturamento.comparativo.variacaoPercentual.toFixed(1))
          }
          descricao={
            faturamento.margemLiquidaPercentual === null
              ? "Margem: —"
              : `Margem: ${formatarPercentual(faturamento.margemLiquidaPercentual)}`
          }
          icone={<DollarSign />}
        />
      ) : null}

      <CartaoIndicador
        variante="azul"
        titulo="OS em andamento"
        valor={formatarNumero(osEmAndamento)}
        descricao={`${formatarNumero(emOrcamento)} em orçamento · ${formatarNumero(emConserto)} em conserto`}
        icone={<Wrench />}
      />

      <CartaoIndicador
        variante="sucesso"
        titulo="Prontas para retirada"
        valor={formatarNumero(prontasAguardandoRetirada.quantidade)}
        descricao={
          prontasAguardandoRetirada.quantidadeAcimaLimite > 0 ? (
            <span className="font-medium text-kx-alerta">
              {formatarNumero(prontasAguardandoRetirada.quantidadeAcimaLimite)} há mais de{" "}
              {prontasAguardandoRetirada.diasLimite}d aguardando
            </span>
          ) : (
            "Nenhuma acima do prazo"
          )
        }
        icone={<PackageCheck />}
      />

      <CartaoIndicador
        variante="garantia"
        titulo="Garantias ativas"
        valor={formatarNumero(garantia.ativas)}
        descricao={`${formatarNumero(garantia.vencem7Dias)} vencem em 7 dias`}
        icone={<ShieldCheck />}
      />
    </div>
  );
}

/** Skeleton dos 4 KPIs — mesma forma final, sem dado ainda. */
export function KpisHomeCarregando() {
  return (
    <div className="grid grid-cols-1 gap-kx-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, indice) => (
        <div
          key={indice}
          className="h-[92px] animate-pulse rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao"
        />
      ))}
    </div>
  );
}
