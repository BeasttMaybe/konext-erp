/**
 * Regras do livro de movimentações de estoque (Fase 4).
 *
 * O livro existe porque `Produto.quantidadeEstoque` era um número mutado em
 * quatro lugares sem registrar nada: o sistema sabia quanto tinha agora e nada
 * sobre como chegou ali. Relatório de estoque sem livro é chute.
 *
 * Duas decisões que este módulo carrega, e que todo chamador herda:
 *
 * 1. `quantidade` é SEMPRE positiva. O sinal vem de `tipo`. Guardar negativo
 *    em saída faria toda soma do sistema precisar lembrar da convenção, e a
 *    primeira que esquecesse somaria saída como entrada.
 * 2. O saldo é gravado na linha (antes e depois), mesmo sendo derivável. É o
 *    que permite conferir a continuidade do livro e flagrar divergência entre
 *    ele e `quantidadeEstoque` — ou seja, detectar que alguém voltou a mexer
 *    no saldo sem registrar movimento.
 */

/** Espelha `TipoMovimentacaoEstoque` do schema. */
export type TipoMovimentacao = "ENTRADA" | "SAIDA" | "AJUSTE";

/** Espelha `OrigemMovimentacaoEstoque` do schema. */
export type OrigemMovimentacao =
  | "VENDA_PDV"
  | "PEDIDO_VENDA"
  | "ESTORNO_VENDA"
  | "CADASTRO"
  | "AJUSTE_MANUAL"
  | "COMPRA_XML"
  | "INVENTARIO"
  | "HISTORICO_RECONSTRUIDO";

/** O tipo que cada origem produz. Uma origem nunca gera tipos diferentes. */
const TIPO_POR_ORIGEM: Readonly<Record<OrigemMovimentacao, TipoMovimentacao>> = {
  VENDA_PDV: "SAIDA",
  PEDIDO_VENDA: "SAIDA",
  ESTORNO_VENDA: "ENTRADA",
  CADASTRO: "ENTRADA",
  COMPRA_XML: "ENTRADA",
  // Ajuste e inventário podem subir ou descer o saldo; quem chama informa.
  AJUSTE_MANUAL: "AJUSTE",
  INVENTARIO: "AJUSTE",
  HISTORICO_RECONSTRUIDO: "SAIDA",
};

export function tipoDaOrigem(origem: OrigemMovimentacao): TipoMovimentacao {
  return TIPO_POR_ORIGEM[origem];
}

/** Quanto o movimento soma ao saldo: +q para entrada, −q para saída. */
export function efeitoNoSaldo(tipo: TipoMovimentacao, quantidade: number): number {
  if (tipo === "SAIDA") return -quantidade;
  return quantidade;
}

export class ErroMovimentacaoEstoque extends Error {}

/**
 * Valida um movimento antes de gravar. Lança em vez de devolver `false` porque
 * um movimento inválido não é um caso de uso: é bug de quem chamou, e engolir
 * isso silenciosamente deixaria o livro divergir do saldo sem aviso — o
 * problema exato que o livro existe para impedir.
 */
export function validarMovimentacao(entrada: {
  quantidade: number;
  saldoAnterior?: number | null;
  tipo: TipoMovimentacao;
}): void {
  const { quantidade, saldoAnterior, tipo } = entrada;

  if (!Number.isInteger(quantidade)) {
    throw new ErroMovimentacaoEstoque(
      `Quantidade de movimentação precisa ser inteira; recebi ${quantidade}.`
    );
  }

  if (quantidade <= 0) {
    throw new ErroMovimentacaoEstoque(
      "Quantidade de movimentação é sempre positiva — o sinal vem do tipo (ENTRADA/SAIDA)."
    );
  }

  if (tipo === "SAIDA" && typeof saldoAnterior === "number" && quantidade > saldoAnterior) {
    throw new ErroMovimentacaoEstoque(
      `Saída de ${quantidade} maior que o saldo de ${saldoAnterior}. O estoque ficaria negativo.`
    );
  }
}

/** Saldo depois do movimento, já validado. */
export function saldoDepois(
  saldoAnterior: number,
  tipo: TipoMovimentacao,
  quantidade: number
): number {
  validarMovimentacao({ quantidade, saldoAnterior, tipo });
  return saldoAnterior + efeitoNoSaldo(tipo, quantidade);
}

/**
 * Confere a continuidade de um trecho do livro: o `saldoPosterior` de cada
 * linha tem que ser o `saldoAnterior` da seguinte, e o efeito de cada
 * movimento tem que explicar a diferença.
 *
 * Serve ao relatório de conferência: se o livro não fecha, alguém mexeu no
 * saldo sem registrar — e é melhor a tela dizer isso do que mostrar um número
 * errado com confiança.
 */
export function conferirContinuidade(
  linhas: ReadonlyArray<{
    tipo: TipoMovimentacao;
    quantidade: number;
    saldoAnterior: number | null;
    saldoPosterior: number | null;
  }>
): { fecha: boolean; primeiraDivergencia: number | null } {
  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];

    // Linha do backfill não tem saldo: não dá pra conferir, e não é erro.
    if (linha.saldoAnterior === null || linha.saldoPosterior === null) continue;

    const esperado = linha.saldoAnterior + efeitoNoSaldo(linha.tipo, linha.quantidade);
    if (esperado !== linha.saldoPosterior) {
      return { fecha: false, primeiraDivergencia: i };
    }

    const seguinte = linhas[i + 1];
    if (seguinte && seguinte.saldoAnterior !== null && seguinte.saldoAnterior !== linha.saldoPosterior) {
      return { fecha: false, primeiraDivergencia: i + 1 };
    }
  }

  return { fecha: true, primeiraDivergencia: null };
}
