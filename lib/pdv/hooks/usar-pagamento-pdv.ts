"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { paraCentavos as converterParaCentavos, paraMoeda, somar, subtrair } from "@/lib/dinheiro";
import {
  formatarDecimalPtBr,
  formatarMoeda,
  MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO,
  normalizarFormaPagamentoPdv,
  parseEntradaMonetaria,
  rotuloFormaPagamentoCurto,
  formatarRotuloParcelas,
} from "@/lib/pdv/formatacao-pagamento-pdv";

/**
 * Estado + lógica do fluxo de pagamento do PDV — extraído de
 * components/pdv/modal-pagamento.tsx (Fase "PDV em 3 etapas") pra poder
 * viver na Etapa 3 embutida na tela em vez de dentro de um <Dialog>. Nenhuma
 * regra de cálculo/validação/idempotência mudou nesta extração — só QUANDO o
 * estado é montado e reiniciado:
 *
 * - Antes: o modal tinha uma prop `aberto` e todo o estado nascia/reiniciava
 *   quando o modal ABRIA (clique em "Finalizar venda").
 * - Agora: este hook fica montado o tempo todo (a página inteira é uma única
 *   venda em andamento) e reinicia quando `tentativaVendaId` muda — o
 *   chamador (app/(dashboard)/pdv/page.tsx) incrementa esse número toda vez
 *   que uma NOVA TENTATIVA de venda começa (nova venda após sucesso,
 *   "Cancelar venda"). Reenvios da MESMA tentativa (ex.: erro do servidor,
 *   clique duplo) reusam a mesma `chaveIdempotencia` — mesma regra de
 *   sempre, só a fonte do "quando trocar" mudou.
 */

export const paraCentavos = converterParaCentavos;

export interface LinhaPagamento {
  id: string;
  formaPagamento: FormaPagamentoPdv;
  valorBruto: number;
  parcelas: number;
  diasVencimento: number;
}

export type EstadoFechamentoPagamento =
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

export type PagamentoCalculado = ReturnType<typeof calcularPagamentoPdv>;

export interface DadosPagamento {
  pagamentos: EntradaPagamentoPdv[];
  totalTaxas: number;
  totalLiquido: number;
  totalCobrado: number;
  valorRecebidoDinheiro?: number;
  troco?: number;
  chaveIdempotencia?: string;
}

function distribuirValoresPagamentos(linhas: LinhaPagamento[], total: number): LinhaPagamento[] {
  if (linhas.length <= 1) {
    return linhas.map((linha) => ({ ...linha, valorBruto: total }));
  }

  const totalCentavos = paraCentavos(total);
  const primeiraLinha = linhas[0];
  const demais = linhas.slice(1);
  const totalDemaisCentavos = demais.reduce((acc, linha) => acc + paraCentavos(linha.valorBruto), 0);
  const valorPrimeiraCentavos = Math.max(0, totalCentavos - totalDemaisCentavos);

  return [{ ...primeiraLinha, valorBruto: valorPrimeiraCentavos / 100 }, ...demais];
}

