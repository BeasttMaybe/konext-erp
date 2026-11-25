/**
 * Apuracao de custo, lucro e caixa das notas da Prefeitura.
 *
 * Puro de proposito: so aritmetica, sem rede nem banco. Trabalha SEMPRE em
 * centavos inteiros (como o resto do financeiro, ver lib/dinheiro.ts) — somar
 * dinheiro em float e como arredondar: funciona ate o dia em que nao funciona.
 *
 * O que o dono quer enxergar e simples de dizer e facil de errar:
 *   receita (o que vai receber) − custo (o que o produto custou) = lucro bruto;
 *   lucro bruto − impostos = lucro liquido;
 *   e "quanto de caixa a prefeitura consome" = o custo que ja saiu do bolso e
 *   ainda nao voltou (nota nao recebida), e por quanto tempo fica parado.
 */

export type ItemApuracao = {
  /** Valor de venda da linha, em centavos. */
  valorVendaCentavos: number;
  /** Custo da linha informado pelo dono, em centavos. NULO = ainda nao informado. */
  custoCentavos: number | null;
};

export type NotaApuracao = {
  /** Valor total de venda da nota, em centavos. */
  receitaCentavos: number;
  modoCusto: "ITENS" | "TOTAL";
  /** Usado so quando modoCusto = TOTAL. Centavos. NULO = nao informado. */
  custoTotalInformadoCentavos: number | null;
  /** Impostos destacados na nota, centavos. NULO = desconhecido. */
  impostosCentavos: number | null;
  /** Frete pago na venda, em centavos. Entra no custo (abate o lucro bruto). */
  freteCentavos: number;
  /** Aliquota de imposto (pontos percentuais, ex.: 4). Quando informada, tem
   *  prioridade sobre `impostosCentavos` no calculo do lucro liquido. */
  impostoPercentual: number | null;
  itens: ItemApuracao[];
  /** A nota ja foi recebida (todas as parcelas baixadas)? */
  recebida: boolean;
  dataEmissao: Date | null;
  dataVencimento: Date | null;
};

export type CustoDaNota = {
  custoCentavos: number;
  /** Ha base de custo (algum item, ou o total no modo TOTAL)? */
  temBase: boolean;
  /** O custo esta completo (todos os itens com custo, ou total informado)? */
  completo: boolean;
  /** Quantos itens ainda estao sem custo (so no modo ITENS). */
  itensSemCusto: number;
};

export function custoDaNota(nota: NotaApuracao): CustoDaNota {
  if (nota.modoCusto === "TOTAL") {
    const informado = nota.custoTotalInformadoCentavos;
    return {
      custoCentavos: informado ?? 0,
      temBase: informado !== null,
      completo: informado !== null,
      itensSemCusto: 0,
    };
  }

  const itensSemCusto = nota.itens.filter((i) => i.custoCentavos === null).length;
  const custoCentavos = nota.itens.reduce((soma, i) => soma + (i.custoCentavos ?? 0), 0);
  return {
    custoCentavos,
    temBase: nota.itens.length > 0,
    completo: nota.itens.length > 0 && itensSemCusto === 0,
    itensSemCusto,
  };
}

const DIA_EM_MS = 24 * 60 * 60 * 1000;

/** Dias entre emissao e vencimento (prazo concedido). NULO quando falta data. */
export function diasDePrazo(nota: NotaApuracao): number | null {
  if (!nota.dataEmissao || !nota.dataVencimento) return null;
  const dias = Math.round((nota.dataVencimento.getTime() - nota.dataEmissao.getTime()) / DIA_EM_MS);
  return dias >= 0 ? dias : 0;
}

export type ApuracaoNota = {
  receitaCentavos: number;
  custoCentavos: number;
  custoCompleto: boolean;
  temBaseDeCusto: boolean;
  itensSemCusto: number;
  /** Frete incluido no custo, em centavos. */
  freteCentavos: number;
  /** receita − (custo dos produtos + frete). So faz sentido quando custoCompleto. */
  lucroBrutoCentavos: number;
  /** Margem bruta em pontos percentuais (0–100), ou NULO se receita = 0. */
  margemBrutaPct: number | null;
  impostosCentavos: number;
  impostosConhecidos: boolean;
  /** lucro bruto − impostos. */
  lucroLiquidoCentavos: number;
  diasPrazo: number | null;
  /** Caixa parado: o custo que ja saiu e ainda nao voltou (nota nao recebida). */
  caixaConsumidoCentavos: number;
};

