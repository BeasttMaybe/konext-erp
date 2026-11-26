/**
 * Posição de caixa das vendas para a prefeitura, a partir das contas a receber.
 *
 * Puro: só aritmética sobre as contas que a action já carregou. Responde o que
 * o dono pediu — quanto ainda há a receber da prefeitura, quanto já venceu
 * (atrasado), quanto já entrou e em quantos dias, em média, a prefeitura paga.
 *
 * Trabalha em centavos inteiros, como o resto do financeiro.
 */

export type ContaCaixa = {
  valorCentavos: number;
  /** status RECEBIDO. */
  recebida: boolean;
  /** status ESTORNADO — não conta em nenhum total. */
  estornada: boolean;
  vencimento: Date;
  /** Data em que o dinheiro entrou (só nas recebidas). */
  recebimento: Date | null;
};

export type ApuracaoCaixa = {
  /** Em aberto (não recebida, não estornada). */
  aReceberAbertoCentavos: number;
  /** Parte do aberto que já passou do vencimento. */
  vencidoCentavos: number;
  /** Parte do aberto que ainda não venceu. */
  aVencerCentavos: number;
  /** Já recebido. */
  recebidoCentavos: number;
  qtdAberto: number;
  qtdVencido: number;
  /** Média de dias entre vencimento e recebimento das contas já pagas
   *  (positivo = pagou depois do vencimento). NULO sem base. */
  prazoMedioDias: number | null;
};

const DIA_EM_MS = 24 * 60 * 60 * 1000;

/**
 * Soma dos recebimentos por mês (do recebimento), dos últimos `meses` meses
 * até o mês de `hoje`, preenchendo com zero os meses sem entrada. Retorna em
 * ordem cronológica, cada item com o mês "YYYY-MM" e o valor em centavos.
 */
export function serieRecebimentosPorMes(contas: ContaCaixa[], hoje: Date, meses = 12): Array<{ mes: string; valorCentavos: number }> {
  const chave = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  // Meses do intervalo, do mais antigo ao atual.
  const ordem: string[] = [];
  const base = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  for (let i = meses - 1; i >= 0; i -= 1) {
    ordem.push(chave(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1))));
  }
  const dentro = new Set(ordem);
  const soma = new Map<string, number>(ordem.map((m) => [m, 0]));

  for (const c of contas) {
    if (c.estornada || !c.recebida || !c.recebimento) continue;
    const m = chave(c.recebimento);
    if (dentro.has(m)) soma.set(m, (soma.get(m) ?? 0) + c.valorCentavos);
  }

  return ordem.map((mes) => ({ mes, valorCentavos: soma.get(mes) ?? 0 }));
}

export function apurarCaixa(contas: ContaCaixa[], hoje: Date): ApuracaoCaixa {
  let aReceber = 0;
  let vencido = 0;
  let aVencer = 0;
  let recebido = 0;
  let qtdAberto = 0;
  let qtdVencido = 0;

  let somaDiasPrazo = 0;
  let qtdComPrazo = 0;

  for (const c of contas) {
    if (c.estornada) continue;

    if (c.recebida) {
      recebido += c.valorCentavos;
      if (c.recebimento) {
        somaDiasPrazo += Math.round((c.recebimento.getTime() - c.vencimento.getTime()) / DIA_EM_MS);
        qtdComPrazo += 1;
      }
      continue;
    }

    // Em aberto.
    aReceber += c.valorCentavos;
    qtdAberto += 1;
    if (c.vencimento.getTime() < hoje.getTime()) {
      vencido += c.valorCentavos;
      qtdVencido += 1;
    } else {
      aVencer += c.valorCentavos;
    }
  }

  return {
    aReceberAbertoCentavos: aReceber,
    vencidoCentavos: vencido,
    aVencerCentavos: aVencer,
    recebidoCentavos: recebido,
    qtdAberto,
    qtdVencido,
    prazoMedioDias: qtdComPrazo > 0 ? Math.round(somaDiasPrazo / qtdComPrazo) : null,
  };
}