function calcularEstadoFechamento(params: {
  totalVenda: number;
  totalInformado: number;
  totalDinheiroInformado: number;
  valorRecebidoDinheiro: number;
}): EstadoFechamentoPagamento {
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

  return { tipo: "fechado", label: "Fechado", podeConfirmar: true };
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

export interface PropsUsarPagamentoPdv {
  total: number;
  descontoAplicado?: number;
  configuracaoPagamento: ConfiguracaoPagamentosPDV | null;
  /** false quando a venda vai cair no Consumidor Final. */
  temClienteSelecionado: boolean;
  /** Muda a cada NOVA TENTATIVA de venda (nova venda após sucesso, cancelar venda) — dispara o reinício do estado e uma nova chaveIdempotencia. */
  tentativaVendaId: number;
  aoConfirmar: (dados: DadosPagamento) => Promise<{ sucesso: boolean; mensagem?: string; vendaId?: string }>;
  /** Boleto/crediário sem cliente: navega pra Etapa Cliente. */
  aoPrecisarDeCliente: () => void;
}

export function usePagamentoPdv({
  total,
  descontoAplicado = 0,
  configuracaoPagamento,
  temClienteSelecionado,
  tentativaVendaId,
  aoConfirmar,
  aoPrecisarDeCliente,
}: PropsUsarPagamentoPdv) {
  const configuracaoAtiva = useMemo<ConfiguracaoPdvPagamentos>(() => {
    return configuracaoPagamento ?? obterDefaultsConfiguracaoPdv();
  }, [configuracaoPagamento]);

  const formasPagamentoDisponiveis = useMemo(() => {
    return CONFIG_PAGAMENTOS_PDV.filter((opcao) => {
      if (opcao.formaPagamento === "TED" || opcao.formaPagamento === "EMPENHO_PUBLICO") {
        return false;
      }

      if (opcao.formaPagamento === "CARTAO_CREDITO_AVISTA" || opcao.formaPagamento === "CARTAO_CREDITO_PARCELADO") {
        return false;
      }

      if (opcao.formaPagamento === "PIX") return configuracaoAtiva.habilitarPix;
      if (opcao.formaPagamento === "DINHEIRO") return configuracaoAtiva.habilitarDinheiro;
      if (opcao.formaPagamento === "CARTAO_CREDITO") return configuracaoAtiva.habilitarCartaoCredito;
      if (opcao.formaPagamento === "CARTAO_DEBITO") return configuracaoAtiva.habilitarCartaoDebito;
      if (opcao.formaPagamento === "BOLETO") return configuracaoAtiva.habilitarBoleto;
      if (opcao.formaPagamento === "CREDIARIO") return configuracaoAtiva.habilitarCrediario;

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
  // Sentinela "o operador editou o valor recebido nesta tentativa" —
  // separada de `valorRecebidoEmEdicao` de propósito (bug real, achado
  // rodando o fluxo 2 — desconto — ao vivo): `valorRecebidoEmEdicao` também
  // é setado pelo AUTO-sync abaixo (bloco 2), então usá-lo como sentinela de
  // "já foi editado manualmente" fazia o auto-sync se autodesligar depois
  // do primeiro total, e o valor recebido ficava preso no total antigo pra
  // sempre (ex.: 1º item soma R$34,90 e sincroniza; 2º item some R$69,80
  // mas o "recebido" não acompanha mais — trava "Corrigir" sem nenhum jeito
  // óbvio de entender por quê). Só marca true em ação EXPLÍCITA do operador
  // no campo "Valor recebido" (digitação ou atalho) — nunca pelo auto-sync.
  const [recebidoTocado, setRecebidoTocado] = useState(false);
  const [linhaEmEdicaoId, setLinhaEmEdicaoId] = useState<string | null>(null);
  const [seletorFormaAberto, setSeletorFormaAberto] = useState(false);
  const [pagamentoInicialAutomatico, setPagamentoInicialAutomatico] = useState(true);

  // Sempre reflete o `tentativaVendaId` mais recente (atualizado a cada
  // render, nunca dispara re-render sozinho). `handleConfirmar` usa isto pra
  // saber, DEPOIS de esperar o servidor responder, se ainda está na MESMA
  // tentativa de venda que iniciou o pedido — ver o comentário dentro dele.
  const tentativaVendaIdRef = useRef(tentativaVendaId);
  // Mutar um ref FORA do render (aqui, num efeito) é o padrão normal —
  // mutar durante o render em si é proibido pela mesma regra de lint que
  // motivou o restante desta refatoração (react-hooks/refs).
  useEffect(() => {
    tentativaVendaIdRef.current = tentativaVendaId;
  }, [tentativaVendaId]);

  // Item 2b (envio duplicado de venda) — UMA chave por TENTATIVA de venda,
  // reusada em qualquer reenvio da MESMA tentativa (retry após erro, clique
  // duplo que escape do `disabled`, etc.), só troca quando `tentativaVendaId`
  // muda (nova tentativa: nova venda após sucesso, ou "Cancelar venda").
  // Enviada ao servidor em DadosPagamento.chaveIdempotencia ->
  // processarVenda/processarVendaComOSNoPDV, que devolvem a MESMA venda em
  // vez de criar outra se a chave já foi usada
  // (lib/dominio/pdv/idempotencia-venda.ts).
  const chaveIdempotencia = useMemo(
    () => crypto.randomUUID(),
    // tentativaVendaId não é lido dentro do useMemo de propósito: ele só
    // existe pra INVALIDAR o cache (gerar uma chave nova) quando a
    // tentativa de venda muda — é o gatilho, não um dado usado no cálculo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tentativaVendaId]
  );

  // As três sincronizações abaixo eram useEffect antes (React 18) — viraram
  // "ajuste de estado durante a renderização" (padrão oficial do React pra
  // "adjusting state when a prop changes": comparar contra o valor anterior
  // guardado em useState e, se mudou, chamar setState direto no corpo da
  // função, sem passar por useEffect). Motivo da troca: a versão do
  // React/Next deste projeto tem a regra de lint
  // `react-hooks/set-state-in-effect`, que proíbe setState síncrono dentro
  // de useEffect quando o efeito só existe pra sincronizar estado derivado
  // de outro estado/prop — exatamente o caso das três abaixo. Nenhuma regra
  // de cálculo/validação mudou, só ONDE o ajuste de estado acontece.

  // Valores "aplicados" (o que cada bloco já processou) precisam existir
  // ANTES do bloco (1), porque ele sincroniza os três de uma vez quando uma
  // nova tentativa começa — ver comentário dentro do bloco (1).
  const [tentativaAplicada, setTentativaAplicada] = useState(tentativaVendaId);
  const [totalAplicado, setTotalAplicado] = useState(total);
  const assinaturaFormasDisponiveis = `${formasPagamentoDisponiveis
    .map((item) => item.formaPagamento)
    .join(",")}|${configuracaoAtiva.permitirPagamentoMisto}|${formaPadrao}`;
  const [assinaturaFormasAplicada, setAssinaturaFormasAplicada] = useState(assinaturaFormasDisponiveis);

  // Trava LOCAL (variável comum, não estado) pra impedir os blocos (2) e (3)
  // de rodarem na MESMA renderização em que o bloco (1) já resetou tudo.
  // Bug real, achado ao vivo (reproduzido: "Cancelar venda" numa venda de
  // boleto, depois começar uma venda nova — a etapa Cliente continuava
  // travada achando que ainda tinha um boleto pendente): sincronizar
  // `totalAplicado`/`assinaturaFormasAplicada` via `setState` dentro do
  // bloco (1) NÃO é suficiente pra impedir os blocos (2)/(3) de disparar
  // nesta mesma passada — `setState` só atualiza o valor que a PRÓXIMA
  // renderização vai ler; a constante local `totalAplicado` (e `linhas`)
  // continua com o valor antigo até lá. Sem esta trava, o bloco (2) lia o
  // `linhas` ainda antigo (com o BOLETO) e sobrescrevia a linha fresca que
  // o bloco (1) acabou de criar.
  let jaResetouNestaRenderizacao = false;

  // 1) Reinício de estado no começo de cada TENTATIVA de venda — equivalente
  //    ao que antes rodava quando o modal abria.
  if (tentativaVendaId !== tentativaAplicada) {
    jaResetouNestaRenderizacao = true;
    setTentativaAplicada(tentativaVendaId);
    setTotalAplicado(total);
    setAssinaturaFormasAplicada(assinaturaFormasDisponiveis);
    setLinhas([novaLinhaPagamento(total)]);
    setValorRecebidoDinheiro(0);
    setProcessando(false);
    setVendaFinalizada(false);
    setVendaIdGerada(null);
    setTotalVendaFinalizada(0);
    setValoresPagamentosEmEdicao({});
    setValorRecebidoEmEdicao(null);
    setRecebidoTocado(false);
    setLinhaEmEdicaoId(null);
    setSeletorFormaAberto(false);
    setPagamentoInicialAutomatico(true);
  }

  // 2) Mantém a linha única sincronizada com o total do servidor — e o valor
  //    recebido em dinheiro default, se ainda não editado — enquanto o
  //    operador não mexeu em nada (ex.: desconto mudando o total).
  if (!jaResetouNestaRenderizacao && total !== totalAplicado) {
    setTotalAplicado(total);
    if (linhas.length === 1) {
      const linhaAtual = linhas[0];
      setLinhas([{ ...linhaAtual, valorBruto: total }]);
      if (linhaAtual.formaPagamento === "DINHEIRO" && linhaEmEdicaoId === null && !recebidoTocado) {
        setValorRecebidoDinheiro(total);
        setValorRecebidoEmEdicao(formatarDecimalPtBr(total));
      }
    }
  }

  // 3) Normaliza as linhas quando as formas de pagamento disponíveis mudam
  //    (configuração do tenant mudou, ou "permitir pagamento misto" foi
  //    desligado com mais de uma linha lançada).
  if (!jaResetouNestaRenderizacao && assinaturaFormasDisponiveis !== assinaturaFormasAplicada) {
    setAssinaturaFormasAplicada(assinaturaFormasDisponiveis);

    const formasAtivas = new Set(formasPagamentoDisponiveis.map((item) => item.formaPagamento));

    let proximo = linhas
      .filter((linha, index) => {
        if (index === 0) return true;
        return configuracaoAtiva.permitirPagamentoMisto;
      })
      .map((linha) => {
        const formaNormalizada = normalizarFormaPagamentoPdv(linha.formaPagamento);

        if (formasAtivas.has(formaNormalizada)) {
          return { ...linha, formaPagamento: formaNormalizada };
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

    setLinhas(distribuirValoresPagamentos(proximo, total));
  }

  const pagamentosCalculados = useMemo(() => {
    return linhas.map((linha) =>
      calcularPagamentoPdv(
        {
          formaPagamento: linha.formaPagamento,
          valorBruto: linha.valorBruto,
          parcelas: linha.parcelas,
          diasVencimento: linha.diasVencimento,
        },
        parametrosCalculo
      )
    );
  }, [linhas, parametrosCalculo]);

  const totalInformado = useMemo(
    () => pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorBruto), 0) / 100,
    [pagamentosCalculados]
  );

  const totalTaxas = useMemo(
    () => pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorTaxa), 0) / 100,
    [pagamentosCalculados]
  );

  const totalLiquido = useMemo(
    () => pagamentosCalculados.reduce((acc, item) => acc + paraCentavos(item.valorLiquido), 0) / 100,
    [pagamentosCalculados]
  );

  const totalDinheiro = useMemo(
    () =>
      pagamentosCalculados
        .filter((item) => item.formaPagamento === "DINHEIRO")
        .reduce((acc, item) => acc + paraCentavos(item.valorBruto), 0) / 100,
    [pagamentosCalculados]
  );

  const troco =
    totalDinheiro > 0
      ? paraMoeda(Math.max(0, subtrair(paraCentavos(valorRecebidoDinheiro), paraCentavos(totalDinheiro))))
      : 0;
  const saldoCentavos = subtrair(paraCentavos(total), paraCentavos(totalInformado));
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
      ? { label: "Falta pagar", valor: formatarMoeda(Math.max(0, saldoCentavos) / 100), cor: "text-kx-alerta-texto" }
      : estadoFechamento.tipo === "fechado" && totalDinheiro > 0 && troco > 0
        ? { label: "Troco", valor: formatarMoeda(troco), cor: "text-kx-sucesso-texto" }
        : estadoFechamento.tipo === "fechado"
          ? { label: "Saldo", valor: formatarMoeda(0), cor: "text-kx-texto" }
          : {
              label: "Ajuste",
              valor: saldoCentavos < 0 ? formatarMoeda(Math.abs(saldoCentavos) / 100) : "Corrigir",
              cor: "text-kx-erro-texto",
            };

  const podeConfirmar = total > 0 && estadoFechamento.podeConfirmar;

  const sincronizarPagamentoDinheiro = (valorRecebido: number) => {
    if (!Number.isFinite(valorRecebido)) return;
    setValoresPagamentosEmEdicao((estadoAtual) => {
      const proximo = { ...estadoAtual };
      for (const linha of linhas) {
        if (Object.prototype.hasOwnProperty.call(proximo, linha.id)) {
          proximo[linha.id] = formatarDecimalPtBr(linha.valorBruto);
        }
      }
      return proximo;
    });
  };

  // As DUAS únicas formas de alterar o valor recebido em dinheiro por ação
  // EXPLÍCITA do operador (digitação livre ou atalho de valor fixo) — ambas
  // marcam `recebidoTocado`, desligando o auto-sync do bloco (2) acima. O
  // componente de apresentação (EtapaPagamentoPdv) nunca chama
  // `setValorRecebidoDinheiro` diretamente por isso.
  const digitarValorRecebido = (texto: string) => {
    setRecebidoTocado(true);
    setValorRecebidoEmEdicao(texto);
    const valor = parseEntradaMonetaria(texto);
    setValorRecebidoDinheiro(valor);
    sincronizarPagamentoDinheiro(valor);
  };

  const aplicarAtalhoValorRecebido = (valor: number) => {
    setRecebidoTocado(true);
    setValorRecebidoDinheiro(valor);
    setValorRecebidoEmEdicao(formatarDecimalPtBr(valor));
    sincronizarPagamentoDinheiro(valor);
  };

  const atualizarLinha = (id: string, patch: Partial<LinhaPagamento>) => {
    setLinhas((estadoAtual) => {
      const patchNormalizado = {
        ...patch,
        ...(patch.formaPagamento ? { formaPagamento: normalizarFormaPagamentoPdv(patch.formaPagamento) } : {}),
      };

      const atualizado = estadoAtual.map((linha) => (linha.id === id ? { ...linha, ...patchNormalizado } : linha));

      if (atualizado.length <= 1) return atualizado;

      const primeiraLinhaId = atualizado[0]?.id;
      if (!primeiraLinhaId || id === primeiraLinhaId) return atualizado;

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

      if (atualizado.length <= 1) return atualizado;

      const primeiraLinhaId = atualizado[0]?.id;
      if (!primeiraLinhaId || id === primeiraLinhaId) return atualizado;

      return distribuirValoresPagamentos(atualizado, total);
    });

    if (linhas.length === 2) {
      const outraLinha = linhas.find((linha) => linha.id !== id);
      if (outraLinha) {
        const valorRestanteCentavos = Math.max(0, paraCentavos(total) - paraCentavos(Math.max(0, valorBruto)));
        setValoresPagamentosEmEdicao((estadoAtual) => ({
          ...estadoAtual,
          [outraLinha.id]: formatarDecimalPtBr(valorRestanteCentavos / 100),
        }));
      }
    }
  };

  const calcularValorRestante = (pagamentosAtuais: LinhaPagamento[], totalVenda: number) => {
    const totalInformadoAtual = pagamentosAtuais.reduce((acc, linha) => acc + paraCentavos(linha.valorBruto), 0) / 100;
    return Math.max(0, totalVenda - totalInformadoAtual);
  };

  const valorRestante = calcularValorRestante(linhas, total);

  const selecionarPagamento = (pagamentoId: string) => setLinhaEmEdicaoId(pagamentoId);

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

  const valorInformadoPorForma = (forma: FormaPagamentoPdv): number =>
    paraMoeda(somar(...linhas.filter((linha) => linha.formaPagamento === forma).map((linha) => paraCentavos(linha.valorBruto))));

  const linhaSelecionada = linhas.find((linha) => linha.id === linhaEmEdicaoId) ?? null;

  const pagamentosCalculadosPorLinha = useMemo<Record<string, PagamentoCalculado>>(() => {
    return linhas.reduce<Record<string, PagamentoCalculado>>((acc, linha, index) => {
      const calculado = pagamentosCalculados[index];
      if (calculado) acc[linha.id] = calculado;
      return acc;
    }, {});
  }, [linhas, pagamentosCalculados]);

  const substituirPagamentoUnico = (formaPagamento: FormaPagamentoPdv, diasPadrao: number) => {
    const linhaAtual = linhas[0];
    const linhaUnica: LinhaPagamento = {
      id: linhaAtual?.id ?? crypto.randomUUID(),
      formaPagamento,
      valorBruto: total,
      parcelas: 1,
      diasVencimento: diasPadrao,
    };

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
      const linhaAtualCobreTotal = linhaAtual ? paraCentavos(linhaAtual.valorBruto) === paraCentavos(total) : false;

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

  const aplicarFormaRapida = (formaPagamento: FormaPagamentoPdv) => adicionarNovoPagamento(formaPagamento);

  const abrirSeletorNovaForma = () => {
    if (formasPagamentoDisponiveis.length === 1) {
      adicionarNovoPagamento(formasPagamentoDisponiveis[0].formaPagamento);
      return;
    }
    setSeletorFormaAberto(true);
  };

  const handleConfirmar = async () => {
    if (!estadoFechamento.podeConfirmar) {
      toast.error(estadoFechamento.mensagem ?? "Ajuste os pagamentos para continuar.");
      return;
    }

    // Checagem proativa no cliente (o servidor tem a mesma trava, autoritativa
    // — ver processarVenda): evita a ida e volta e já navega pra etapa certa.
    if (!temClienteSelecionado && exigeClienteRealParaFinalizarVenda(linhas, ehPagamentoPrazo)) {
      toast.error(MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO);
      aoPrecisarDeCliente();
      return;
    }

    setProcessando(true);
    // Capturado ANTES do await: se o servidor demorar (visto ao vivo contra
    // o Neon de TESTE sob contenção) e o operador já tiver cancelado/
    // reiniciado a venda ("Cancelar venda", "Nova Venda") antes da resposta
    // chegar, `tentativaVendaIdRef.current` já vai ter mudado quando o
    // `await` abaixo resolver — sinal de que esta resposta pertence a uma
    // tentativa que não existe mais na tela. Sem essa checagem, a venda
    // AINDA é processada corretamente no servidor (nenhum problema aí), mas
    // o modal de "Venda concluída" apareceria por cima de uma venda
    // diferente que o operador já começou a montar — bug real, reproduzido
    // ao vivo rodando os 5 fluxos em sequência.
    const tentativaDoPedido = tentativaVendaId;

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
      chaveIdempotencia,
    };

    try {
      const resultado = await aoConfirmar(dados);

      if (tentativaVendaIdRef.current !== tentativaDoPedido) {
        // O operador já começou outra tentativa (ou cancelou) enquanto isto
        // estava em voo — a venda foi processada (ou não) no servidor
        // normalmente, mas não há mais "esta tela" pra mostrar o resultado.
        // O comprovante ainda existe e aparece no Resumo do Dia/Vendas.
        return;
      }

      if (!resultado.sucesso) {
        if (resultado.mensagem) toast.error(resultado.mensagem);
        return;
      }

      setTotalVendaFinalizada(totalInformado);
      setVendaIdGerada(resultado.vendaId || null);
      setVendaFinalizada(true);
    } finally {
      if (tentativaVendaIdRef.current === tentativaDoPedido) {
        setProcessando(false);
      }
    }
  };

  // Detalhe da forma (taxa + quando o dinheiro cai), exposto como função já
  // fechada sobre parametrosCalculo/configuracaoAtiva pra o componente de
  // apresentação não precisar conhecer esses dois objetos.
  const detalheFormaRapida = (forma: FormaPagamentoPdv): string => {
    if (forma === "PIX") return "Sem taxa · cai na hora";
    if (forma === "DINHEIRO") return "Sem taxa · na gaveta";
    if (forma === "CARTAO_DEBITO") return `Taxa ${parametrosCalculo.taxaCartaoDebitoPercentual.toFixed(2)}% · direto na conta`;
    if (forma === "CARTAO_CREDITO") return `Taxa a partir de ${parametrosCalculo.taxaCartaoCreditoPorParcela[1].toFixed(2)}% · prazo da adquirente`;
    if (forma === "BOLETO") return `Sem taxa · vence em ${configuracaoAtiva.prazoPadraoBoletoDias} dias`;
    if (forma === "CREDIARIO") return `Sem taxa · vence em ${configuracaoAtiva.prazoPadraoCrediarioDias} dias`;
    return "";
  };

  // "O que o sistema vai registrar": estoque, caixa, taxa, repasse esperado
  // e parcelas — derivado só do que já está calculado acima, nenhuma lógica
  // de negócio nova.
  const itensRegistro = useMemo(() => {
    const itens: { texto: string; tom: "neutro" | "sucesso" | "alerta" }[] = [];

    itens.push({ texto: "Baixa no estoque dos itens do carrinho (produtos vinculados a esta venda).", tom: "neutro" });

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
        itens.push({ texto: `Parcelado em ${formatarRotuloParcelas(linha.valorBruto, linha.parcelas)}.`, tom: "neutro" });
      }

      if ((linha.formaPagamento === "BOLETO" || linha.formaPagamento === "CREDIARIO") && calculado.dataVencimento) {
        itens.push({ texto: `Vencimento previsto: ${calculado.dataVencimento.toLocaleDateString("pt-BR")}.`, tom: "neutro" });
      }
    }

    return itens;
  }, [linhas, pagamentosCalculadosPorLinha, totalDinheiro]);

  const urlRecibo = vendaIdGerada ? `/recibo/${vendaIdGerada}` : null;

  return {
    configuracaoAtiva,
    parametrosCalculo,
    formasPagamentoDisponiveis,
    linhas,
    pagamentosCalculadosPorLinha,
    valorRecebidoDinheiro,
    valoresPagamentosEmEdicao,
    valorRecebidoEmEdicao,
    linhaEmEdicaoId,
    linhaSelecionada,
    seletorFormaAberto,
    setSeletorFormaAberto,
    totalDinheiro,
    troco,
    totalInformado,
    totalTaxas,
    totalLiquido,
    totalAntesDesconto,
    percentualTaxaEstimado,
    estadoFechamento,
    resumoSaldo,
    podeConfirmar,
    processando,
    vendaFinalizada,
    vendaIdGerada,
    totalVendaFinalizada,
    urlRecibo,
    itensRegistro,
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
    handleConfirmar,
  };
}

export type ResultadoUsePagamentoPdv = ReturnType<typeof usePagamentoPdv>;