// Imposto em centavos: a aliquota (%) tem prioridade; sem ela, cai no valor
// que o Bling trouxe; sem nada, zero.
function impostoDaNota(nota: NotaApuracao): { centavos: number; conhecido: boolean } {
  if (nota.impostoPercentual !== null) {
    return { centavos: Math.round((nota.receitaCentavos * nota.impostoPercentual) / 100), conhecido: true };
  }
  if (nota.impostosCentavos !== null) return { centavos: nota.impostosCentavos, conhecido: true };
  return { centavos: 0, conhecido: false };
}

export function apurarNota(nota: NotaApuracao): ApuracaoNota {
  const produtos = custoDaNota(nota);
  const frete = nota.freteCentavos ?? 0;
  // Frete entra no custo: abate o lucro bruto, como o dono pediu.
  const custoTotal = produtos.custoCentavos + frete;
  const lucroBruto = nota.receitaCentavos - custoTotal;
  const imposto = impostoDaNota(nota);

  return {
    receitaCentavos: nota.receitaCentavos,
    custoCentavos: custoTotal,
    custoCompleto: produtos.completo,
    temBaseDeCusto: produtos.temBase,
    itensSemCusto: produtos.itensSemCusto,
    freteCentavos: frete,
    lucroBrutoCentavos: lucroBruto,
    margemBrutaPct: nota.receitaCentavos > 0 ? (lucroBruto / nota.receitaCentavos) * 100 : null,
    impostosCentavos: imposto.centavos,
    impostosConhecidos: imposto.conhecido,
    lucroLiquidoCentavos: lucroBruto - imposto.centavos,
    diasPrazo: diasDePrazo(nota),
    // So consome caixa o que ainda nao foi recebido. Nota ja recebida devolveu
    // o dinheiro; o custo dela nao esta mais "parado" na prefeitura.
    caixaConsumidoCentavos: nota.recebida ? 0 : custoTotal,
  };
}

export type ApuracaoPeriodo = {
  notas: number;
  receitaTotalCentavos: number;
  /** Custo ja lancado (soma dos custos conhecidos). */
  custoLancadoCentavos: number;
  /** Quantas notas ainda tem custo pendente (sem base ou incompleto). */
  notasComCustoPendente: number;
  /** Receita das notas com custo completo (base de uma margem honesta). */
  receitaApuradaCentavos: number;
  /** Lucro bruto das notas com custo completo. */
  lucroBrutoApuradoCentavos: number;
  /** Margem bruta sobre a receita apurada (0–100), ou NULO. */
  margemBrutaPct: number | null;
  lucroLiquidoApuradoCentavos: number;
  /** A receber em aberto (notas nao recebidas). */
  aReceberAbertoCentavos: number;
  /** Caixa consumido: custo conhecido das notas nao recebidas. */
  caixaConsumidoCentavos: number;
  /** Prazo medio de recebimento, ponderado pela receita. NULO se sem dados. */
  prazoMedioDias: number | null;
};

export function apurarPeriodo(notas: NotaApuracao[]): ApuracaoPeriodo {
  let receitaTotal = 0;
  let custoLancado = 0;
  let notasComCustoPendente = 0;
  let receitaApurada = 0;
  let lucroBrutoApurado = 0;
  let lucroLiquidoApurado = 0;
  let aReceberAberto = 0;
  let caixaConsumido = 0;

  let somaPrazoPonderado = 0;
  let receitaComPrazo = 0;

  for (const nota of notas) {
    const a = apurarNota(nota);

    receitaTotal += a.receitaCentavos;
    custoLancado += a.custoCentavos;
    if (!a.custoCompleto) notasComCustoPendente += 1;

    if (a.custoCompleto) {
      receitaApurada += a.receitaCentavos;
      lucroBrutoApurado += a.lucroBrutoCentavos;
      lucroLiquidoApurado += a.lucroLiquidoCentavos;
    }

    if (!nota.recebida) {
      aReceberAberto += a.receitaCentavos;
      caixaConsumido += a.caixaConsumidoCentavos;
    }

    if (a.diasPrazo !== null && a.receitaCentavos > 0) {
      somaPrazoPonderado += a.diasPrazo * a.receitaCentavos;
      receitaComPrazo += a.receitaCentavos;
    }
  }

  return {
    notas: notas.length,
    receitaTotalCentavos: receitaTotal,
    custoLancadoCentavos: custoLancado,
    notasComCustoPendente,
    receitaApuradaCentavos: receitaApurada,
    lucroBrutoApuradoCentavos: lucroBrutoApurado,
    margemBrutaPct: receitaApurada > 0 ? (lucroBrutoApurado / receitaApurada) * 100 : null,
    lucroLiquidoApuradoCentavos: lucroLiquidoApurado,
    aReceberAbertoCentavos: aReceberAberto,
    caixaConsumidoCentavos: caixaConsumido,
    prazoMedioDias: receitaComPrazo > 0 ? Math.round(somaPrazoPonderado / receitaComPrazo) : null,
  };
}
