"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  Percent,
  Wallet,
} from "lucide-react";
import type { DadosFluxoDeCaixa, DadosResultadoPeriodo } from "@/app/actions/financeiro-fluxo";
import { CartaoIndicador } from "@/components/ui/cartao-indicador";
import { GraficoProjecaoSaldo } from "@/components/financeiro/grafico-projecao-saldo";

type Vista = "FLUXO" | "RESULTADO" | "TAXAS";

const VISTAS: { chave: Vista; rotulo: string }[] = [
  { chave: "FLUXO", rotulo: "Fluxo de caixa" },
  { chave: "RESULTADO", rotulo: "Resultado do período" },
  { chave: "TAXAS", rotulo: "Taxas de cartão" },
];

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (data: Date) => new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

interface ConteudoFluxoProps {
  dadosFluxo: DadosFluxoDeCaixa;
  dadosResultado: DadosResultadoPeriodo;
}

/**
 * Fluxo e relatórios — três vistas por pílula, todas com os dados já
 * carregados no servidor (mesmo padrão de A pagar).
 */
export function ConteudoFluxo({ dadosFluxo, dadosResultado }: ConteudoFluxoProps) {
  const [vista, setVista] = useState<Vista>("FLUXO");

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {VISTAS.map((item) => (
          <button
            key={item.chave}
            type="button"
            onClick={() => setVista(item.chave)}
            aria-pressed={vista === item.chave}
            className={`h-9 shrink-0 rounded-kx-pilula border px-4 text-sm font-bold transition-colors ${
              vista === item.chave
                ? "border-kx-primaria bg-kx-primaria text-primary-foreground"
                : "border-kx-painel-borda bg-kx-superficie text-kx-texto-2 hover:border-kx-destaque"
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {vista === "FLUXO" && <VistaFluxo dados={dadosFluxo} />}
      {vista === "RESULTADO" && <VistaResultado dados={dadosResultado} />}
      {vista === "TAXAS" && <VistaTaxas dados={dadosResultado} />}
    </>
  );
}

// ── Vista: Fluxo de caixa ────────────────────────────────────────────────────

function VistaFluxo({ dados }: { dados: DadosFluxoDeCaixa }) {
  const { saldoHoje, aReceber7Dias, projecao, proximosLancamentos, previstoXRecebido } = dados;
  const { menorPonto, temSaldoNegativo } = projecao;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:gap-3">
        <CartaoIndicador
          variante="primaria"
          titulo="Saldo em caixa hoje"
          valor={formatarMoeda(saldoHoje.valor)}
          icone={<Wallet />}
          descricao={saldoHoje.caixaAberto ? "Caixa da loja aberto agora" : "Nenhum caixa aberto agora"}
        />
        <CartaoIndicador
          variante="azul"
          titulo="A receber em 7 dias"
          valor={formatarMoeda(aReceber7Dias)}
          icone={<CalendarClock />}
          descricao="Títulos que ainda vão vencer essa semana"
        />
        <CartaoIndicador
          variante={temSaldoNegativo ? "erro" : "sucesso"}
          titulo="Menor saldo previsto (30 dias)"
          valor={formatarMoeda(menorPonto.saldo)}
          icone={<AlertTriangle />}
          descricao={`No dia ${formatarData(menorPonto.data)}`}
        />
        <CartaoIndicador
          variante="alerta"
          titulo="Previsto x recebido no mês"
          valor={`${previstoXRecebido.percentual}%`}
          icone={<Percent />}
          descricao={
            previstoXRecebido.naoRecebido > 0
              ? `${formatarMoeda(previstoXRecebido.naoRecebido)} ainda não entraram`
              : "Tudo que venceu já foi recebido"
          }
        />
      </div>

      {temSaldoNegativo && (
        <div className="flex shrink-0 items-center gap-3 rounded-kx-painel border border-kx-erro/30 bg-kx-erro-fundo px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-kx-erro-texto" aria-hidden="true" />
          <p className="flex-1 text-sm leading-snug text-kx-erro-texto">
            No dia <strong>{formatarData(menorPonto.data)}</strong> o saldo projetado fica negativo em{" "}
            <strong>{formatarMoeda(Math.abs(menorPonto.saldo))}</strong>. Receber os títulos em atraso ajuda a evitar isso.
          </p>
          <Link href="/financeiro/receber" className="shrink-0 text-sm font-bold text-kx-erro-texto underline underline-offset-2">
            Ver títulos atrasados
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 min-[1400px]:grid-cols-[1.7fr_1fr] min-[1400px]:items-start">
        <div className="flex min-h-[280px] flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-bold text-kx-texto">Projeção de saldo · próximos 30 dias</span>
            <span className="text-xs text-kx-legenda">Saldo atual + títulos a receber − contas e recorrências agendadas</span>
          </div>
          <GraficoProjecaoSaldo pontos={projecao.pontos} menorPonto={menorPonto} />
        </div>

        <div className="flex min-h-[280px] flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <span className="shrink-0 text-[16px] font-bold text-kx-texto">Próximos 7 dias</span>
          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">
            {proximosLancamentos.itens.length === 0 && (
              <p className="py-8 text-center text-sm text-kx-legenda">Nada previsto pra essa semana.</p>
            )}
            {proximosLancamentos.itens.map((item) => (
              <div key={item.id} className="flex min-h-[46px] items-center gap-3 rounded-kx-botao bg-kx-superficie px-3">
                <span className="w-11 shrink-0 text-xs tabular-nums text-kx-legenda">{formatarData(item.dataVencimento)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-kx-texto">{item.titulo}</span>
                <span className={`shrink-0 text-sm font-extrabold tabular-nums ${item.tipo === "receber" ? "text-kx-sucesso" : "text-kx-erro"}`}>
                  {item.tipo === "receber" ? "+" : "−"}
                  {formatarMoeda(item.valor)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-kx-painel-borda pt-2.5 text-[13px]">
            <span className="text-kx-legenda">Resultado da semana</span>
            <span className={`font-extrabold tabular-nums ${proximosLancamentos.resultadoSemana >= 0 ? "text-kx-sucesso" : "text-kx-erro"}`}>
              {proximosLancamentos.resultadoSemana >= 0 ? "+" : ""}
              {formatarMoeda(proximosLancamentos.resultadoSemana)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vista: Resultado do período ──────────────────────────────────────────────

function VistaResultado({ dados }: { dados: DadosResultadoPeriodo }) {
  const { resultado, servicoXProduto, sobraPorOS } = dados;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:gap-3">
        <CartaoIndicador
          variante="sucesso"
          titulo="Entradas"
          valor={formatarMoeda(resultado.entradas)}
          tendenciaPercentual={resultado.variacaoEntradasPercentual ?? undefined}
          descricao={resultado.variacaoEntradasPercentual === null ? "Sem mês anterior pra comparar" : "vs. mês anterior"}
        />
        <CartaoIndicador
          variante="erro"
          titulo="Saídas"
          valor={formatarMoeda(resultado.saidas)}
          descricao={[
            resultado.taxasDeCartao > 0 ? `Inclui ${formatarMoeda(resultado.taxasDeCartao)} de taxa de cartão` : null,
            resultado.variacaoSaidasPercentual === null
              ? "Sem mês anterior pra comparar"
              : `${resultado.variacaoSaidasPercentual >= 0 ? "+" : ""}${resultado.variacaoSaidasPercentual}% vs. mês anterior`,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <CartaoIndicador
          variante="primaria"
          titulo="Sobrou no mês"
          valor={formatarMoeda(resultado.sobrou)}
          descricao={`Margem de ${resultado.margemPercentual}%`}
        />
        <CartaoIndicador
          variante="azul"
          titulo="Serviço x produto"
          valor={servicoXProduto.temDados ? `${servicoXProduto.servicoPercentual}% / ${servicoXProduto.produtoPercentual}%` : "Sem dados"}
          descricao="Ordem de serviço x venda de balcão"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-bold text-kx-texto">Quanto sobrou por OS</span>
            <span className="text-xs text-kx-legenda">Valor cobrado menos peça e taxa do cartão</span>
          </div>
        </div>

        <div className="sticky top-0 z-kx-sticky hidden grid-cols-[64px_minmax(0,1.3fr)_130px_110px_100px_100px_100px] gap-2.5 bg-kx-painel px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-kx-legenda sm:grid">
          <span>OS</span>
          <span>Serviço</span>
          <span>Técnico</span>
          <span className="text-right">Cobrado</span>
          <span className="text-right">Peça</span>
          <span className="text-right">Taxa</span>
          <span className="text-right">Sobrou</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {sobraPorOS.linhas.length === 0 && (
            <p className="py-10 text-center text-sm text-kx-legenda">Nenhuma OS entregue com recebimento neste período.</p>
          )}
          {sobraPorOS.linhas.map((linha) => (
            <div
              key={linha.osId}
              className="grid grid-cols-1 gap-1.5 rounded-kx-botao bg-kx-superficie px-3 py-2 text-sm sm:grid-cols-[64px_minmax(0,1.3fr)_130px_110px_100px_100px_100px] sm:items-center sm:gap-2.5 sm:py-0 sm:min-h-[46px]"
            >
              <span className="font-extrabold tabular-nums text-kx-destaque">#{linha.numeroOs}</span>
              <span className="min-w-0 truncate text-kx-texto">{linha.servico || "—"}</span>
              <span className="truncate text-[13px] text-kx-texto-2">{linha.tecnico ?? "—"}</span>
              <span className="text-right tabular-nums text-kx-texto">{formatarMoeda(linha.cobrado)}</span>
              <span className="text-right tabular-nums text-kx-erro-texto">{linha.peca > 0 ? `−${formatarMoeda(linha.peca)}` : "—"}</span>
              <span className="text-right tabular-nums text-kx-erro-texto">{linha.taxa > 0 ? `−${formatarMoeda(linha.taxa)}` : "—"}</span>
              <span className="text-right font-extrabold tabular-nums text-kx-sucesso">{formatarMoeda(linha.sobra)}</span>
            </div>
          ))}
        </div>

        {sobraPorOS.linhas.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-t border-kx-painel-borda pt-2.5 text-[13px]">
            <span className="text-kx-legenda">Média por OS entregue no mês</span>
            <span className="font-extrabold tabular-nums text-kx-texto">
              Sobra média: {formatarMoeda(sobraPorOS.sobraMediaPorOS)} · margem {sobraPorOS.margemMediaPercentual}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Vista: Taxas de cartão ───────────────────────────────────────────────────

function VistaTaxas({ dados }: { dados: DadosResultadoPeriodo }) {
  const { taxas } = dados;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:gap-3">
        <CartaoIndicador
          variante="erro"
          titulo="Gasto com taxas no mês"
          valor={formatarMoeda(taxas.totalTaxa)}
          descricao="Já descontado nas saídas e no resultado"
        />
        <CartaoIndicador
          variante="azul"
          titulo="Vendido no cartão"
          valor={formatarMoeda(taxas.totalBrutoNoCartao)}
          descricao={`${taxas.quantidade} ${taxas.quantidade === 1 ? "pagamento" : "pagamentos"} com taxa`}
        />
        <CartaoIndicador
          variante="primaria"
          titulo="Taxa média"
          valor={`${taxas.percentualMedio.toLocaleString("pt-BR")}%`}
          descricao="Do valor vendido no cartão"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <div className="flex shrink-0 flex-col gap-0.5">
          <span className="text-[17px] font-bold text-kx-texto">Taxas por forma de pagamento</span>
          <span className="text-xs text-kx-legenda">
            Calculadas pela tabela de taxas das Configurações, na data da venda. Vendas estornadas não entram.
          </span>
        </div>

        <div className="hidden grid-cols-[minmax(0,1.2fr)_90px_130px_120px_90px] gap-2.5 px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-kx-legenda sm:grid">
          <span>Forma</span>
          <span className="text-right">Pagamentos</span>
          <span className="text-right">Vendido</span>
          <span className="text-right">Taxa</span>
          <span className="text-right">%</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {taxas.grupos.length === 0 && (
            <p className="py-10 text-center text-sm text-kx-legenda">Nenhuma venda com taxa de cartão neste mês.</p>
          )}
          {taxas.grupos.map((grupo) => (
            <div
              key={grupo.rotulo}
              className="grid grid-cols-2 gap-1.5 rounded-kx-botao bg-kx-superficie px-3 py-2 text-sm sm:grid-cols-[minmax(0,1.2fr)_90px_130px_120px_90px] sm:items-center sm:gap-2.5 sm:py-0 sm:min-h-[46px]"
            >
              <span className="col-span-2 font-bold text-kx-texto sm:col-span-1">{grupo.rotulo}</span>
              <span className="tabular-nums text-kx-texto-2 sm:text-right">{grupo.quantidade}x</span>
              <span className="text-right tabular-nums text-kx-texto">{formatarMoeda(grupo.bruto)}</span>
              <span className="tabular-nums text-kx-erro-texto sm:text-right">−{formatarMoeda(grupo.taxa)}</span>
              <span className="text-right tabular-nums text-kx-texto-2">{grupo.percentual.toLocaleString("pt-BR")}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
