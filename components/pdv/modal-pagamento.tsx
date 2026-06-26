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
  WalletCards,
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
  | { status: "fechado"; mensagem: "Fechado" }
  | { status: "faltando"; mensagem: string }
  | { status: "excedente"; mensagem: string }
  | { status: "erro"; mensagem: string };

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
  descontoAplicado?: number;
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
  descontoAplicado = 0,
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

  const troco = Math.max(0, valorRecebidoDinheiro - totalDinheiro);
  const totalCorreto = paraCentavos(totalInformado) === paraCentavos(total);
  const diferenca = totalInformado - total;
  const totalAntesDesconto = total + Math.max(0, descontoAplicado);
  const percentualTaxaEstimado = totalInformado > 0 ? (totalTaxas / totalInformado) * 100 : 0;
  const erroDinheiro = totalDinheiro > 0 && paraCentavos(valorRecebidoDinheiro) < paraCentavos(totalDinheiro);
  const estadoFechamento: EstadoFechamento = erroDinheiro
    ? { status: "erro", mensagem: "Valor recebido em dinheiro menor que o valor da forma Dinheiro." }
    : diferenca < 0
      ? { status: "faltando", mensagem: `Falta pagar ${formatarMoeda(Math.abs(diferenca))}` }
      : diferenca > 0
        ? { status: "excedente", mensagem: `Valor excedente ${formatarMoeda(diferenca)}` }
        : { status: "fechado", mensagem: "Fechado" };

  const statusResumo =
    estadoFechamento.status === "fechado"
      ? { texto: "Fechado", cor: "text-emerald-400", borda: "border-emerald-500/20", fundo: "bg-emerald-500/10" }
      : estadoFechamento.status === "faltando"
        ? { texto: "Falta pagar", cor: "text-amber-400", borda: "border-amber-500/20", fundo: "bg-amber-500/10" }
        : estadoFechamento.status === "excedente"
          ? { texto: "Valor excedente", cor: "text-rose-400", borda: "border-rose-500/20", fundo: "bg-rose-500/10" }
          : { texto: "Corrigir pagamento", cor: "text-rose-400", borda: "border-rose-500/20", fundo: "bg-rose-500/10" };
  const resumoStatusTexto =
    estadoFechamento.status === "erro"
      ? "Corrigir pagamento"
      : estadoFechamento.status === "faltando"
        ? "Falta pagar"
        : estadoFechamento.status === "excedente"
          ? "Valor excedente"
          : "Fechado";

  const podeConfirmar =
    !processando &&
    total > 0 &&
    estadoFechamento.status === "fechado" &&
    totalCorreto &&
    !erroDinheiro;

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

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado && !processando) handleFechar();
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[92vw] max-w-[620px] flex-col overflow-hidden border border-slate-800 bg-slate-950 p-0 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.65)] transition-all duration-300">
        {vendaFinalizada ? (
          <div className="flex flex-col items-center justify-center py-4 px-6 text-center space-y-5 max-h-[90vh] overflow-y-auto">
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
            <DialogHeader className="shrink-0 border-b border-slate-800/80 px-5 pt-5 pb-3">
              <DialogTitle className="text-lg font-semibold text-slate-50">Finalizar Venda</DialogTitle>
              <DialogDescription className="text-slate-400">
                Informe como o cliente vai pagar.
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col px-5 pb-3">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-3">
                <div className="rounded-2xl border border-blue-900/60 bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-blue-200/70">Total final</p>
                          <p className="mt-1 text-2xl font-bold leading-none text-white sm:text-3xl">{formatarMoeda(total)}</p>
                        </div>
                        <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-3 text-blue-100 sm:flex sm:h-16 sm:w-16 sm:items-center sm:justify-center">
                          <WalletCards className="h-8 w-8" />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-blue-200/60">Total da venda</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">{formatarMoeda(totalAntesDesconto)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-blue-200/60">Desconto</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">{formatarMoeda(descontoAplicado)}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-blue-200/60">Fechamento</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-300">Pronto para conferir</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Formas rápidas</Label>
                  <div className="grid max-w-[420px] grid-cols-2 gap-2 sm:grid-cols-3">
                    {formasPagamentoDisponiveis.map((opcao) => {
                      const Icone = iconeFormaPagamento(opcao.formaPagamento);
                      const valorDaForma = valorInformadoPorForma(opcao.formaPagamento);
                      const estaAtiva = valorDaForma > 0;

                      return (
                        <button
                          key={opcao.formaPagamento}
                          type="button"
                          onClick={() => aplicarFormaRapida(opcao.formaPagamento)}
                          className={`flex aspect-square w-full max-w-[128px] justify-self-start flex-col justify-between rounded-2xl border px-2.5 py-2.5 text-left transition ${estaAtiva
                            ? "border-blue-500/70 bg-blue-500/12 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]"
                            : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className={`rounded-xl p-2 ${estaAtiva ? "bg-blue-500/18 text-blue-200" : "bg-slate-800 text-slate-300"}`}>
                              <Icone className="h-4 w-4" />
                            </div>
                          </div>
                          <div>
                            <span className="block text-xs font-semibold text-slate-100">{rotuloFormaPagamentoCurto(opcao.formaPagamento)}</span>
                            <span className={`mt-1 block text-[11px] ${valorDaForma > 0 ? "text-blue-200" : "text-slate-500"}`}>
                              {valorDaForma > 0 ? formatarMoeda(valorDaForma) : "Sem valor"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-semibold text-slate-100">Pagamentos</Label>
                    <div className="flex items-center gap-2">
                      {(configuracaoAtiva.permitirPagamentoMisto ? linhas.length < 2 : formasPagamentoDisponiveis.length > 1) && (
                        <Popover open={seletorFormaAberto} onOpenChange={setSeletorFormaAberto}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-white"
                              onClick={abrirSeletorNovaForma}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Adicionar forma de pagamento</span>
                              <span className="sm:hidden">Adicionar</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-[280px] border-slate-800 bg-slate-950 p-3 text-slate-100 shadow-[0_24px_60px_rgba(2,6,23,0.55)]"
                          >
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-100">Escolher forma de pagamento</p>
                                <p className="text-xs text-slate-500">Selecione a forma que deseja adicionar ao fechamento.</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {formasPagamentoDisponiveis.map((opcao) => {
                                  const IconeForma = iconeFormaPagamento(opcao.formaPagamento);

                                  return (
                                    <Button
                                      key={`seletor-${opcao.formaPagamento}`}
                                      type="button"
                                      variant="outline"
                                      className="h-auto min-h-16 flex-col items-start gap-2 border-slate-800 bg-slate-900 px-3 py-2 text-left text-slate-200 hover:bg-slate-800 hover:text-white"
                                      onClick={() => adicionarNovoPagamento(opcao.formaPagamento)}
                                    >
                                      <span className="rounded-lg bg-slate-800 p-2 text-blue-300">
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
                        <span className="hidden text-[11px] text-slate-500 lg:inline">
                          {configuracaoAtiva.permitirPagamentoMisto
                            ? "Clique no item ou em Editar para ajustar"
                            : "Selecione outra forma para substituir o pagamento atual"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto_auto] sm:items-center sm:gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Forma</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Detalhes</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Valor</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ações</span>
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
                          className={`rounded-2xl border px-3 py-3 transition ${selecionada
                            ? "border-blue-500/70 bg-blue-500/8 shadow-[0_0_0_1px_rgba(59,130,246,0.1)]"
                            : "border-slate-800 bg-slate-900/80"
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
                              <div className="min-w-0 flex items-center gap-2">
                                <div className={`rounded-xl p-2 ${selecionada ? "bg-blue-500/15" : "bg-slate-800"}`}>
                                  <IconeLinha className="h-4 w-4 text-blue-300" />
                                </div>
                                <p className="truncate text-sm font-semibold text-slate-100">
                                  {rotuloFormaPagamentoCurto(linha.formaPagamento)}
                                </p>
                              </div>
                              <p className="truncate text-[11px] text-slate-400 sm:text-xs">{textoSecundario}</p>
                              <p className="shrink-0 text-sm font-semibold text-slate-100 sm:text-right">{formatarMoeda(valorDaForma)}</p>
                              <div className="flex shrink-0 items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
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
                                  className="h-7 w-7 hover:bg-red-500/10"
                                  onClick={(evento) => {
                                    evento.stopPropagation();
                                    removerPagamento(linha.id);
                                  }}
                                  disabled={linhas.length === 1}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {selecionada && (
                            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-100">Adicionar pagamento - {rotuloFormaPagamentoCurto(linha.formaPagamento)}</p>
                                  <p className="text-[11px] text-slate-500">Ajuste os dados deste pagamento antes de aplicar.</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
                                  onClick={fecharEditorLinha}
                                >
                                  Cancelar
                                </Button>
                              </div>

                              <div className="space-y-3">
                                <div className={`grid gap-2 ${linha.formaPagamento === "DINHEIRO" || linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] uppercase tracking-wide text-slate-400">Valor</Label>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      className="h-10 border-slate-800 bg-slate-950 text-slate-100"
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
                                      <Label className="text-[11px] uppercase tracking-wide text-slate-400">Valor recebido</Label>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        className="h-10 border-slate-800 bg-slate-950 text-slate-100"
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
                                      <Label className="text-[11px] uppercase tracking-wide text-slate-400">Dias para vencimento</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={365}
                                        className="h-10 border-slate-800 bg-slate-950 text-slate-100"
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
                                          className="h-8 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
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
                                    <p className="text-xs text-slate-400">Troco: {formatarMoeda(troco)}</p>
                                  </div>
                                )}

                                {linha.formaPagamento === "CARTAO_CREDITO" && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[11px] uppercase tracking-wide text-slate-400">Parcelas</Label>
                                      <p className="text-xs text-slate-400">{linha.parcelas}x de {formatarMoeda(linha.valorBruto / Math.max(1, linha.parcelas))}</p>
                                    </div>
                                    <div>
                                      <div className="flex w-fit items-center gap-2 rounded-xl bg-slate-900 p-1">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className="h-8 w-8 border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
                                          onClick={() => editarPagamento(linha.id, { parcelas: Math.max(1, linha.parcelas - 1) })}
                                          disabled={linha.parcelas <= 1}
                                        >
                                          -
                                        </Button>
                                        <div className="min-w-16 px-3 text-center text-sm font-semibold text-slate-100">
                                          {linha.parcelas}x
                                        </div>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className="h-8 w-8 border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
                                          onClick={() => editarPagamento(linha.id, { parcelas: Math.min(configuracaoAtiva.maxParcelasCartaoCredito, linha.parcelas + 1) })}
                                          disabled={linha.parcelas >= configuracaoAtiva.maxParcelasCartaoCredito}
                                        >
                                          +
                                        </Button>
                                      </div>
                                      <p className="mt-2 text-xs text-slate-500">Taxa e valores liquidos sao exibidos no financeiro.</p>
                                    </div>
                                  </div>
                                )}

                                {(linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO") && (
                                  <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-800 px-3 py-2 text-sm">
                                    <span className="text-slate-500">Vencimento previsto</span>
                                    <span className="font-medium text-slate-100">{dataVencimento}</span>
                                  </div>
                                )}

                                <div className="flex flex-col gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 sm:w-auto"
                                    onClick={fecharEditorLinha}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-9 w-full min-w-32 bg-blue-600 text-white hover:bg-blue-500 sm:w-auto"
                                    onClick={fecharEditorLinha}
                                  >
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

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm">
                  <div className="grid grid-cols-2 gap-y-3 sm:grid-cols-4 sm:gap-2">
                    <div>
                      <p className="text-[11px] text-slate-500">Total a pagar</p>
                      <p className="font-semibold text-slate-100">{formatarMoeda(total)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Total informado</p>
                      <p className="font-semibold text-slate-100">{formatarMoeda(totalInformado)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Diferença</p>
                      <p className={`font-semibold ${statusResumo.cor}`}>{formatarMoeda(Math.abs(diferenca))}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Status</p>
                      <p className={`font-semibold ${statusResumo.cor}`}>{resumoStatusTexto}</p>
                    </div>
                  </div>
                  {estadoFechamento.status === "erro" && (
                    <p className="mt-2 text-xs text-rose-400">{estadoFechamento.mensagem}</p>
                  )}
                  {totalDinheiro > 0 && troco > 0 && estadoFechamento.status === "fechado" && (
                    <p className="mt-2 text-xs text-emerald-400">Troco: {formatarMoeda(troco)}</p>
                  )}
                </div>

                <details className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-400">
                    Detalhes financeiros internos
                  </summary>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Taxa estimada</span>
                      <span>{percentualTaxaEstimado.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-orange-400">
                      <span>Valor total de taxas</span>
                      <span>{formatarMoeda(totalTaxas)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-slate-100">
                      <span>Líquido estimado</span>
                      <span>{formatarMoeda(totalLiquido)}</span>
                    </div>
                    <p className="pt-1 text-xs text-slate-500">
                      Esses valores são informativos para gestão e aparecem detalhados em Financeiro &gt; Inteligência.
                    </p>
                  </div>
                </details>
              </div>

              <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 px-5 py-3 backdrop-blur-sm">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFechar}
                    disabled={processando}
                    className="h-10 w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmar}
                    disabled={!podeConfirmar}
                    className="h-10 w-full min-w-36 bg-blue-600 text-white hover:bg-blue-500 sm:w-auto"
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
