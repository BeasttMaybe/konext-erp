import type { EtapaOS, SituacaoOS } from "@/types/os";
import { ROTULOS_ETAPA_OS, ROTULOS_SITUACAO_OS } from "@/lib/dominio/os/maquina-estados";

/** Fundo/texto por etapa — mesmo par que a faixa de 3px do Kanban usa, só que preenchido (Fase 3-2B, Parte 3). */
const FUNDO_POR_ETAPA: Record<EtapaOS, string> = {
  ORCAMENTO: "bg-kx-alerta-fundo text-kx-alerta-texto",
  CONSERTO: "bg-kx-conserto-fundo text-kx-conserto-texto",
  PRONTO: "bg-kx-sucesso-fundo text-kx-sucesso-texto",
  ENTREGUE: "bg-kx-entregue-fundo text-kx-entregue-texto",
};

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

type PropsCartoesResumoOS = {
  etapa: EtapaOS;
  situacao: SituacaoOS | null;
  diasNaEtapa: number;
  totalOS: number;
  /** null quando o usuário logado não tem os.ver_custos — some a quebra de custo/sobra, nunca mostra com valor zerado. */
  custoTotal: number | null;
  garantiaDias: number;
  garantiaAtiva: boolean;
  pagamentoConcluido: boolean;
  valorPago: number | null;
};

/** Os 4 cartões de resumo do topo da OS — Etapa/Total/Garantia/Pagamento (referência: docs/design/referencia-os-detalhe.html). */
export function CartoesResumoOS({
  etapa,
  situacao,
  diasNaEtapa,
  totalOS,
  custoTotal,
  garantiaDias,
  garantiaAtiva,
  pagamentoConcluido,
  valorPago,
}: PropsCartoesResumoOS) {
  const sobra = custoTotal === null ? null : totalOS - custoTotal;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-kx-4">
      <div className={`p-kx-4 rounded-kx-painel flex flex-col gap-1 ${FUNDO_POR_ETAPA[etapa]}`}>
        <span className="text-xs font-semibold opacity-80">Etapa</span>
        <span className="text-lg font-extrabold">{ROTULOS_ETAPA_OS[etapa]}</span>
        {situacao && (
          <span className="text-xs font-semibold">
            {ROTULOS_SITUACAO_OS[situacao]}
            {diasNaEtapa > 0 && ` há ${diasNaEtapa === 1 ? "1 dia" : `${diasNaEtapa} dias`}`}
          </span>
        )}
      </div>

      <div className="p-kx-4 rounded-kx-painel bg-kx-entregue-fundo text-kx-entregue-texto flex flex-col gap-1">
        <span className="text-xs font-semibold opacity-80">Total da OS</span>
        <span className="text-lg font-extrabold tabular-nums">{formatarMoeda(totalOS)}</span>
        {custoTotal !== null && sobra !== null && (
          <span className="text-xs tabular-nums opacity-90">
            Peça {formatarMoeda(custoTotal)} · sobra {formatarMoeda(sobra)}
          </span>
        )}
      </div>

      <div className="p-kx-4 rounded-kx-painel bg-kx-garantia-fundo text-kx-garantia-texto flex flex-col gap-1">
        <span className="text-xs font-semibold opacity-80">Garantia</span>
        <span className="text-lg font-extrabold">{garantiaDias} dias</span>
        <span className="text-xs opacity-90">
          {garantiaAtiva ? "Conta a partir da entrega" : "Prazo padrão — gerada na entrega"}
        </span>
      </div>

      <div
        className={`p-kx-4 rounded-kx-painel flex flex-col gap-1 ${
          pagamentoConcluido ? "bg-kx-sucesso-fundo text-kx-sucesso-texto" : "bg-kx-alerta-fundo text-kx-alerta-texto"
        }`}
      >
        <span className="text-xs font-semibold opacity-80">Pagamento</span>
        <span className="text-lg font-extrabold">{pagamentoConcluido ? "Concluído" : "Em aberto"}</span>
        <span className="text-xs tabular-nums opacity-90">
          {pagamentoConcluido && valorPago !== null ? formatarMoeda(valorPago) : "Gere o pedido no PDV"}
        </span>
      </div>
    </section>
  );
}
