"use client";

import { lerEntradaMonetaria, paraMoeda } from "@/lib/dinheiro";
import {
  converterDescontoEntreUnidades,
  formatarPercentual,
  parseEntradaPercentual,
  sanitizarEntradaPercentual,
  type ResultadoLimiteDesconto,
} from "@/lib/dominio/pdv/desconto-input";
import type { ConfiguracaoPagamentosPDV } from "@/app/actions/pdv";

const formatarPrecoInput = (valor: number): string => valor.toFixed(2).replace(".", ",");

const sanitizarPrecoInput = (valor: string): string => {
  const apenasNumerosEVirgula = valor.replace(/[^\d,]/g, "");
  const [inteira, ...decimaisExtras] = apenasNumerosEVirgula.split(",");
  if (decimaisExtras.length === 0) return inteira;
  return `${inteira},${decimaisExtras.join("")}`;
};

// Estas duas copias funcionavam -- tiravam o ponto antes de trocar a
// virgula. Mas eram copia, e copia de regra de dinheiro e o que faz a
// mesma digitacao valer uma coisa num campo e outra no campo ao lado.
const parsePrecoInput = (valor: string): number => {
  const centavos = lerEntradaMonetaria(valor);
  return centavos === null || centavos < 0 ? 0 : paraMoeda(centavos);
};

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

interface PropsControleDescontoPdv {
  desconto: number;
  tipoDesconto: "FIXO" | "PERCENTUAL";
  subtotal: number;
  configuracaoPagamentosPdv: ConfiguracaoPagamentosPDV;
  /** Já calculado pelo componente pai (lib/dominio/pdv/desconto-input.ts) — evita recalcular em dois lugares e evita atualizar estado do pai durante o render deste componente. */
  limiteDesconto: ResultadoLimiteDesconto;
  descontoBloqueiaVenda: boolean;
  descontoTextoEmEdicao: string | null;
  onTextoEmEdicaoChange: (texto: string | null) => void;
  onDescontoChange: (valor: number) => void;
  onTipoDescontoChange: (tipo: "FIXO" | "PERCENTUAL") => void;
}

/**
 * Mesma lógica da fase anterior a esta (limite por cargo, ambas as
 * unidades — % e R$ —, checagem final no servidor em processarVenda), só o
 * visual mudou. Ver lib/dominio/pdv/desconto-input.ts.
 */
export function ControleDescontoPdv({
  desconto,
  tipoDesconto,
  subtotal,
  configuracaoPagamentosPdv,
  limiteDesconto,
  descontoBloqueiaVenda,
  descontoTextoEmEdicao,
  onTextoEmEdicaoChange,
  onDescontoChange,
  onTipoDescontoChange,
}: PropsControleDescontoPdv) {
  if (!configuracaoPagamentosPdv.permitirDescontoPDV) return null;

  const valorExibido =
    descontoTextoEmEdicao ??
    (desconto > 0 ? (tipoDesconto === "PERCENTUAL" ? formatarPercentual(desconto) : formatarPrecoInput(desconto)) : "");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-kx-texto">Desconto</span>
        <div className="ml-auto flex gap-1.5">
          {(["PERCENTUAL", "FIXO"] as const).map((unidade) => {
            const ativo = tipoDesconto === unidade;
            return (
              <button
                key={unidade}
                type="button"
                aria-pressed={ativo}
                onClick={() => {
                  if (ativo) return;
                  const valorConvertido = converterDescontoEntreUnidades({
                    valor: desconto,
                    deUnidade: tipoDesconto === "PERCENTUAL" ? "PERCENTUAL" : "VALOR",
                    paraUnidade: unidade === "PERCENTUAL" ? "PERCENTUAL" : "VALOR",
                    subtotal,
                  });
                  onTipoDescontoChange(unidade);
                  onDescontoChange(valorConvertido);
                  onTextoEmEdicaoChange(null);
                }}
                className={
                  ativo
                    ? "h-8 rounded-kx-botao border border-kx-primaria bg-kx-primaria px-3 text-[13px] font-bold text-primary-foreground"
                    : "h-8 rounded-kx-botao border border-kx-campo-borda bg-transparent px-3 text-[13px] font-bold text-kx-texto-2"
                }
              >
                {unidade === "PERCENTUAL" ? "%" : "R$"}
              </button>
            );
          })}
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={valorExibido}
            onFocus={() => onTextoEmEdicaoChange(valorExibido)}
            onChange={(evento) => {
              const sanitizado =
                tipoDesconto === "PERCENTUAL"
                  ? sanitizarEntradaPercentual(evento.target.value)
                  : sanitizarPrecoInput(evento.target.value);
              onTextoEmEdicaoChange(sanitizado);
              onDescontoChange(tipoDesconto === "PERCENTUAL" ? parseEntradaPercentual(sanitizado) : parsePrecoInput(sanitizado));
            }}
            onBlur={() => onTextoEmEdicaoChange(null)}
            aria-invalid={descontoBloqueiaVenda}
            className={`h-8 w-[84px] rounded-kx-botao border bg-kx-superficie px-2 text-right text-[13px] font-bold text-kx-texto outline-none ${
              descontoBloqueiaVenda ? "border-kx-erro" : "border-kx-campo-borda"
            }`}
          />
        </div>
      </div>
      <p
        className={`text-[11px] ${
          descontoBloqueiaVenda
            ? "font-bold text-kx-erro-texto"
            : limiteDesconto.acimaDoLimite
              ? "text-kx-alerta-texto"
              : "text-kx-legenda"
        }`}
      >
        {descontoBloqueiaVenda
          ? `Desconto acima do limite do seu cargo: ${formatarPercentual(configuracaoPagamentosPdv.descontoMaximoPDVPercentual)}% (até ${formatarMoeda(limiteDesconto.limiteReais)}). Reduza para finalizar.`
          : limiteDesconto.acimaDoLimite
            ? `Acima do limite padrão (${formatarPercentual(configuracaoPagamentosPdv.descontoMaximoPDVPercentual)}%), permitido pela sua permissão especial.`
            : `Limite do seu cargo: ${formatarPercentual(configuracaoPagamentosPdv.descontoMaximoPDVPercentual)}% (até ${formatarMoeda(limiteDesconto.limiteReais)})`}
      </p>
    </div>
  );
}
