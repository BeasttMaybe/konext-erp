"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  Percent,
  Wallet,
} from "lucide-react";
import type { DadosFluxoDeCaixa, DadosResultadoPeriodo } from "@/app/actions/financeiro-fluxo";
import { CartaoIndicador } from "@/components/ui/cartao-indicador";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Button } from "@/components/ui/button";
import { GraficoProjecaoSaldo } from "@/components/financeiro/grafico-projecao-saldo";

type Vista = "FLUXO" | "RESULTADO" | "RELATORIOS";

const VISTAS: { chave: Vista; rotulo: string }[] = [
  { chave: "FLUXO", rotulo: "Fluxo de caixa" },
  { chave: "RESULTADO", rotulo: "Resultado do período" },
  { chave: "RELATORIOS", rotulo: "Relatórios" },
];

const formatarMoeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (data: Date) => new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const RELATORIOS = [
  { nome: "Contas a receber do período", descricao: "Títulos, status e datas de vencimento" },
  { nome: "Contas a pagar do período", descricao: "Despesas e parcelas do período" },
  { nome: "Fluxo de caixa", descricao: "Entradas e saídas dia a dia" },
  { nome: "Resultado do período", descricao: "Entradas, saídas e sobra — DRE simplificado" },
  { nome: "Ordens de serviço entregues", descricao: "OS entregues no período, com valores" },
];

interface ConteudoFluxoProps {
  dadosFluxo: DadosFluxoDeCaixa;
  dadosResultado: DadosResultadoPeriodo;
}

/**
 * Fluxo e relatórios (Fase 3-2D, Parte 4) — três vistas por pílula, dados das
 * duas primeiras já carregados no servidor (mesmo padrão de A pagar); a de
 * Relatórios não depende de dado nenhum ainda (exportação não existe).
 */
export function ConteudoFluxo({ dadosFluxo, dadosResultado }: ConteudoFluxoProps) {
  const [vista, setVista] = useState<Vista>("FLUXO");

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
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
      {vista === "RELATORIOS" && <VistaRelatorios />}
    </>
  );
}

// ── Vista: Fluxo de caixa ────────────────────────────────────────────────────

function VistaFluxo({ dados }: { dados: DadosFluxoDeCaixa }) {
  const { saldoHoje, aReceber7Dias, projecao, proximosLancamentos, previstoXRecebido } = dados;
  const { menorPonto, temSaldoNegativo } = projecao;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
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
      <div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
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
          descricao={
            resultado.variacaoSaidasPercentual === null
              ? "Sem mês anterior pra comparar"
              : `${resultado.variacaoSaidasPercentual >= 0 ? "+" : ""}${resultado.variacaoSaidasPercentual}% vs. mês anterior`
          }
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
          <PilulaStatus variante="neutro" className="shrink-0">
            Comissão: não há esse dado no sistema
          </PilulaStatus>
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

// ── Vista: Relatórios ─────────────────────────────────────────────────────────

function VistaRelatorios() {
  return (
    <div className="grid grid-cols-1 gap-4 min-[1400px]:grid-cols-[1.25fr_1fr] min-[1400px]:items-start">
      <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <span className="shrink-0 text-[17px] font-bold text-kx-texto">Relatórios</span>
        <div className="flex flex-col gap-2">
          {RELATORIOS.map((relatorio) => (
            <div key={relatorio.nome} className="flex min-h-[64px] items-center gap-3 rounded-kx-botao bg-kx-superficie px-3.5 py-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-bold text-kx-texto">{relatorio.nome}</p>
                <p className="truncate text-xs text-kx-legenda">{relatorio.descricao}</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled className="shrink-0 gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </Button>
              <Button type="button" variant="outline" size="sm" disabled className="shrink-0 gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
          ))}
        </div>
        <p className="shrink-0 text-xs leading-snug text-kx-legenda">
          Exportação em Excel e PDF ainda não foi implementada nesta fase — os números acima já existem no sistema, falta só gerar o
          arquivo pra baixar.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span className="text-[17px] font-bold text-kx-texto">Comissões do mês</span>
          <PilulaStatus variante="neutro">Indisponível</PilulaStatus>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-kx-botao bg-kx-superficie p-6 text-center">
          <p className="text-sm font-bold text-kx-texto">Não existe cálculo de comissão no sistema hoje</p>
          <p className="max-w-xs text-xs leading-relaxed text-kx-legenda">
            Não há regra de comissão por técnico nem valor calculado em nenhuma OS — nada aqui pra mostrar sem inventar um número.
            Chega com a reconstrução do financeiro.
          </p>
        </div>
      </div>
    </div>
  );
}
