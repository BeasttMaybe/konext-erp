"use client";

import { CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ResultadoUsePagamentoPdv, LinhaPagamento } from "@/lib/pdv/hooks/usar-pagamento-pdv";
import {
  formatarDecimalPtBr,
  formatarMoeda,
  formatarRotuloParcelas,
  IconeFormaPagamentoPdv,
  parseEntradaMonetaria,
  rotuloFormaPagamentoCurto,
  sanitizarEntradaMonetaria,
} from "@/lib/pdv/formatacao-pagamento-pdv";

interface PropsEtapaPagamentoPdv {
  pagamento: ResultadoUsePagamentoPdv;
}

/**
 * Etapa 3 — Pagamento (referência: docs/design/referencia-pdv-tres-etapas.html).
 * Antes era o conteúdo de <Dialog><DialogContent> em
 * components/pdv/modal-pagamento.tsx; agora é a etapa embutida na tela. Todo
 * o estado/cálculo/validação vem de lib/pdv/hooks/usar-pagamento-pdv.ts (que
 * o orquestrador — app/(dashboard)/pdv/page.tsx — monta uma única vez, pois
 * o botão primário da coluna "Resumo da venda" precisa acionar
 * `handleConfirmar`/`podeConfirmar` também). Este componente é só
 * apresentação: nenhuma lógica nova aqui. O total não é repetido aqui —
 * já aparece fixo na coluna da direita.
 */
