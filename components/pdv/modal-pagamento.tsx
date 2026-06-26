"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  calcularPagamentoPdv,
  CONFIG_PAGAMENTOS_PDV,
  type EntradaPagamentoPdv,
  type FormaPagamentoPdv,
} from "@/lib/pdv/pagamentos";
import { obterDefaultsConfiguracaoPdv, type ConfiguracaoPdvPagamentos } from "@/lib/configuracoes-pdv";
import type { ConfiguracaoPagamentosPDV } from "@/app/actions/pdv";

export interface DadosPagamento {
  pagamentos: EntradaPagamentoPdv[];
  totalTaxas: number;
  totalLiquido: number;
  totalCobrado: number;
  valorRecebidoDinheiro?: number;
  troco?: number;
}

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);

const formatarDecimalPtBr = (valor: number): string => valor.toFixed(2).replace(".", ",");

const sanitizarEntradaMonetaria = (valor: string): string => {
  const apenasPermitidos = valor.replace(/[^\d,\.]/g, "");
  const valorComVirgula = apenasPermitidos.replace(/\./g, ",");
  const [parteInteira, ...decimais] = valorComVirgula.split(",");
  if (decimais.length === 0) return parteInteira;
  return `${parteInteira},${decimais.join("").slice(0, 2)}`;
};

const parseEntradaMonetaria = (valor: string): number => {
  if (!valor.trim()) return 0;
  const normalizado = valor.replace(/\./g, "").replace(",", ".").trim();
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
};

interface LinhaPagamento {
  id: string;
  formaPagamento: FormaPagamentoPdv;
  valorBruto: number;
  parcelas: number;
  diasVencimento: number;
}

function distribuirValoresPagamentos(
  linhas: LinhaPagamento[],
  total: number
): LinhaPagamento[] {
  if (linhas.length <= 1) {
    return linhas.map((linha) => ({ ...linha, valorBruto: total }));
  }

  const totalCentavos = paraCentavos(total);
  const primeiraLinha = linhas[0];
  const demais = linhas.slice(1);
  const totalDemaisCentavos = demais.reduce((acc, linha) => acc + paraCentavos(linha.valorBruto), 0);
  const valorPrimeiraCentavos = Math.max(0, totalCentavos - totalDemaisCentavos);

  return [
    { ...primeiraLinha, valorBruto: valorPrimeiraCentavos / 100 },
    ...demais,
  ];
}

function sincronizarValorDinheiroNasLinhas(
  linhas: LinhaPagamento[],
  total: number,
  valorRecebidoDinheiro: number
): LinhaPagamento[] {
  const indiceDinheiro = linhas.findIndex((linha) => linha.formaPagamento === "DINHEIRO");
  if (indiceDinheiro < 0) return linhas;

  const atualizado = [...linhas];
  const totalCentavos = paraCentavos(total);
  const somaOutrasFormasCentavos = atualizado.reduce((acc, linha, index) => {
    if (index === indiceDinheiro) return acc;
    return acc + paraCentavos(linha.valorBruto);
  }, 0);

  const valorDevidoDinheiroCentavos = Math.max(0, totalCentavos - somaOutrasFormasCentavos);
  const valorRecebidoCentavos = paraCentavos(valorRecebidoDinheiro);
  const valorAplicadoDinheiroCentavos = Math.min(valorRecebidoCentavos, valorDevidoDinheiroCentavos);

  atualizado[indiceDinheiro] = {
    ...atualizado[indiceDinheiro],
    valorBruto: valorAplicadoDinheiroCentavos / 100,
  };

  return atualizado;
}

function novaLinhaPagamento(total: number): LinhaPagamento {
  return {
    id: crypto.randomUUID(),
    formaPagamento: "DINHEIRO",
    valorBruto: total,
    parcelas: 1,
    diasVencimento: 0,
  };
}

interface PropsModalPagamento {
  aberto: boolean;
  total: number;
  configuracaoPagamento: ConfiguracaoPagamentosPDV | null;
  aoFechar: () => void;
  aoConfirmar: (
    dados: DadosPagamento
  ) => Promise<{ sucesso: boolean; mensagem?: string; vendaId?: string }>;
  aoNovaVenda: () => void;
}

