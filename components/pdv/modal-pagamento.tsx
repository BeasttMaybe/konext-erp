"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Barcode,
  Banknote,
  CheckCircle,
  CreditCard,
  FileText,
  HandCoins,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  QrCode,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  calcularPagamentoPdv,
  CONFIG_PAGAMENTOS_PDV,
  ehPagamentoPrazo,
  type EntradaPagamentoPdv,
  type FormaPagamentoPdv,
} from "@/lib/pdv/pagamentos";
import { exigeClienteRealParaFinalizarVenda } from "@/lib/dominio/crm/consumidor-final";
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

const normalizarFormaPagamentoPdv = (formaPagamento: FormaPagamentoPdv): FormaPagamentoPdv => {
  if (formaPagamento === "CARTAO_CREDITO_AVISTA" || formaPagamento === "CARTAO_CREDITO_PARCELADO") {
    return "CARTAO_CREDITO";
  }

  return formaPagamento;
};

interface LinhaPagamento {
  id: string;
  formaPagamento: FormaPagamentoPdv;
  valorBruto: number;
  parcelas: number;
  diasVencimento: number;
}

type EstadoFechamento =
  | {
      tipo: "fechado";
      label: "Fechado";
      mensagem?: string;
      podeConfirmar: true;
    }
  | {
      tipo: "falta_pagar";
      label: "Falta pagar";
      mensagem: string;
      podeConfirmar: false;
    }
  | {
      tipo: "corrigir";
      label: "Corrigir";
      mensagem: string;
      podeConfirmar: false;
    };

type PagamentoCalculado = ReturnType<typeof calcularPagamentoPdv>;

function rotuloFormaPagamentoCurto(forma: FormaPagamentoPdv): string {
  if (forma === "PIX") return "PIX";
  if (forma === "DINHEIRO") return "Dinheiro";
  if (forma === "CARTAO_DEBITO") return "Cartão de Débito";
  if (forma === "CARTAO_CREDITO") return "Cartão de Crédito";
  if (forma === "BOLETO") return "Boleto";
  if (forma === "CREDIARIO") return "Crediário";
  return forma;
}

function iconeFormaPagamento(forma: FormaPagamentoPdv) {
  if (forma === "PIX") return QrCode;
  if (forma === "DINHEIRO") return Banknote;
  if (forma === "CARTAO_DEBITO") return CreditCard;
  if (forma === "CARTAO_CREDITO") return CreditCard;
  if (forma === "BOLETO") return Barcode;
  if (forma === "CREDIARIO") return HandCoins;
  return CreditCard;
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
  _total: number,
  valorRecebidoDinheiro: number
): LinhaPagamento[] {
  // Valor recebido em dinheiro nao altera o valor atribuido a forma; ele apenas
  // influencia validacao (corrigir/fechado) e calculo de troco.
  if (!Number.isFinite(valorRecebidoDinheiro)) {
    return linhas;
  }

  return linhas;
}

function calcularEstadoFechamento(params: {
  totalVenda: number;
  totalInformado: number;
  totalDinheiroInformado: number;
  valorRecebidoDinheiro: number;
}): EstadoFechamento {
  const totalVendaCentavos = paraCentavos(params.totalVenda);
  const totalInformadoCentavos = paraCentavos(params.totalInformado);
  const saldoCentavos = totalVendaCentavos - totalInformadoCentavos;

  if (saldoCentavos > 0) {
    return {
      tipo: "falta_pagar",
      label: "Falta pagar",
      mensagem: `Falta pagar ${formatarMoeda(saldoCentavos / 100)}.`,
      podeConfirmar: false,
    };
  }

  if (saldoCentavos < 0) {
    return {
      tipo: "corrigir",
      label: "Corrigir",
      mensagem: `Valor informado excede o total em ${formatarMoeda(Math.abs(saldoCentavos) / 100)}.`,
      podeConfirmar: false,
    };
  }

  const totalDinheiroCentavos = paraCentavos(params.totalDinheiroInformado);
  if (totalDinheiroCentavos > 0) {
    const valorRecebidoCentavos = paraCentavos(params.valorRecebidoDinheiro);
    if (valorRecebidoCentavos < totalDinheiroCentavos) {
      return {
        tipo: "corrigir",
        label: "Corrigir",
        mensagem: "Valor recebido em dinheiro menor que o valor do pagamento.",
        podeConfirmar: false,
      };
    }
  }

  return {
    tipo: "fechado",
    label: "Fechado",
    podeConfirmar: true,
  };
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
  descontoAplicado?: number;
  configuracaoPagamento: ConfiguracaoPagamentosPDV | null;
  /** Fase 3-2C — consumidor final: false quando a venda vai cair no Consumidor Final. */
  temClienteSelecionado: boolean;
  aoFechar: () => void;
  aoConfirmar: (
    dados: DadosPagamento
  ) => Promise<{ sucesso: boolean; mensagem?: string; vendaId?: string }>;
  aoNovaVenda: () => void;
  /** Boleto/crediário sem cliente: fecha o modal (sem resetar) e foca a busca de cliente na página. */
  aoPrecisarDeCliente: () => void;
}

const MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO =
  "Selecione um cliente para continuar: vendas com boleto ou crediário geram uma conta a receber, e não é possível cobrar do Consumidor Final.";

export function ModalPagamento({
  aberto,
  total,
  descontoAplicado = 0,
  configuracaoPagamento,
  temClienteSelecionado,
  aoFechar,
  aoConfirmar,
  aoNovaVenda,
  aoPrecisarDeCliente,
}: PropsModalPagamento) {
  const configuracaoAtiva = useMemo<ConfiguracaoPdvPagamentos>(() => {
    return configuracaoPagamento ?? obterDefaultsConfiguracaoPdv();
  }, [configuracaoPagamento]);

  const formasPagamentoDisponiveis = useMemo(() => {
    return CONFIG_PAGAMENTOS_PDV.filter((opcao) => {
      if (opcao.formaPagamento === "TED" || opcao.formaPagamento === "EMPENHO_PUBLICO") {
        return false;
      }

      if (
        opcao.formaPagamento === "CARTAO_CREDITO_AVISTA" ||
        opcao.formaPagamento === "CARTAO_CREDITO_PARCELADO"
      ) {
        return false;
      }

      if (opcao.formaPagamento === "PIX") {
        return configuracaoAtiva.habilitarPix;
      }

      if (opcao.formaPagamento === "DINHEIRO") {
        return configuracaoAtiva.habilitarDinheiro;
      }

      if (opcao.formaPagamento === "CARTAO_CREDITO") {
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
  const [valorRecebidoEmEdicao, setValorRecebidoEmEdicao] = useState<string | null>(null);
  const [linhaEmEdicaoId, setLinhaEmEdicaoId] = useState<string | null>(null);
  const [seletorFormaAberto, setSeletorFormaAberto] = useState(false);
  const [pagamentoInicialAutomatico, setPagamentoInicialAutomatico] = useState(true);

  useEffect(() => {
    if (!aberto) return;

    setLinhas((estadoAtual) => {
      if (estadoAtual.length !== 1) return estadoAtual;

      const linhaAtual = estadoAtual[0];
      return [{ ...linhaAtual, valorBruto: total }];
    });

    setValorRecebidoEmEdicao(null);
    setLinhaEmEdicaoId(null);
    setSeletorFormaAberto(false);
    setPagamentoInicialAutomatico(true);
  }, [aberto, total]);

  useEffect(() => {
    if (!aberto) return;

    const linhaDinheiroUnica = linhas.length === 1 && linhas[0]?.formaPagamento === "DINHEIRO";
    if (linhaDinheiroUnica && linhaEmEdicaoId === null && valorRecebidoEmEdicao === null) {
      setValorRecebidoDinheiro(total);
      setValorRecebidoEmEdicao(formatarDecimalPtBr(total));
    }
  }, [aberto, linhaEmEdicaoId, linhas, total, valorRecebidoEmEdicao]);

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
          const formaNormalizada = normalizarFormaPagamentoPdv(linha.formaPagamento);

          if (formasAtivas.has(formaNormalizada)) {
            return {
              ...linha,
              formaPagamento: formaNormalizada,
            };
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

  const troco = totalDinheiro > 0 ? Math.max(0, valorRecebidoDinheiro - totalDinheiro) : 0;
  const saldoCentavos = paraCentavos(total) - paraCentavos(totalInformado);
  const totalAntesDesconto = total + Math.max(0, descontoAplicado);
  const percentualTaxaEstimado = totalInformado > 0 ? (totalTaxas / totalInformado) * 100 : 0;
  const estadoFechamento = calcularEstadoFechamento({
    totalVenda: total,
    totalInformado,
    totalDinheiroInformado: totalDinheiro,
    valorRecebidoDinheiro,
  });

  const resumoSaldo =
    estadoFechamento.tipo === "falta_pagar"
      ? {
          label: "Falta pagar",
          valor: formatarMoeda(Math.max(0, saldoCentavos) / 100),
          cor: "text-kx-alerta-texto",
        }
      : estadoFechamento.tipo === "fechado" && totalDinheiro > 0 && troco > 0
        ? {
            label: "Troco",
            valor: formatarMoeda(troco),
            cor: "text-kx-sucesso-texto",
          }
        : estadoFechamento.tipo === "fechado"
          ? {
              label: "Saldo",
              valor: formatarMoeda(0),
              cor: "text-kx-texto",
            }
          : {
              label: "Ajuste",
              valor: saldoCentavos < 0 ? formatarMoeda(Math.abs(saldoCentavos) / 100) : "Corrigir",
              cor: "text-kx-erro-texto",
            };

  const podeConfirmar = total > 0 && estadoFechamento.podeConfirmar;

  const resetar = () => {
    setLinhas([novaLinhaPagamento(total)]);
    setValorRecebidoDinheiro(0);
    setProcessando(false);
    setVendaFinalizada(false);
    setVendaIdGerada(null);
    setTotalVendaFinalizada(0);
    setValoresPagamentosEmEdicao({});
    setValorRecebidoEmEdicao(null);
    setLinhaEmEdicaoId(null);
    setSeletorFormaAberto(false);
    setPagamentoInicialAutomatico(true);
  };

  const calcularValorRestante = (pagamentosAtuais: LinhaPagamento[], totalVenda: number) => {
    const totalInformadoAtual = pagamentosAtuais.reduce((acc, linha) => acc + paraCentavos(linha.valorBruto), 0) / 100;
    return Math.max(0, totalVenda - totalInformadoAtual);
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
      const patchNormalizado = {
        ...patch,
        ...(patch.formaPagamento
          ? { formaPagamento: normalizarFormaPagamentoPdv(patch.formaPagamento) }
          : {}),
      };

      const atualizado = estadoAtual.map((linha) =>
        linha.id === id ? { ...linha, ...patchNormalizado } : linha
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
    setPagamentoInicialAutomatico(false);

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

  const valorRestante = calcularValorRestante(linhas, total);

  const selecionarPagamento = (pagamentoId: string) => {
    setLinhaEmEdicaoId(pagamentoId);
  };

  const removerPagamento = (pagamentoId: string) => {
    setLinhas((estadoAtual) => {
      if (estadoAtual.length === 1) return estadoAtual;
      const restante = estadoAtual.filter((linha) => linha.id !== pagamentoId);
      return distribuirValoresPagamentos(restante, total);
    });

    setLinhaEmEdicaoId((atual) => (atual === pagamentoId ? null : atual));
    setPagamentoInicialAutomatico(false);
  };

  const editarPagamento = (pagamentoId: string, patch: Partial<LinhaPagamento>) => {
    atualizarLinha(pagamentoId, patch);
    setPagamentoInicialAutomatico(false);
  };

  const abrirEditorLinha = (linha: LinhaPagamento) => {
    selecionarPagamento(linha.id);
    setValoresPagamentosEmEdicao((estadoAtual) => ({
      ...estadoAtual,
      [linha.id]: formatarDecimalPtBr(linha.valorBruto),
    }));

    if (linha.formaPagamento === "DINHEIRO") {
      setValorRecebidoEmEdicao(formatarDecimalPtBr(valorRecebidoDinheiro || linha.valorBruto));
    }
  };

  const fecharEditorLinha = () => {
    setLinhaEmEdicaoId(null);
    setValorRecebidoEmEdicao(null);
  };

  const valorInformadoPorForma = (forma: FormaPagamentoPdv): number => {
    return linhas
      .filter((linha) => linha.formaPagamento === forma)
      .reduce((acc, linha) => acc + linha.valorBruto, 0);
  };

  const linhaSelecionada = linhas.find((linha) => linha.id === linhaEmEdicaoId) ?? null;

  const pagamentosCalculadosPorLinha = useMemo<Record<string, PagamentoCalculado>>(() => {
    return linhas.reduce<Record<string, PagamentoCalculado>>((acc, linha, index) => {
      const calculado = pagamentosCalculados[index];
      if (calculado) {
        acc[linha.id] = calculado;
      }
      return acc;
    }, {});
  }, [linhas, pagamentosCalculados]);

  const substituirPagamentoUnico = (formaPagamento: FormaPagamentoPdv, diasPadrao: number) => {
    const linhaAtual = linhas[0];
    const linhaUnica = {
      id: linhaAtual?.id ?? crypto.randomUUID(),
      formaPagamento,
      valorBruto: total,
      parcelas: 1,
      diasVencimento: diasPadrao,
    } satisfies LinhaPagamento;

    setLinhas([linhaUnica]);
    setLinhaEmEdicaoId(null);
    setSeletorFormaAberto(false);
    setPagamentoInicialAutomatico(false);

    if (formaPagamento === "DINHEIRO") {
      setValorRecebidoDinheiro(total);
      setValorRecebidoEmEdicao(formatarDecimalPtBr(total));
    }
  };

  const adicionarLinhaPagamento = (formaPagamento: FormaPagamentoPdv, valorBrutoInicial: number, diasPadrao: number) => {
    const novaLinha: LinhaPagamento = {
      id: crypto.randomUUID(),
      formaPagamento,
      valorBruto: valorBrutoInicial,
      parcelas: 1,
      diasVencimento: diasPadrao,
    };

    setLinhas((estadoAtual) => distribuirValoresPagamentos([...estadoAtual, novaLinha], total));
    setSeletorFormaAberto(false);
    setPagamentoInicialAutomatico(false);

    if (valorBrutoInicial <= 0) {
      abrirEditorLinha(novaLinha);
      toast("Pagamento adicionado com valor zero para ajuste.");
      return;
    }

    setLinhaEmEdicaoId(null);

    if (formaPagamento === "DINHEIRO") {
      setValorRecebidoDinheiro(valorBrutoInicial);
      setValorRecebidoEmEdicao(formatarDecimalPtBr(valorBrutoInicial));
      sincronizarPagamentoDinheiro(valorBrutoInicial);
    }
  };

  const adicionarNovoPagamento = (formaPagamento: FormaPagamentoPdv) => {
    const diasPadrao =
      formaPagamento === "BOLETO"
        ? configuracaoAtiva.prazoPadraoBoletoDias
        : formaPagamento === "CREDIARIO"
          ? configuracaoAtiva.prazoPadraoCrediarioDias
          : 0;

    const existente = linhas.find((linha) => linha.formaPagamento === formaPagamento);
    if (existente) {
      selecionarPagamento(existente.id);
      setSeletorFormaAberto(false);
      toast("Esta forma ja foi adicionada. Edite o valor na lista de pagamentos.");
      if (formaPagamento === "DINHEIRO") {
        setValorRecebidoDinheiro(Math.max(total, totalInformado));
        setValorRecebidoEmEdicao(formatarDecimalPtBr(Math.max(total, totalInformado)));
      }
      return;
    }

    if (linhas.length === 1) {
      const linhaAtual = linhas[0];
      const linhaAtualCobreTotal = linhaAtual
        ? paraCentavos(linhaAtual.valorBruto) === paraCentavos(total)
        : false;

      if (!configuracaoAtiva.permitirPagamentoMisto && linhaAtual && linhaAtual.formaPagamento !== formaPagamento) {
        toast("Pagamento misto esta desativado. A forma anterior sera substituida.");
      }

      if (configuracaoAtiva.permitirPagamentoMisto) {
        if (pagamentoInicialAutomatico) {
          substituirPagamentoUnico(formaPagamento, diasPadrao);
          return;
        }

        adicionarLinhaPagamento(formaPagamento, linhaAtualCobreTotal ? 0 : valorRestante, diasPadrao);
        return;
      }

      substituirPagamentoUnico(formaPagamento, diasPadrao);
      return;
    }

    if (!configuracaoAtiva.permitirPagamentoMisto) {
      toast("Pagamento misto esta desativado. A forma anterior sera substituida.");
      substituirPagamentoUnico(formaPagamento, diasPadrao);
      return;
    }

    adicionarLinhaPagamento(formaPagamento, valorRestante > 0 ? valorRestante : 0, diasPadrao);
  };

  const aplicarFormaRapida = (formaPagamento: FormaPagamentoPdv) => {
    adicionarNovoPagamento(formaPagamento);
  };

  const abrirSeletorNovaForma = () => {
    if (!configuracaoAtiva.permitirPagamentoMisto && formasPagamentoDisponiveis.length === 1) {
      adicionarNovoPagamento(formasPagamentoDisponiveis[0].formaPagamento);
      return;
    }

    if (formasPagamentoDisponiveis.length === 1) {
      adicionarNovoPagamento(formasPagamentoDisponiveis[0].formaPagamento);
      return;
    }

    setSeletorFormaAberto(true);
  };

  const handleFechar = () => {
    resetar();
    aoFechar();
  };

  const handleConfirmar = async () => {
    if (!estadoFechamento.podeConfirmar) {
      toast.error(estadoFechamento.mensagem ?? "Ajuste os pagamentos para continuar.");
      return;
    }

    // Checagem proativa no cliente (o servidor tem a mesma trava, autoritativa
    // — ver processarVenda): evita a ida e volta e já foca o campo certo.
    if (!temClienteSelecionado && exigeClienteRealParaFinalizarVenda(linhas, ehPagamentoPrazo)) {
      toast.error(MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO);
      aoPrecisarDeCliente();
      return;
    }

    setProcessando(true);

    const dados: DadosPagamento = {
      pagamentos: linhas.map((linha) => ({
        formaPagamento: normalizarFormaPagamentoPdv(linha.formaPagamento),
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

  // Detalhe da forma (taxa configurada + quando o dinheiro chega) pras
  // "Formas rápidas" (referência: docs/design/referencia-pdv-pagamento.html).
  // Taxa vem da configuração real do tenant (parametrosCalculo), não do
  // percentualTaxaBase estático de CONFIG_PAGAMENTOS_PDV. Prazo de cartão
  // não existe como dado hoje (só boleto/crediário têm diasVencimento) —
  // por isso o texto pra cartão é sobre onde o dinheiro cai, não "em N
  // dias", pra não inventar um prazo que o sistema não rastreia.
  function detalheFormaRapida(forma: FormaPagamentoPdv): string {
    if (forma === "PIX") return "Sem taxa · cai na hora";
    if (forma === "DINHEIRO") return "Sem taxa · na gaveta";
    if (forma === "CARTAO_DEBITO") return `Taxa ${parametrosCalculo.taxaCartaoDebitoPercentual.toFixed(2)}% · direto na conta`;
    if (forma === "CARTAO_CREDITO") return `Taxa a partir de ${parametrosCalculo.taxaCartaoCreditoPorParcela[1].toFixed(2)}% · prazo da adquirente`;
    if (forma === "BOLETO") return `Sem taxa · vence em ${configuracaoAtiva.prazoPadraoBoletoDias} dias`;
    if (forma === "CREDIARIO") return `Sem taxa · vence em ${configuracaoAtiva.prazoPadraoCrediarioDias} dias`;
    return "";
  }

  // "O que o sistema vai registrar" (referência): estoque, caixa, taxa,
  // repasse esperado e parcelas — derivado só do que já está calculado
  // acima, nenhuma logica nova de negocio.
  const itensRegistro = useMemo(() => {
    const itens: { texto: string; tom: "neutro" | "sucesso" | "alerta" }[] = [];

    itens.push({
      texto: "Baixa no estoque dos itens do carrinho (produtos vinculados a esta venda).",
      tom: "neutro",
    });

    if (totalDinheiro > 0) {
      itens.push({ texto: `${formatarMoeda(totalDinheiro)} somam ao dinheiro esperado na gaveta.`, tom: "sucesso" });
    }

    const formasNaoDinheiro = linhas.filter((linha) => linha.valorBruto > 0 && linha.formaPagamento !== "DINHEIRO");
    for (const linha of formasNaoDinheiro) {
      const calculado = pagamentosCalculadosPorLinha[linha.id];
      if (!calculado) continue;
      const rotulo = rotuloFormaPagamentoCurto(linha.formaPagamento);
      if (calculado.valorTaxa > 0) {
        itens.push({
          texto: `${rotulo}: ${formatarMoeda(calculado.valorBruto)} bruto, taxa de ${formatarMoeda(calculado.valorTaxa)}, repasse líquido de ${formatarMoeda(calculado.valorLiquido)}.`,
          tom: "alerta",
        });
      } else {
        itens.push({ texto: `${rotulo}: ${formatarMoeda(calculado.valorBruto)}, sem taxa.`, tom: "neutro" });
      }

      if (linha.formaPagamento === "CARTAO_CREDITO" && linha.parcelas > 1) {
        itens.push({ texto: `Parcelado em ${linha.parcelas}x de ${formatarMoeda(linha.valorBruto / linha.parcelas)}.`, tom: "neutro" });
      }

      if ((linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO") && calculado.dataVencimento) {
        itens.push({ texto: `Vencimento previsto: ${calculado.dataVencimento.toLocaleDateString("pt-BR")}.`, tom: "neutro" });
      }
    }

    return itens;
  }, [linhas, pagamentosCalculadosPorLinha, totalDinheiro]);

  const corItemRegistro: Record<"neutro" | "sucesso" | "alerta", string> = {
    neutro: "text-kx-legenda",
    sucesso: "text-kx-sucesso-icone",
    alerta: "text-kx-alerta-icone",
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado && !processando) handleFechar();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-[95vw] max-w-[980px] flex-col overflow-hidden rounded-[26px] border-kx-painel-borda bg-kx-painel p-0"
      >
        {vendaFinalizada ? (
          <div className="flex max-h-[90vh] flex-col items-center justify-center space-y-5 overflow-y-auto px-6 py-4 text-center">
            <DialogTitle className="sr-only">Venda finalizada com sucesso</DialogTitle>
            <DialogDescription className="sr-only">
              Resumo da venda concluída, com opções de imprimir ou enviar o recibo.
            </DialogDescription>
            <CheckCircle size={64} className="text-kx-sucesso-icone animate-pulse" />

            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-kx-texto">Venda Finalizada com Sucesso!</h3>
              <p className="text-kx-legenda">
                Total da venda: <span className="font-semibold text-kx-texto">{formatarMoeda(totalVendaFinalizada)}</span>
              </p>
              {vendaIdGerada && (
                <p className="text-kx-legenda">
                  Comprovante: <span className="font-semibold text-kx-texto">#{vendaIdGerada.slice(0, 8)}</span>
                </p>
              )}
            </div>

            {urlRecibo && (
              <div className="w-full overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao">
                <iframe src={`${urlRecibo}?embed=1`} title="Preview do recibo" className="h-72 w-full" />
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
                className="w-full"
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

              <Button type="button" variant="secondary" className="w-full" onClick={() => toast("Módulo Fiscal (NF-e) em desenvolvimento.")}>
                <FileText className="h-4 w-4 mr-2" />
                Gerar Nota Fiscal
              </Button>
            </div>

            <div className="w-full border-t border-kx-painel-borda pt-4">
              <Button type="button" className="h-12 w-full text-base" onClick={handleNovaVenda}>
                Nova Venda
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="shrink-0 px-6 pt-5">
              <DialogTitle className="text-xl font-extrabold tracking-tight text-kx-texto">Pagamento</DialogTitle>
              <DialogDescription className="text-[13px] text-kx-legenda">
                Pode dividir em mais de uma forma. O total precisa fechar exatamente.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 pb-5 pt-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
              {/* Coluna principal: formas rápidas + pagamentos informados */}
              <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wide text-kx-legenda">Formas rápidas</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {formasPagamentoDisponiveis.map((opcao) => {
                      const valorDaForma = valorInformadoPorForma(opcao.formaPagamento);
                      const estaAtiva = valorDaForma > 0;

                      return (
                        <button
                          key={opcao.formaPagamento}
                          type="button"
                          onClick={() => aplicarFormaRapida(opcao.formaPagamento)}
                          aria-pressed={estaAtiva}
                          className={`flex min-h-[76px] flex-col justify-between gap-1.5 rounded-kx-cartao border px-3 py-3 text-left transition-colors ${
                            estaAtiva ? "border-kx-primaria bg-kx-primaria/10" : "border-kx-painel-borda bg-kx-cartao hover:border-kx-destaque"
                          }`}
                        >
                          <span className="text-sm font-extrabold text-kx-texto">{rotuloFormaPagamentoCurto(opcao.formaPagamento)}</span>
                          <span className={`text-[11px] tabular-nums ${estaAtiva ? "text-kx-destaque" : "text-kx-legenda"}`}>
                            {estaAtiva ? formatarMoeda(valorDaForma) : detalheFormaRapida(opcao.formaPagamento)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview desabilitado (Fase 3-2C): nao existe integracao real com
                    maquininha ainda — so a UI pra quando existir. Lancamento
                    manual (Formas rapidas acima) continua sendo o unico caminho
                    real hoje. */}
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

                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-bold text-kx-texto">Pagamentos informados</Label>
                    <div className="flex items-center gap-2">
                      {(configuracaoAtiva.permitirPagamentoMisto ? linhas.length < 2 : formasPagamentoDisponiveis.length > 1) && (
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
                              <span className="hidden sm:inline">Adicionar forma de pagamento</span>
                              <span className="sm:hidden">Adicionar</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-[280px] border-kx-painel-borda bg-kx-painel p-3 text-kx-texto">
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-semibold text-kx-texto">Escolher forma de pagamento</p>
                                <p className="text-xs text-kx-legenda">Selecione a forma que deseja adicionar ao fechamento.</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {formasPagamentoDisponiveis.map((opcao) => {
                                  const IconeForma = iconeFormaPagamento(opcao.formaPagamento);

                                  return (
                                    <Button
                                      key={`seletor-${opcao.formaPagamento}`}
                                      type="button"
                                      variant="outline"
                                      className="h-auto min-h-16 flex-col items-start gap-2 border-kx-painel-borda bg-kx-cartao px-3 py-2 text-left text-kx-texto"
                                      onClick={() => adicionarNovoPagamento(opcao.formaPagamento)}
                                    >
                                      <span className="rounded-kx-botao bg-kx-superficie p-2 text-kx-destaque">
                                        <IconeForma className="h-3.5 w-3.5" />
                                      </span>
                                      <span className="text-xs font-semibold leading-tight">{rotuloFormaPagamentoCurto(opcao.formaPagamento)}</span>
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      {(configuracaoAtiva.permitirPagamentoMisto || formasPagamentoDisponiveis.length > 1) && (
                        <span className="hidden text-[11px] text-kx-legenda lg:inline">
                          {configuracaoAtiva.permitirPagamentoMisto
                            ? "Clique no item ou em Editar para ajustar"
                            : "Selecione outra forma para substituir o pagamento atual"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto_auto] items-center gap-3 rounded-kx-botao bg-kx-superficie px-3 py-2 sm:grid">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-kx-legenda">Forma</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-kx-legenda">Detalhes</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-kx-legenda">Valor</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-kx-legenda">Ações</span>
                  </div>

                  <div className="space-y-2">
                    {linhas.map((linha) => {
                      const IconeLinha = iconeFormaPagamento(linha.formaPagamento);
                      const valorDaForma = linha.valorBruto;
                      const calculado = pagamentosCalculadosPorLinha[linha.id];
                      const dataVencimento = calculado?.dataVencimento?.toLocaleDateString("pt-BR") ?? "-";
                      const textoSecundario =
                        linha.formaPagamento === "DINHEIRO"
                          ? `Recebido ${formatarMoeda(valorRecebidoDinheiro)}${troco > 0 ? ` • Troco ${formatarMoeda(troco)}` : ""}`
                          : linha.formaPagamento === "CARTAO_CREDITO"
                            ? `${linha.parcelas}x de ${formatarMoeda(valorDaForma / Math.max(1, linha.parcelas))}`
                            : linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO"
                              ? `${linha.diasVencimento} dias • venc. ${dataVencimento}`
                              : rotuloFormaPagamentoCurto(linha.formaPagamento);

                      const selecionada = linhaSelecionada?.id === linha.id;

                      return (
                        <div
                          key={linha.id}
                          className={`rounded-kx-cartao border px-3 py-3 transition-colors ${
                            selecionada ? "border-kx-primaria bg-kx-primaria/8" : "border-kx-painel-borda bg-kx-cartao"
                          }`}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => abrirEditorLinha(linha)}
                            onKeyDown={(evento) => {
                              if (evento.key === "Enter" || evento.key === " ") {
                                evento.preventDefault();
                                abrirEditorLinha(linha);
                              }
                            }}
                            className="space-y-2 text-left sm:space-y-0"
                          >
                            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto_auto] sm:items-center sm:gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <div className={`rounded-kx-botao p-2 ${selecionada ? "bg-kx-primaria/15" : "bg-kx-superficie"}`}>
                                  <IconeLinha className="h-4 w-4 text-kx-destaque" />
                                </div>
                                <p className="truncate text-sm font-semibold text-kx-texto">{rotuloFormaPagamentoCurto(linha.formaPagamento)}</p>
                              </div>
                              <p className="truncate text-[11px] text-kx-legenda sm:text-xs">{textoSecundario}</p>
                              <p className="shrink-0 text-sm font-semibold text-kx-texto sm:text-right">{formatarMoeda(valorDaForma)}</p>
                              <div className="flex shrink-0 items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-kx-texto-2"
                                  onClick={(evento) => {
                                    evento.stopPropagation();
                                    abrirEditorLinha(linha);
                                  }}
                                >
                                  Editar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:bg-kx-erro-fundo"
                                  onClick={(evento) => {
                                    evento.stopPropagation();
                                    removerPagamento(linha.id);
                                  }}
                                  disabled={linhas.length === 1}
                                >
                                  <Trash2 className="h-4 w-4 text-kx-erro-icone" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {selecionada && (
                            <div className="mt-3 rounded-kx-botao border border-kx-painel-borda bg-kx-superficie p-3">
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-kx-texto">Adicionar pagamento - {rotuloFormaPagamentoCurto(linha.formaPagamento)}</p>
                                  <p className="text-[11px] text-kx-legenda">Ajuste os dados deste pagamento antes de aplicar.</p>
                                </div>
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-kx-legenda" onClick={fecharEditorLinha}>
                                  Cancelar
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
                                      className="h-10 border-kx-campo-borda bg-kx-painel text-kx-texto"
                                      value={valoresPagamentosEmEdicao[linha.id] ?? formatarDecimalPtBr(linha.valorBruto)}
                                      onChange={(e) => {
                                        const texto = sanitizarEntradaMonetaria(e.target.value);
                                        setValoresPagamentosEmEdicao((estadoAtual) => ({
                                          ...estadoAtual,
                                          [linha.id]: texto,
                                        }));
                                        atualizarValorLinha(linha.id, parseEntradaMonetaria(texto));
                                      }}
                                      onBlur={() => {
                                        setValoresPagamentosEmEdicao((estadoAtual) => ({
                                          ...estadoAtual,
                                          [linha.id]: formatarDecimalPtBr(linha.valorBruto),
                                        }));
                                      }}
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
                                        onChange={(e) => {
                                          const texto = sanitizarEntradaMonetaria(e.target.value);
                                          const valor = parseEntradaMonetaria(texto);
                                          setValorRecebidoEmEdicao(texto);
                                          setValorRecebidoDinheiro(valor);
                                          sincronizarPagamentoDinheiro(valor);
                                        }}
                                        onBlur={() => setValorRecebidoEmEdicao(formatarDecimalPtBr(valorRecebidoDinheiro))}
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
                                        onChange={(e) => {
                                          const dias = Math.min(365, Math.max(1, Number(e.target.value) || 1));
                                          editarPagamento(linha.id, { diasVencimento: dias });
                                        }}
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
                                          onClick={() => {
                                            setValorRecebidoDinheiro(atalho.valor);
                                            setValorRecebidoEmEdicao(formatarDecimalPtBr(atalho.valor));
                                            sincronizarPagamentoDinheiro(atalho.valor);
                                          }}
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
                                      <p className="text-xs text-kx-legenda">
                                        {linha.parcelas}x de {formatarMoeda(linha.valorBruto / Math.max(1, linha.parcelas))}
                                      </p>
                                    </div>
                                    <div>
                                      <div className="flex w-fit items-center gap-2 rounded-kx-botao bg-kx-painel p-1">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className="h-8 w-8 border-kx-campo-borda bg-kx-superficie text-kx-texto"
                                          onClick={() => editarPagamento(linha.id, { parcelas: Math.max(1, linha.parcelas - 1) })}
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
                                          onClick={() =>
                                            editarPagamento(linha.id, { parcelas: Math.min(configuracaoAtiva.maxParcelasCartaoCredito, linha.parcelas + 1) })
                                          }
                                          disabled={linha.parcelas >= configuracaoAtiva.maxParcelasCartaoCredito}
                                        >
                                          +
                                        </Button>
                                      </div>
                                      <p className="mt-2 text-xs text-kx-legenda">Taxa e valores líquidos são exibidos no financeiro.</p>
                                    </div>
                                  </div>
                                )}

                                {(linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO") && (
                                  <div className="flex items-center justify-between gap-3 rounded-kx-botao border border-dashed border-kx-campo-borda px-3 py-2 text-sm">
                                    <span className="text-kx-legenda">Vencimento previsto</span>
                                    <span className="font-medium text-kx-texto">{dataVencimento}</span>
                                  </div>
                                )}

                                <div className="flex flex-col gap-2 border-t border-kx-painel-borda pt-3 sm:flex-row sm:items-center sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 border-kx-campo-borda bg-transparent text-kx-texto sm:w-auto"
                                    onClick={fecharEditorLinha}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button type="button" size="sm" className="h-9 w-full min-w-32 sm:w-auto" onClick={fecharEditorLinha}>
                                    Adicionar pagamento
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-kx-cartao bg-kx-superficie p-3">
                  <div className="grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] text-kx-legenda">Total da venda</p>
                      <p className="font-semibold text-kx-texto">{formatarMoeda(totalAntesDesconto)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-kx-legenda">Informado</p>
                      <p className="font-semibold text-kx-texto">{formatarMoeda(totalInformado)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-kx-legenda">{resumoSaldo.label}</p>
                      <p className={`font-semibold ${resumoSaldo.cor}`}>{resumoSaldo.valor}</p>
                    </div>
                  </div>
                  {estadoFechamento.tipo !== "fechado" && estadoFechamento.mensagem && (
                    <p className="mt-2 text-xs text-kx-erro-texto">{estadoFechamento.mensagem}</p>
                  )}
                  {totalDinheiro > 0 && troco > 0 && estadoFechamento.tipo === "fechado" && (
                    <div className="mt-2 rounded-kx-botao bg-kx-sucesso-fundo px-2.5 py-2 text-xs">
                      <p className="text-kx-sucesso-texto">Troco para o cliente</p>
                      <p className="text-base font-semibold text-kx-sucesso-texto">{formatarMoeda(troco)}</p>
                    </div>
                  )}
                </div>

                <details className="rounded-kx-cartao bg-kx-superficie px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-kx-legenda">Detalhes financeiros internos</summary>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <div className="flex justify-between text-kx-legenda">
                      <span>Taxa estimada</span>
                      <span>{percentualTaxaEstimado.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-kx-alerta-texto">
                      <span>Valor total de taxas</span>
                      <span>{formatarMoeda(totalTaxas)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-kx-texto">
                      <span>Líquido estimado</span>
                      <span>{formatarMoeda(totalLiquido)}</span>
                    </div>
                    <p className="pt-1 text-xs text-kx-legenda">
                      Esses valores são informativos para gestão e aparecem detalhados em Financeiro &gt; Inteligência.
                    </p>
                  </div>
                </details>
              </div>

              {/* Coluna lateral: total, o que sera registrado, cupom e confirmar */}
              <div className="flex min-h-0 flex-col gap-3.5 lg:overflow-y-auto lg:pl-1">
                <div className="flex flex-col gap-1.5 rounded-kx-cartao bg-kx-entregue-fundo p-5">
                  <span className="text-[13px] font-semibold text-kx-texto-2">Total a pagar</span>
                  <span className="text-[32px] font-extrabold leading-none tracking-tight text-kx-texto">{formatarMoeda(total)}</span>
                  <span className="text-[13px] text-kx-texto-2">
                    Desconto de {formatarMoeda(descontoAplicado)}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-2.5 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-4">
                  <span className="text-sm font-bold text-kx-texto">O que o sistema vai registrar</span>
                  <div className="flex flex-col gap-2 overflow-y-auto">
                    {itensRegistro.map((item, indice) => (
                      <div key={indice} className="flex items-start gap-2 text-[13px] leading-snug">
                        <span className={`mt-0.5 font-bold ${corItemRegistro[item.tom]}`}>•</span>
                        <span className="text-kx-texto-2">{item.texto}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-col gap-0.5 rounded-kx-botao bg-kx-superficie px-3 py-2.5">
                    <span className="text-xs text-kx-legenda">Cupom</span>
                    <span className="text-[13px] font-semibold text-kx-texto">Imprimir e enviar por WhatsApp</span>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFechar}
                    disabled={processando}
                    className="h-[52px] flex-1 rounded-kx-botao border-kx-campo-borda"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmar}
                    disabled={processando || !podeConfirmar}
                    className="h-[52px] flex-[2] rounded-kx-botao text-base font-bold"
                  >
                    {processando ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>Confirmar venda</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