export function EtapaPagamentoPdv({ pagamento }: PropsEtapaPagamentoPdv) {
  const {
    configuracaoAtiva,
    formasPagamentoDisponiveis,
    linhas,
    pagamentosCalculadosPorLinha,
    valorRecebidoDinheiro,
    valoresPagamentosEmEdicao,
    valorRecebidoEmEdicao,
    linhaSelecionada,
    seletorFormaAberto,
    setSeletorFormaAberto,
    totalDinheiro,
    troco,
    valorInformadoPorForma,
    aplicarFormaRapida,
    abrirSeletorNovaForma,
    adicionarNovoPagamento,
    abrirEditorLinha,
    fecharEditorLinha,
    atualizarValorLinha,
    setValoresPagamentosEmEdicao,
    setValorRecebidoEmEdicao,
    digitarValorRecebido,
    aplicarAtalhoValorRecebido,
    editarPagamento,
    removerPagamento,
    detalheFormaRapida,
  } = pagamento;

  const podeAdicionarNovaForma =
    configuracaoAtiva.permitirPagamentoMisto ? linhas.length < formasPagamentoDisponiveis.length : formasPagamentoDisponiveis.length > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-bold text-kx-texto">Como o cliente vai pagar?</span>
        <span className="text-[13px] text-kx-legenda">Pode dividir em mais de uma forma. O total precisa fechar exatamente.</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {formasPagamentoDisponiveis.map((opcao) => {
          const valorDaForma = valorInformadoPorForma(opcao.formaPagamento);
          const estaAtiva = valorDaForma > 0;

          return (
            <button
              key={opcao.formaPagamento}
              type="button"
              onClick={() => aplicarFormaRapida(opcao.formaPagamento)}
              aria-pressed={estaAtiva}
              className={`flex min-h-[72px] flex-col justify-between gap-1.5 rounded-kx-cartao border px-3.5 py-3 text-left transition-colors ${
                estaAtiva ? "border-kx-primaria bg-kx-primaria/10" : "border-kx-painel-borda bg-kx-cartao hover:border-kx-destaque"
              }`}
            >
              <span className="text-sm font-extrabold text-kx-texto">{rotuloFormaPagamentoCurto(opcao.formaPagamento)}</span>
              <span className={`text-[12px] tabular-nums ${estaAtiva ? "text-kx-destaque" : "text-kx-legenda"}`}>
                {estaAtiva ? formatarMoeda(valorDaForma) : detalheFormaRapida(opcao.formaPagamento)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Preview desabilitado — não existe integração real com maquininha ainda. */}
      <div
        title="Chega numa fase futura — integração com maquininha ainda não existe."
        className="flex items-center gap-3 rounded-kx-cartao border border-dashed border-kx-campo-borda bg-kx-superficie px-4 py-3 opacity-70"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-kx-botao bg-kx-cartao text-kx-legenda">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-kx-texto">Aguardando a maquininha…</p>
          <p className="truncate text-[11px] text-kx-legenda">Chega numa fase futura — use as formas rápidas para lançar manualmente.</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Label className="text-sm font-bold text-kx-texto">Pagamentos informados</Label>
          {podeAdicionarNovaForma && (
            <Popover open={seletorFormaAberto} onOpenChange={setSeletorFormaAberto}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-kx-botao border-kx-campo-borda px-2 text-xs"
                  onClick={abrirSeletorNovaForma}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar forma
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[280px] border-kx-painel-borda bg-kx-painel p-3 text-kx-texto">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-kx-texto">Escolher forma de pagamento</p>
                    <p className="text-xs text-kx-legenda">Selecione a forma que deseja adicionar ao fechamento.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {formasPagamentoDisponiveis.map((opcao) => (
                      <Button
                        key={`seletor-${opcao.formaPagamento}`}
                        type="button"
                        variant="outline"
                        className="h-auto min-h-16 flex-col items-start gap-2 border-kx-painel-borda bg-kx-cartao px-3 py-2 text-left text-kx-texto"
                        onClick={() => adicionarNovoPagamento(opcao.formaPagamento)}
                      >
                        <span className="rounded-kx-botao bg-kx-superficie p-2 text-kx-destaque">
                          <IconeFormaPagamentoPdv forma={opcao.formaPagamento} className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-semibold leading-tight">{rotuloFormaPagamentoCurto(opcao.formaPagamento)}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {linhas.map((linha) => (
            <LinhaPagamentoInformado
              key={linha.id}
              linha={linha}
              selecionada={linhaSelecionada?.id === linha.id}
              podeRemover={linhas.length > 1}
              calculado={pagamentosCalculadosPorLinha[linha.id]}
              valorRecebidoDinheiro={valorRecebidoDinheiro}
              troco={troco}
              totalDinheiro={totalDinheiro}
              valorEditado={valoresPagamentosEmEdicao[linha.id] ?? formatarDecimalPtBr(linha.valorBruto)}
              valorRecebidoEmEdicao={valorRecebidoEmEdicao}
              maxParcelas={configuracaoAtiva.maxParcelasCartaoCredito}
              onAbrirEditor={() => abrirEditorLinha(linha)}
              onFecharEditor={fecharEditorLinha}
              onRemover={() => removerPagamento(linha.id)}
              onAlterarValorTexto={(texto) => {
                setValoresPagamentosEmEdicao((estadoAtual) => ({ ...estadoAtual, [linha.id]: texto }));
                atualizarValorLinha(linha.id, parseEntradaMonetaria(texto));
              }}
              onBlurValor={() =>
                setValoresPagamentosEmEdicao((estadoAtual) => ({
                  ...estadoAtual,
                  [linha.id]: formatarDecimalPtBr(linha.valorBruto),
                }))
              }
              onAlterarValorRecebido={(texto) => digitarValorRecebido(texto)}
              onBlurValorRecebido={() => setValorRecebidoEmEdicao(formatarDecimalPtBr(valorRecebidoDinheiro))}
              onAtalhoDinheiro={(valor) => aplicarAtalhoValorRecebido(valor)}
              onAlterarDias={(dias) => editarPagamento(linha.id, { diasVencimento: dias })}
              onAlterarParcelas={(parcelas) => editarPagamento(linha.id, { parcelas })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PropsLinhaPagamentoInformado {
  linha: LinhaPagamento;
  selecionada: boolean;
  podeRemover: boolean;
  calculado: ResultadoUsePagamentoPdv["pagamentosCalculadosPorLinha"][string] | undefined;
  valorRecebidoDinheiro: number;
  troco: number;
  totalDinheiro: number;
  valorEditado: string;
  valorRecebidoEmEdicao: string | null;
  maxParcelas: number;
  onAbrirEditor: () => void;
  onFecharEditor: () => void;
  onRemover: () => void;
  onAlterarValorTexto: (texto: string) => void;
  onBlurValor: () => void;
  onAlterarValorRecebido: (texto: string) => void;
  onBlurValorRecebido: () => void;
  onAtalhoDinheiro: (valor: number) => void;
  onAlterarDias: (dias: number) => void;
  onAlterarParcelas: (parcelas: number) => void;
}

function LinhaPagamentoInformado({
  linha,
  selecionada,
  podeRemover,
  calculado,
  valorRecebidoDinheiro,
  troco,
  totalDinheiro,
  valorEditado,
  valorRecebidoEmEdicao,
  maxParcelas,
  onAbrirEditor,
  onFecharEditor,
  onRemover,
  onAlterarValorTexto,
  onBlurValor,
  onAlterarValorRecebido,
  onBlurValorRecebido,
  onAtalhoDinheiro,
  onAlterarDias,
  onAlterarParcelas,
}: PropsLinhaPagamentoInformado) {
  const dataVencimento = calculado?.dataVencimento?.toLocaleDateString("pt-BR") ?? "-";
  const textoSecundario =
    linha.formaPagamento === "DINHEIRO"
      ? `Recebido ${formatarMoeda(valorRecebidoDinheiro)}${troco > 0 ? ` • Troco ${formatarMoeda(troco)}` : ""}`
      : linha.formaPagamento === "CARTAO_CREDITO"
        ? formatarRotuloParcelas(linha.valorBruto, linha.parcelas)
        : linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO"
          ? `${linha.diasVencimento} dias • venc. ${dataVencimento}`
          : rotuloFormaPagamentoCurto(linha.formaPagamento);

  return (
    <div
      className={`rounded-kx-cartao border px-3 py-2.5 transition-colors ${
        selecionada ? "border-kx-primaria bg-kx-primaria/8" : "border-kx-painel-borda bg-kx-cartao"
      }`}
      onKeyDown={(evento) => {
        // No card inteiro (não só dentro do painel do editor): o foco pode
        // estar no botão "Editar", num atalho de valor ou em qualquer
        // campo quando o operador aperta Esc — restringir o handler só ao
        // painel interno deixava Esc sem efeito sempre que o foco não
        // estivesse EXATAMENTE dentro dele (ex.: reabrir "Editar" com o
        // editor já aberto deixa o foco no próprio botão, fora do painel).
        if (evento.key === "Escape" && selecionada) {
          evento.stopPropagation();
          onFecharEditor();
        }
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onAbrirEditor}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            onAbrirEditor();
          }
        }}
        className="flex flex-col gap-2 text-left sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto_auto] sm:items-center sm:gap-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className={`rounded-kx-botao p-2 ${selecionada ? "bg-kx-primaria/15" : "bg-kx-superficie"}`}>
            <IconeFormaPagamentoPdv forma={linha.formaPagamento} className="h-4 w-4 text-kx-destaque" />
          </div>
          <p className="truncate text-sm font-semibold text-kx-texto">{rotuloFormaPagamentoCurto(linha.formaPagamento)}</p>
        </div>
        <p className="truncate text-[11px] text-kx-legenda sm:text-xs">{textoSecundario}</p>
        <p className="shrink-0 text-sm font-semibold text-kx-texto sm:text-right">{formatarMoeda(linha.valorBruto)}</p>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-kx-texto-2" onClick={(e) => { e.stopPropagation(); onAbrirEditor(); }}>
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-kx-erro-fundo"
            onClick={(e) => { e.stopPropagation(); onRemover(); }}
            disabled={!podeRemover}
          >
            <span className="text-kx-erro-icone">×</span>
          </Button>
        </div>
      </div>

      {selecionada && (
        <div className="mt-3 rounded-kx-botao border border-kx-painel-borda bg-kx-superficie p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-kx-texto">Ajustar {rotuloFormaPagamentoCurto(linha.formaPagamento)}</p>
              <p className="text-[11px] text-kx-legenda">Ajuste os dados deste pagamento antes de confirmar. Esc fecha.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-kx-legenda" onClick={onFecharEditor}>
              Fechar
            </Button>
          </div>

          <div className="space-y-3">
            <div
              className={`grid gap-2 ${
                linha.formaPagamento === "DINHEIRO" || linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO"
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-kx-legenda">Valor</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  className="h-10 border-kx-campo-borda bg-kx-painel text-kx-texto"
                  value={valorEditado}
                  onChange={(e) => onAlterarValorTexto(sanitizarEntradaMonetaria(e.target.value))}
                  onBlur={onBlurValor}
                />
              </div>

              {linha.formaPagamento === "DINHEIRO" && (
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wide text-kx-legenda">Valor recebido</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-10 border-kx-campo-borda bg-kx-painel text-kx-texto"
                    value={valorRecebidoEmEdicao ?? formatarDecimalPtBr(valorRecebidoDinheiro)}
                    onChange={(e) => onAlterarValorRecebido(sanitizarEntradaMonetaria(e.target.value))}
                    onBlur={onBlurValorRecebido}
                  />
                </div>
              )}

              {(linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO") && (
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wide text-kx-legenda">Dias para vencimento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    className="h-10 border-kx-campo-borda bg-kx-painel text-kx-texto"
                    value={linha.diasVencimento}
                    onChange={(e) => onAlterarDias(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </div>
              )}
            </div>

            {linha.formaPagamento === "DINHEIRO" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Exato", valor: totalDinheiro || linha.valorBruto },
                    { label: "R$ 50,00", valor: 50 },
                    { label: "R$ 100,00", valor: 100 },
                    { label: "R$ 200,00", valor: 200 },
                  ].map((atalho) => (
                    <Button
                      key={atalho.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 border-kx-campo-borda bg-kx-painel text-kx-texto-2"
                      onClick={() => onAtalhoDinheiro(atalho.valor)}
                    >
                      {atalho.label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-2 rounded-kx-botao border border-kx-painel-borda bg-kx-painel p-2.5 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-kx-legenda">Valor da venda</p>
                    <p className="font-semibold text-kx-texto">{formatarMoeda(totalDinheiro)}</p>
                  </div>
                  <div>
                    <p className="text-kx-legenda">Recebido</p>
                    <p className="font-semibold text-kx-texto">{formatarMoeda(valorRecebidoDinheiro)}</p>
                  </div>
                  <div>
                    <p className="text-kx-legenda">Troco</p>
                    <p className={`font-semibold ${troco > 0 ? "text-kx-sucesso-texto" : "text-kx-texto"}`}>{formatarMoeda(troco)}</p>
                  </div>
                </div>
              </div>
            )}

            {linha.formaPagamento === "CARTAO_CREDITO" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] uppercase tracking-wide text-kx-legenda">Parcelas</Label>
                  <p className="text-xs text-kx-legenda">{formatarRotuloParcelas(linha.valorBruto, linha.parcelas)}</p>
                </div>
                <div className="flex w-fit items-center gap-2 rounded-kx-botao bg-kx-painel p-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-kx-campo-borda bg-kx-superficie text-kx-texto"
                    onClick={() => onAlterarParcelas(Math.max(1, linha.parcelas - 1))}
                    disabled={linha.parcelas <= 1}
                  >
                    -
                  </Button>
                  <div className="min-w-16 px-3 text-center text-sm font-semibold text-kx-texto">{linha.parcelas}x</div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-kx-campo-borda bg-kx-superficie text-kx-texto"
                    onClick={() => onAlterarParcelas(Math.min(maxParcelas, linha.parcelas + 1))}
                    disabled={linha.parcelas >= maxParcelas}
                  >
                    +
                  </Button>
                </div>
              </div>
            )}

            {(linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO") && (
              <div className="flex items-center justify-between gap-3 rounded-kx-botao border border-dashed border-kx-campo-borda px-3 py-2 text-sm">
                <span className="text-kx-legenda">Vencimento previsto</span>
                <span className="font-medium text-kx-texto">{dataVencimento}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