export function ModalPagamento({
  aberto,
  total,
  configuracaoPagamento,
  aoFechar,
  aoConfirmar,
  aoNovaVenda,
}: PropsModalPagamento) {
  const configuracaoAtiva = useMemo<ConfiguracaoPdvPagamentos>(() => {
    return configuracaoPagamento ?? obterDefaultsConfiguracaoPdv();
  }, [configuracaoPagamento]);

  const formasPagamentoDisponiveis = useMemo(() => {
    return CONFIG_PAGAMENTOS_PDV.filter((opcao) => {
      if (opcao.formaPagamento === "PIX" || opcao.formaPagamento === "TED") {
        return configuracaoAtiva.habilitarPix;
      }

      if (opcao.formaPagamento === "DINHEIRO") {
        return configuracaoAtiva.habilitarDinheiro;
      }

      if (
        opcao.formaPagamento === "CARTAO_CREDITO" ||
        opcao.formaPagamento === "CARTAO_CREDITO_AVISTA" ||
        opcao.formaPagamento === "CARTAO_CREDITO_PARCELADO"
      ) {
        return configuracaoAtiva.habilitarCartaoCredito;
      }

      if (opcao.formaPagamento === "CARTAO_DEBITO") {
        return configuracaoAtiva.habilitarCartaoDebito;
      }

      if (opcao.formaPagamento === "BOLETO") {
        return configuracaoAtiva.habilitarBoleto;
      }

      if (opcao.formaPagamento === "CREDIARIO") {
        return configuracaoAtiva.habilitarCrediario;
      }

      return true;
    });
  }, [configuracaoAtiva]);

  const formaPadrao = formasPagamentoDisponiveis[0]?.formaPagamento ?? "DINHEIRO";

  const parametrosCalculo = useMemo(
    () => ({
      taxaCartaoDebitoPercentual: configuracaoAtiva.taxaCartaoDebitoPercentual,
      taxaCartaoCreditoPorParcela: {
        1: configuracaoAtiva.taxaCartaoCredito1xPercentual,
        2: configuracaoAtiva.taxaCartaoCredito2xPercentual,
        3: configuracaoAtiva.taxaCartaoCredito3xPercentual,
        4: configuracaoAtiva.taxaCartaoCredito4xPercentual,
        5: configuracaoAtiva.taxaCartaoCredito5xPercentual,
        6: configuracaoAtiva.taxaCartaoCredito6xPercentual,
        7: configuracaoAtiva.taxaCartaoCredito7xPercentual,
        8: configuracaoAtiva.taxaCartaoCredito8xPercentual,
        9: configuracaoAtiva.taxaCartaoCredito9xPercentual,
        10: configuracaoAtiva.taxaCartaoCredito10xPercentual,
        11: configuracaoAtiva.taxaCartaoCredito11xPercentual,
        12: configuracaoAtiva.taxaCartaoCredito12xPercentual,
      },
      maxParcelasCartaoCredito: configuracaoAtiva.maxParcelasCartaoCredito,
      prazoPadraoBoletoDias: configuracaoAtiva.prazoPadraoBoletoDias,
      prazoPadraoCrediarioDias: configuracaoAtiva.prazoPadraoCrediarioDias,
    }),
    [configuracaoAtiva]
  );

  const [linhas, setLinhas] = useState<LinhaPagamento[]>([novaLinhaPagamento(total)]);
  const [valorRecebidoDinheiro, setValorRecebidoDinheiro] = useState<number>(0);
  const [processando, setProcessando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(false);
  const [vendaIdGerada, setVendaIdGerada] = useState<string | null>(null);
  const [totalVendaFinalizada, setTotalVendaFinalizada] = useState<number>(0);
  const [valoresPagamentosEmEdicao, setValoresPagamentosEmEdicao] = useState<Record<string, string>>({});
  const [valorRecebidoEmEdicao, setValorRecebidoEmEdicao] = useState<string>("");

  useEffect(() => {
    if (!aberto) return;

    setLinhas((estadoAtual) => {
      if (estadoAtual.length !== 1) return estadoAtual;

      const linhaAtual = estadoAtual[0];
      return [{ ...linhaAtual, valorBruto: total }];
    });

    setValorRecebidoEmEdicao("");
  }, [aberto, total]);

  useEffect(() => {
    if (!aberto) return;

    const formasAtivas = new Set(formasPagamentoDisponiveis.map((item) => item.formaPagamento));

    setLinhas((estadoAtual) => {
      let proximo = estadoAtual
        .filter((linha, index) => {
          if (index === 0) return true;
          return configuracaoAtiva.permitirPagamentoMisto;
        })
        .map((linha) => {
          if (formasAtivas.has(linha.formaPagamento)) {
            return linha;
          }

          return {
            ...linha,
            formaPagamento: formaPadrao,
            parcelas: 1,
            diasVencimento:
              formaPadrao === "BOLETO"
                ? configuracaoAtiva.prazoPadraoBoletoDias
                : formaPadrao === "CREDIARIO"
                  ? configuracaoAtiva.prazoPadraoCrediarioDias
                  : 0,
          };
        });

      if (proximo.length === 0) {
        proximo = [
          {
            id: crypto.randomUUID(),
            formaPagamento: formaPadrao,
            valorBruto: total,
            parcelas: 1,
            diasVencimento:
              formaPadrao === "BOLETO"
                ? configuracaoAtiva.prazoPadraoBoletoDias
                : formaPadrao === "CREDIARIO"
                  ? configuracaoAtiva.prazoPadraoCrediarioDias
                  : 0,
          },
        ];
      }

      if (!configuracaoAtiva.permitirPagamentoMisto && proximo.length > 1) {
        proximo = [proximo[0]];
      }

      return distribuirValoresPagamentos(proximo, total);
    });
  }, [aberto, configuracaoAtiva, formasPagamentoDisponiveis, formaPadrao, total]);

  const pagamentosCalculados = useMemo(() => {
    return linhas.map((linha) =>
      calcularPagamentoPdv({
        formaPagamento: linha.formaPagamento,
        valorBruto: linha.valorBruto,
        parcelas: linha.parcelas,
        diasVencimento: linha.diasVencimento,
      }, parametrosCalculo)
    );
  }, [linhas, parametrosCalculo]);

  const totalInformado = useMemo(() => {
    return pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorBruto), 0) / 100;
  }, [pagamentosCalculados]);

  const totalTaxas = useMemo(() => {
    return pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorTaxa), 0) / 100;
  }, [pagamentosCalculados]);

  const totalLiquido = useMemo(() => {
    return pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorLiquido), 0) / 100;
  }, [pagamentosCalculados]);

  const totalDinheiro = useMemo(() => {
    return pagamentosCalculados
      .filter((item) => item.formaPagamento === "DINHEIRO")
      .reduce((acc, item) => acc + paraCentavos(item.valorBruto), 0) / 100;
  }, [pagamentosCalculados]);

  const troco = Math.max(0, valorRecebidoDinheiro - totalDinheiro);
  const dinheiroInsuficiente = totalDinheiro > 0 && paraCentavos(valorRecebidoDinheiro) < paraCentavos(totalDinheiro);
  const totalCorreto = paraCentavos(totalInformado) === paraCentavos(total);
  const diferenca = totalInformado - total;

  const podeConfirmar =
    !processando &&
    total > 0 &&
    totalCorreto &&
    (totalDinheiro === 0 || !dinheiroInsuficiente);

  const resetar = () => {
    setLinhas([novaLinhaPagamento(total)]);
    setValorRecebidoDinheiro(0);
    setProcessando(false);
    setVendaFinalizada(false);
    setVendaIdGerada(null);
    setTotalVendaFinalizada(0);
    setValoresPagamentosEmEdicao({});
    setValorRecebidoEmEdicao("");
  };

  const sincronizarPagamentoDinheiro = (valorRecebido: number) => {
    const novasLinhas = sincronizarValorDinheiroNasLinhas(linhas, total, valorRecebido);
    setLinhas(novasLinhas);

    setValoresPagamentosEmEdicao((estadoAtual) => {
      const proximo = { ...estadoAtual };
      for (const linha of novasLinhas) {
        if (Object.prototype.hasOwnProperty.call(proximo, linha.id)) {
          proximo[linha.id] = formatarDecimalPtBr(linha.valorBruto);
        }
      }
      return proximo;
    });
  };

  const atualizarLinha = (id: string, patch: Partial<LinhaPagamento>) => {
    setLinhas((estadoAtual) => {
      const atualizado = estadoAtual.map((linha) =>
        linha.id === id ? { ...linha, ...patch } : linha
      );

      if (atualizado.length <= 1) {
        return atualizado;
      }

      const primeiraLinhaId = atualizado[0]?.id;
      if (!primeiraLinhaId || id === primeiraLinhaId) {
        return atualizado;
      }

      return distribuirValoresPagamentos(atualizado, total);
    });
  };

  const atualizarValorLinha = (id: string, valorBruto: number) => {
    setLinhas((estadoAtual) => {
      const indiceEditado = estadoAtual.findIndex((linha) => linha.id === id);
      if (indiceEditado < 0) return estadoAtual;

      const atualizado = estadoAtual.map((linha) => ({ ...linha }));
      atualizado[indiceEditado].valorBruto = Math.max(0, valorBruto);

      if (atualizado.length === 2) {
        const outroIndice = indiceEditado === 0 ? 1 : 0;
        const valorEditadoCentavos = paraCentavos(atualizado[indiceEditado].valorBruto);
        const valorRestanteCentavos = Math.max(0, paraCentavos(total) - valorEditadoCentavos);
        atualizado[outroIndice].valorBruto = valorRestanteCentavos / 100;
        return atualizado;
      }

      if (atualizado.length <= 1) {
        return atualizado;
      }

      const primeiraLinhaId = atualizado[0]?.id;
      if (!primeiraLinhaId || id === primeiraLinhaId) {
        return atualizado;
      }

      return distribuirValoresPagamentos(atualizado, total);
    });

    if (linhas.length === 2) {
      const outraLinha = linhas.find((linha) => linha.id !== id);
      if (!outraLinha) return;

      const valorRestanteCentavos = Math.max(0, paraCentavos(total) - paraCentavos(Math.max(0, valorBruto)));
      setValoresPagamentosEmEdicao((estadoAtual) => ({
        ...estadoAtual,
        [outraLinha.id]: formatarDecimalPtBr(valorRestanteCentavos / 100),
      }));
    }
  };

  const adicionarLinha = () => {
    if (!configuracaoAtiva.permitirPagamentoMisto) return;

    setLinhas((estadoAtual) =>
      distribuirValoresPagamentos(
        [
          ...estadoAtual,
          {
            id: crypto.randomUUID(),
            formaPagamento: formaPadrao,
            valorBruto: 0,
            parcelas: 1,
            diasVencimento:
              formaPadrao === "BOLETO"
                ? configuracaoAtiva.prazoPadraoBoletoDias
                : formaPadrao === "CREDIARIO"
                  ? configuracaoAtiva.prazoPadraoCrediarioDias
                  : 0,
          },
        ],
        total
      )
    );
  };

  const removerLinha = (id: string) => {
    setLinhas((estadoAtual) => {
      if (estadoAtual.length === 1) return estadoAtual;
      const restante = estadoAtual.filter((linha) => linha.id !== id);
      return distribuirValoresPagamentos(restante, total);
    });
  };

  const handleFechar = () => {
    resetar();
    aoFechar();
  };

  const handleConfirmar = async () => {
    setProcessando(true);

    const dados: DadosPagamento = {
      pagamentos: linhas.map((linha) => ({
        formaPagamento: linha.formaPagamento,
        valorBruto: linha.valorBruto,
        parcelas: linha.parcelas,
        diasVencimento: linha.diasVencimento,
      })),
      totalTaxas,
      totalLiquido,
      totalCobrado: totalInformado,
      valorRecebidoDinheiro: totalDinheiro > 0 ? valorRecebidoDinheiro : undefined,
      troco: totalDinheiro > 0 ? troco : undefined,
    };

    try {
      const resultado = await aoConfirmar(dados);

      if (!resultado.sucesso) {
        if (resultado.mensagem) {
          toast.error(resultado.mensagem);
        }
        return;
      }

      setTotalVendaFinalizada(totalInformado);
      setVendaIdGerada(resultado.vendaId || null);
      setVendaFinalizada(true);
    } finally {
      setProcessando(false);
    }
  };

  const handleNovaVenda = () => {
    // Adia o fechamento um instante para evitar click-through no botão
    // de "Finalizar Venda" que fica atrás do modal.
    setTimeout(() => {
      aoNovaVenda();
      aoFechar();
    }, 80);
  };

  const urlRecibo = vendaIdGerada ? `/recibo/${vendaIdGerada}` : null;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado && !processando) handleFechar();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto transition-all duration-300">
        {vendaFinalizada ? (
          <div className="flex flex-col items-center justify-center py-4 text-center space-y-5">
            <CheckCircle size={64} className="text-emerald-500 animate-pulse" />

            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                Venda Finalizada com Sucesso!
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Total da venda: <span className="font-semibold">{formatarMoeda(totalVendaFinalizada)}</span>
              </p>
              {vendaIdGerada && (
                <p className="text-slate-600 dark:text-slate-400">
                  Comprovante: <span className="font-semibold">#{vendaIdGerada.slice(0, 8)}</span>
                </p>
              )}
            </div>

            {urlRecibo && (
              <div className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-slate-900">
                <iframe
                  src={`${urlRecibo}?embed=1`}
                  title="Preview do recibo"
                  className="w-full h-72"
                />
              </div>
            )}

            <div className="w-full space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!urlRecibo) return;
                  window.open(`${urlRecibo}?autoprint=1`, "_blank", "noopener,noreferrer");
                }}
                disabled={!urlRecibo}
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Recibo
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(
                      `Ola! Segue o comprovante da sua compra na Konext. Total: ${formatarMoeda(totalVendaFinalizada)}${
                        vendaIdGerada ? ` | Venda: #${vendaIdGerada.slice(0, 8)}` : ""
                      }`
                    )}`,
                    "_blank"
                  )
                }
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar pelo WhatsApp
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() =>
                  toast("Módulo Fiscal (NF-e) em desenvolvimento.")
                }
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Nota Fiscal
              </Button>
            </div>

            <div className="w-full border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <Button type="button" className="w-full h-12 text-base" onClick={handleNovaVenda}>
                Nova Venda
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Finalizar Venda</DialogTitle>
              <DialogDescription>
                Distribua o valor entre uma ou mais formas de pagamento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Total a pagar */}
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total a pagar
                </span>
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {formatarMoeda(total)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Pagamentos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={adicionarLinha}
                    disabled={!configuracaoAtiva.permitirPagamentoMisto}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar forma
                  </Button>
                </div>

                {!configuracaoAtiva.permitirPagamentoMisto && (
                  <p className="text-xs text-muted-foreground">
                    Pagamento misto está desabilitado nas configurações do PDV.
                  </p>
                )}

                <div className="space-y-2">
                  {linhas.map((linha, index) => {
                    const config = CONFIG_PAGAMENTOS_PDV.find((item) => item.formaPagamento === linha.formaPagamento);
                    return (
                      <div key={linha.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Pagamento {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removerLinha(linha.id)}
                            disabled={linhas.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>

                        <div className={`grid grid-cols-1 ${linhas.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1"} gap-2`}>
                          <div className="space-y-1">
                            <Label>Forma</Label>
                            <Select
                              value={linha.formaPagamento}
                              onValueChange={(valor) => {
                                const forma = valor as FormaPagamentoPdv;
                                atualizarLinha(linha.id, {
                                  formaPagamento: forma,
                                  parcelas: 1,
                                  diasVencimento:
                                    forma === "BOLETO"
                                      ? configuracaoAtiva.prazoPadraoBoletoDias
                                      : forma === "CREDIARIO"
                                        ? configuracaoAtiva.prazoPadraoCrediarioDias
                                        : 0,
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {formasPagamentoDisponiveis.map((opcao) => (
                                  <SelectItem key={opcao.formaPagamento} value={opcao.formaPagamento}>
                                    {opcao.rotulo}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {linhas.length > 1 && (
                            <div className="space-y-1">
                              <Label>Valor</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={valoresPagamentosEmEdicao[linha.id] ?? formatarDecimalPtBr(linha.valorBruto)}
                                onChange={(e) => {
                                  const texto = sanitizarEntradaMonetaria(e.target.value);
                                  setValoresPagamentosEmEdicao((estadoAtual) => ({
                                    ...estadoAtual,
                                    [linha.id]: texto,
                                  }));
                                  const valor = parseEntradaMonetaria(texto);
                                  atualizarValorLinha(linha.id, valor);
                                }}
                                onBlur={() => {
                                  setValoresPagamentosEmEdicao((estadoAtual) => ({
                                    ...estadoAtual,
                                    [linha.id]: formatarDecimalPtBr(linha.valorBruto),
                                  }));
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {config?.permiteParcelas && (
                          <div className="space-y-1">
                            <Label>Parcelas</Label>
                            <Input
                              type="number"
                              min={1}
                              max={configuracaoAtiva.maxParcelasCartaoCredito}
                              value={linha.parcelas}
                              onChange={(e) => {
                                const parcelas = Math.min(
                                  configuracaoAtiva.maxParcelasCartaoCredito,
                                  Math.max(1, Number(e.target.value) || 1)
                                );
                                atualizarLinha(linha.id, { parcelas });
                              }}
                            />
                          </div>
                        )}

                        {config?.exigePrazo && (
                          <div className="space-y-1">
                            <Label>Dias para vencimento</Label>
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              value={linha.diasVencimento}
                              onChange={(e) => {
                                const dias = Math.min(365, Math.max(1, Number(e.target.value) || 1));
                                atualizarLinha(linha.id, { diasVencimento: dias });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {totalDinheiro > 0 && (
                <div className="space-y-2">
                  <Label>Valor recebido em dinheiro</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valorRecebidoEmEdicao || formatarDecimalPtBr(valorRecebidoDinheiro)}
                    onChange={(e) => {
                      const texto = sanitizarEntradaMonetaria(e.target.value);
                      const valor = parseEntradaMonetaria(texto);
                      setValorRecebidoEmEdicao(texto);
                      setValorRecebidoDinheiro(valor);
                      sincronizarPagamentoDinheiro(valor);
                    }}
                    onBlur={() => setValorRecebidoEmEdicao(formatarDecimalPtBr(valorRecebidoDinheiro))}
                  />
                  <div className="flex gap-2 flex-wrap">
                    {[totalDinheiro, 50, 100, 200].map((v, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setValorRecebidoDinheiro(v);
                          setValorRecebidoEmEdicao(formatarDecimalPtBr(v));
                          sincronizarPagamentoDinheiro(v);
                        }}
                      >
                        {idx === 0 ? "Exato" : formatarMoeda(v)}
                      </Button>
                    ))}
                  </div>
                  {dinheiroInsuficiente && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Valor recebido em dinheiro menor que o valor da forma Dinheiro.
                    </p>
                  )}
                </div>
              )}

              {/* Resumo de taxas */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total da venda</span>
                  <span>{formatarMoeda(total)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total informado</span>
                  <span>{formatarMoeda(totalInformado)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Diferenca</span>
                  <span className={diferenca === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {formatarMoeda(diferenca)}
                  </span>
                </div>
                <div className="flex justify-between text-orange-600 dark:text-orange-400">
                  <span>Taxas totais</span>
                  <span>- {formatarMoeda(totalTaxas)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span>Você recebe (líquido)</span>
                  <span>{formatarMoeda(totalLiquido)}</span>
                </div>
                {totalDinheiro > 0 && !dinheiroInsuficiente && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                    <span>Troco</span>
                    <span>{formatarMoeda(troco)}</span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFechar}
                  disabled={processando}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={!podeConfirmar}
                >
                  {processando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>Confirmar Recebimento</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
