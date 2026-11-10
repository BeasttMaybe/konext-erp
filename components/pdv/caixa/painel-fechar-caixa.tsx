"use client";

import type { ReactNode } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PilulaStatus } from "@/components/ui/pilula-status";
import type { ResumoSessaoAbertaDetalhado } from "@/app/actions/caixa-pdv";
import type { ItemHistoricoFechamento, ResumoCaixaDiario } from "@/app/actions/caixa";

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatarDataHora = (data: Date | string): string =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(data)
  );

const ROTULO_FORMA: Record<string, string> = {
  PIX: "PIX",
  TED: "TED",
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_CREDITO_AVISTA: "Cartão de crédito à vista",
  CARTAO_CREDITO_PARCELADO: "Cartão de crédito parcelado",
  BOLETO: "Boleto",
  CREDIARIO: "Crediário",
  EMPENHO_PUBLICO: "Empenho público",
  NAO_INFORMADO: "Não informado",
};

function pilulaSituacao(item: ItemHistoricoFechamento) {
  // Nenhuma sessão real hoje pode ter sido fechada pelo sistema: não existe
  // cron de fechamento automático ainda (só a configuração, Fase 1D-3) nem
  // campo que distinga auto de manual sem migração — então esta filial fica
  // pronta e correta, mas hoje é sempre falsa. Ver relatório final da fase.
  const foiFechadoPeloSistema = false;

  if (foiFechadoPeloSistema) {
    return <PilulaStatus variante="neutro">Sem conferência</PilulaStatus>;
  }
  if (item.diferenca === 0) {
    return <PilulaStatus variante="sucesso">Fechou certo</PilulaStatus>;
  }
  if (item.diferenca > 0) {
    return <PilulaStatus variante="conserto">Sobra {formatarMoeda(item.diferenca)}</PilulaStatus>;
  }
  return <PilulaStatus variante="erro">Falta {formatarMoeda(Math.abs(item.diferenca))}</PilulaStatus>;
}

interface PropsPainelFecharCaixa {
  resumoSessao: ResumoSessaoAbertaDetalhado;
  resumoDiario: ResumoCaixaDiario | null;
  fechamentos: ItemHistoricoFechamento[];
  carregandoFechamentos: boolean;
  valorContadoTexto: string;
  onValorContadoChange: (valor: string) => void;
  observacaoTexto: string;
  onObservacaoChange: (valor: string) => void;
  confirmando: boolean;
  onConfirmar: () => void;
  /** `FiltroPeriodo` (Fase 2A-1) pronto, renderizado pelo caller — passado como nó em vez de props soltas pra este componente não precisar conhecer a API do filtro. */
  filtroPeriodo: ReactNode;
}

