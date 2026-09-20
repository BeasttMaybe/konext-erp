"use client";

import { ArrowDownCircle, ArrowUpCircle, Lock, ShoppingBag } from "lucide-react";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { Button } from "@/components/ui/button";
import type { ResumoSessaoAbertaDetalhado } from "@/app/actions/caixa-pdv";

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatarHora = (iso: string): string =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

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

// Paleta cíclica reaproveitando indicadores já existentes no sistema — a
// barra é só um diferenciador visual entre formas, não carrega significado
// de bom/ruim, então não usa os pares sucesso/erro.
const CORES_BARRA = ["bg-kx-destaque", "bg-kx-primaria", "bg-kx-conserto", "bg-kx-garantia", "bg-kx-alerta", "bg-kx-pronto"];

interface PropsPainelCaixaAberto {
  resumo: ResumoSessaoAbertaDetalhado;
  fechamentoAutomaticoAtivo: boolean;
  fechamentoAutomaticoHorario: string;
  onIrParaFechamento: () => void;
}

export function PainelCaixaAberto({
  resumo,
  fechamentoAutomaticoAtivo,
  fechamentoAutomaticoHorario,
  onIrParaFechamento,
}: PropsPainelCaixaAberto) {
  const totalGeral = resumo.totalDinheiroSessao + resumo.totalCartaoPixSessao;

  return (
    <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-h-0 flex-col gap-3.5">
        {/* grid-cols por breakpoint de VIEWPORT (sm:/lg:) fica errado aqui:
            esta coluna divide a largura com o painel "Entradas por forma" de
            420px, nunca ocupa a tela inteira — em 1280px o espaço real por
            cartao sobra pouco e o valor corta na borda (mesmo bug do grid de
            produtos no balcão, ver lista-produtos-pdv.tsx). Largura mínima
            por coluna com auto-fit deixa o número de colunas seguir o
            espaço real disponível aqui, não o viewport inteiro. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          <div className="flex flex-col gap-1.5 rounded-kx-cartao bg-kx-cartao p-5">
            <span className="text-[13px] font-semibold text-kx-texto-2">Vendas do dia</span>
            <span className="text-2xl font-extrabold tabular-nums text-kx-texto">
              {formatarMoeda(resumo.totalVendasSessao)}
            </span>
            <span className="text-xs tabular-nums text-kx-legenda">
              {resumo.quantidadeVendas} {resumo.quantidadeVendas === 1 ? "venda" : "vendas"} · ticket médio{" "}
              {formatarMoeda(resumo.ticketMedio)}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 rounded-kx-cartao bg-kx-sucesso-fundo p-5">
            <span className="text-[13px] font-semibold text-kx-texto-2">Dinheiro esperado na gaveta</span>
            <span className="text-2xl font-extrabold tabular-nums text-kx-texto">
              {formatarMoeda(resumo.dinheiroEsperadoGaveta)}
            </span>
            <span className="text-xs tabular-nums text-kx-legenda">
              Abertura {formatarMoeda(resumo.valorAbertura)} + dinheiro em vendas
            </span>
          </div>

          <div className="flex flex-col gap-1.5 rounded-kx-cartao bg-kx-conserto-fundo p-5">
            <span className="text-[13px] font-semibold text-kx-texto-2">Cartão e PIX</span>
            <span className="text-2xl font-extrabold tabular-nums text-kx-texto">
              {formatarMoeda(resumo.totalCartaoPixSessao)}
            </span>
            <span className="text-xs text-kx-conserto-texto">Não está na gaveta · cai na conta</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-kx-texto">Movimentações do caixa</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title="Chega com a reconstrução do caixa — ainda não é possível registrar suprimento."
                className="rounded-kx-botao"
              >
                <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Suprimento
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title="Chega com a reconstrução do caixa — ainda não é possível registrar sangria."
                className="rounded-kx-botao"
              >
                <ArrowDownCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Sangria
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {resumo.movimentos.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ShoppingBag className="h-5 w-5 text-kx-legenda" aria-hidden="true" />
                <p className="text-sm text-kx-legenda">Nenhuma venda nesta sessão ainda.</p>
              </div>
            )}

            {resumo.movimentos.map((movimento) => (
              <div
                key={movimento.id}
                className="grid grid-cols-[56px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-kx-botao bg-kx-superficie px-3 py-2.5 text-sm"
              >
                <span className="text-xs tabular-nums text-kx-legenda">{formatarHora(movimento.hora)}</span>
                <span className="truncate text-kx-texto">{movimento.descricao}</span>
                <PilulaStatus variante="neutro">Venda</PilulaStatus>
                <span className="text-right font-extrabold tabular-nums text-kx-sucesso-texto">
                  + {formatarMoeda(movimento.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <span className="text-base font-bold text-kx-texto">Entradas por forma</span>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {resumo.porForma.length === 0 && <p className="text-xs text-kx-legenda">Nenhuma venda nesta sessão ainda.</p>}

          {resumo.porForma.map((item, indice) => {
            const percentual = totalGeral > 0 ? Math.round((item.total / totalGeral) * 100) : 0;
            const cor = CORES_BARRA[indice % CORES_BARRA.length];
            return (
              <div key={item.formaPagamento} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-kx-texto-2">{ROTULO_FORMA[item.formaPagamento] ?? item.formaPagamento}</span>
                  <span className="font-bold tabular-nums text-kx-texto">{formatarMoeda(item.total)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-kx-painel-borda">
                  <div className={`h-full rounded-full ${cor}`} style={{ width: `${percentual}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          {fechamentoAutomaticoAtivo && (
            <div className="flex flex-col gap-0.5 rounded-kx-botao bg-kx-alerta-fundo px-3.5 py-2.5">
              <span className="text-xs text-kx-alerta-texto">Fechamento automático</span>
              <span className="text-[13px] font-bold text-kx-alerta-icone">
                Se ninguém fechar, o sistema fecha às {fechamentoAutomaticoHorario} sem conferência
              </span>
            </div>
          )}

          <Button type="button" onClick={onIrParaFechamento} className="h-[50px] rounded-kx-botao text-[15px] font-bold">
            <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
            Fechar o caixa
          </Button>
        </div>
      </aside>
    </section>
  );
}