export function PainelFecharCaixa({
  resumoSessao,
  resumoDiario,
  fechamentos,
  carregandoFechamentos,
  valorContadoTexto,
  onValorContadoChange,
  observacaoTexto,
  onObservacaoChange,
  confirmando,
  onConfirmar,
  filtroPeriodo,
}: PropsPainelFecharCaixa) {
  const valorContadoNumero = valorContadoTexto.trim() === "" ? null : Number(valorContadoTexto);
  const contagemValida = valorContadoNumero !== null && Number.isFinite(valorContadoNumero);
  // Comparação em centavos inteiros: subtração direta de dois floats de
  // dinheiro pode sobrar um resíduo de arredondamento (ex.: 1409.89 -
  // 1409.89 vira 0.00000000000009) que faria "bateu certinho" nunca aparecer.
  const diferenca = contagemValida
    ? Math.round((Number(valorContadoNumero) - resumoSessao.dinheiroEsperadoGaveta) * 100) / 100
    : null;

  const cartoesResumo = resumoDiario
    ? [
        { nome: "Vendas do dia", valor: resumoDiario.totalVendas, cor: "text-kx-texto" },
        { nome: "Custo de peças/produtos", valor: resumoDiario.custoTotal, cor: "text-kx-erro-texto" },
        {
          nome: "Lucro bruto",
          valor: resumoDiario.lucroBruto,
          cor: resumoDiario.lucroBruto >= 0 ? "text-kx-sucesso-texto" : "text-kx-erro-texto",
        },
        ...resumoDiario.totaisPorFormaPagamento.map((forma) => ({
          nome: ROTULO_FORMA[forma.formaPagamento] ?? forma.formaPagamento,
          valor: forma.total,
          cor: "text-kx-texto",
        })),
      ]
    : [];

  return (
    <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[460px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-extrabold text-kx-texto">Contagem da gaveta</span>
          <span className="text-[13px] leading-relaxed text-kx-legenda">
            Conte o dinheiro antes de ver o valor do sistema. O campo começa vazio de propósito: é assim que a
            conferência tem valor.
          </span>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-kx-texto">Quanto tem em dinheiro na gaveta?</span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            placeholder="R$ 0,00"
            value={valorContadoTexto}
            onChange={(evento) => onValorContadoChange(evento.target.value)}
            className="h-[60px] rounded-2xl border border-kx-destaque bg-kx-superficie px-4 text-2xl font-extrabold text-kx-texto outline-none placeholder:text-kx-placeholder"
          />
        </label>

        <div className="flex flex-col gap-2 rounded-kx-botao bg-kx-superficie px-4 py-3.5">
          <div className="flex justify-between text-[13px] text-kx-texto-2">
            <span>Abertura</span>
            <span className="tabular-nums">{formatarMoeda(resumoSessao.valorAbertura)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-kx-texto-2">
            <span>Vendas em dinheiro</span>
            <span className="tabular-nums">{formatarMoeda(resumoSessao.totalDinheiroSessao)}</span>
          </div>
          <div className="flex justify-between border-t border-kx-painel-borda pt-2 text-sm font-extrabold text-kx-texto">
            <span>Esperado na gaveta</span>
            <span className="tabular-nums">{formatarMoeda(resumoSessao.dinheiroEsperadoGaveta)}</span>
          </div>

          {diferenca !== null && (
            <div
              className={`flex justify-between border-t border-kx-painel-borda pt-2 text-sm font-extrabold ${
                diferenca === 0
                  ? "text-kx-sucesso-texto"
                  : diferenca > 0
                    ? "text-kx-conserto-texto"
                    : "text-kx-erro-texto"
              }`}
            >
              <span>{diferenca === 0 ? "Confere certinho" : diferenca > 0 ? "Sobra" : "Falta"}</span>
              <span className="tabular-nums">{formatarMoeda(Math.abs(diferenca))}</span>
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-kx-texto">Observação (opcional)</span>
          <input
            type="text"
            placeholder="Ex.: faltou troco de R$ 2,00"
            value={observacaoTexto}
            onChange={(evento) => onObservacaoChange(evento.target.value)}
            maxLength={280}
            className="h-[46px] rounded-xl border border-kx-painel-borda bg-kx-superficie px-3.5 text-sm text-kx-texto outline-none placeholder:text-kx-placeholder"
          />
        </label>

        <Button
          type="button"
          onClick={onConfirmar}
          disabled={!contagemValida || confirmando}
          className="mt-auto h-[52px] rounded-kx-botao text-base font-bold"
        >
          {confirmando ? "Fechando..." : "Confirmar fechamento"}
        </Button>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <span className="text-base font-bold text-kx-texto">Resumo do dia</span>
          <div className="grid grid-cols-2 gap-2.5">
            {cartoesResumo.length === 0 && (
              <p className="col-span-2 py-2 text-sm text-kx-legenda">Carregando resumo do dia...</p>
            )}
            {cartoesResumo.map((item) => (
              <div key={item.nome} className="flex flex-col gap-0.5 rounded-kx-botao bg-kx-cartao px-3.5 py-3">
                <span className="text-xs text-kx-legenda">{item.nome}</span>
                <span className={`text-[17px] font-extrabold tabular-nums ${item.cor}`}>{formatarMoeda(item.valor)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-bold text-kx-texto">Últimos fechamentos</span>
            {filtroPeriodo}
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {carregandoFechamentos && <p className="py-6 text-center text-sm text-kx-legenda">Carregando...</p>}

            {!carregandoFechamentos && fechamentos.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <History className="h-5 w-5 text-kx-legenda" aria-hidden="true" />
                <p className="text-sm text-kx-legenda">Nenhum fechamento registrado ainda.</p>
              </div>
            )}

            {!carregandoFechamentos &&
              fechamentos.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[100px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-kx-botao bg-kx-superficie px-3 py-2.5 text-sm"
                >
                  <span className="text-xs tabular-nums text-kx-legenda">{formatarDataHora(item.dataFechamento)}</span>
                  <span className="truncate text-kx-texto-2">{item.abertoPorNome ?? "—"}</span>
                  <span className="text-right tabular-nums text-kx-texto">{formatarMoeda(item.totalVendas)}</span>
                  {pilulaSituacao(item)}
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
