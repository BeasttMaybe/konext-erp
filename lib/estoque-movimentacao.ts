import { paraDecimal } from "@/lib/dinheiro";
import {
  efeitoNoSaldo,
  tipoDaOrigem,
  validarMovimentacao,
  type OrigemMovimentacao,
  type TipoMovimentacao,
} from "@/lib/dominio/estoque/movimentacao";

/**
 * Gravação do livro de movimentações de estoque.
 *
 * Mesmo desenho de `lib/auditoria.ts`: recebe o client (ou a transação) de
 * quem chama, em vez de abrir um por conta. Assim o movimento é gravado na
 * MESMA transação que mexeu no saldo — e isso não é detalhe de estilo: se o
 * movimento pudesse falhar sozinho, o livro divergiria do saldo e o sistema
 * voltaria a não saber como chegou no número que mostra.
 *
 * Ao contrário da auditoria, aqui NÃO existe modo best-effort. Uma falha ao
 * gravar o movimento derruba a transação inteira, levando o saldo com ela.
 * Saldo que muda sem registro é exatamente o problema que este livro existe
 * para acabar.
 */

type MovimentacaoDelegate = {
  create?: (args: unknown) => Promise<{ id: string }>;
  createMany?: (args: unknown) => Promise<{ count: number }>;
};

type ProdutoDelegate = {
  findUnique?: (args: unknown) => Promise<{ quantidadeEstoque: number } | null>;
};

type ClienteEstoque = unknown;

function obterDelegateMovimentacao(client: ClienteEstoque): MovimentacaoDelegate {
  const prismaClient = client as {
    movimentacaoEstoque?: MovimentacaoDelegate;
    MovimentacaoEstoque?: MovimentacaoDelegate;
  };
  const delegate = prismaClient.movimentacaoEstoque ?? prismaClient.MovimentacaoEstoque;

  if (!delegate?.create) {
    throw new Error("Delegate Prisma de MovimentacaoEstoque nao disponivel.");
  }

  return delegate;
}

function obterDelegateProduto(client: ClienteEstoque): ProdutoDelegate {
  const prismaClient = client as { produto?: ProdutoDelegate; Produto?: ProdutoDelegate };
  const delegate = prismaClient.produto ?? prismaClient.Produto;

  if (!delegate?.findUnique) {
    throw new Error("Delegate Prisma de Produto nao disponivel.");
  }

  return delegate;
}

export type EntradaMovimentacao = {
  produtoId: string;
  origem: OrigemMovimentacao;
  /** Sempre positiva. O sinal vem da origem. */
  quantidade: number;
  /**
   * Saldo DEPOIS da escrita, lido do próprio `update`/`findUnique` na mesma
   * transação. É o número de verdade; o anterior é derivado dele.
   */
  saldoPosterior?: number | null;
  custoUnitario?: number | string | null;
  vendaId?: string | null;
  /** Nota de compra que originou a entrada, quando a origem for COMPRA_NOTA. */
  notaDeCompraId?: string | null;
  observacao?: string | null;
  registradoPorId?: string | null;
  /** Só para AJUSTE_MANUAL e INVENTARIO, onde a origem não decide o sentido. */
  tipo?: TipoMovimentacao;
};

/**
 * Registra um movimento. Chame SEMPRE dentro da mesma transação que alterou
 * `Produto.quantidadeEstoque`, e depois da alteração — o saldo posterior vem
 * do resultado dela.
 */
export async function registrarMovimentacaoEstoque(
  client: ClienteEstoque,
  entrada: EntradaMovimentacao
): Promise<{ id: string }> {
  const tipo = entrada.tipo ?? tipoDaOrigem(entrada.origem);

  const saldoPosterior =
    typeof entrada.saldoPosterior === "number" ? entrada.saldoPosterior : null;

  // O anterior é derivado do posterior, não lido de novo: ler duas vezes
  // abriria espaço pra outra escrita entrar no meio e gravar um par que nunca
  // existiu junto.
  const saldoAnterior =
    saldoPosterior === null ? null : saldoPosterior - efeitoNoSaldo(tipo, entrada.quantidade);

  validarMovimentacao({ quantidade: entrada.quantidade, saldoAnterior, tipo });

  const delegate = obterDelegateMovimentacao(client);

  const registro = await delegate.create!({
    data: {
      produtoId: entrada.produtoId,
      tipo,
      origem: entrada.origem,
      quantidade: entrada.quantidade,
      saldoAnterior,
      saldoPosterior,
      custoUnitario: normalizarCusto(entrada.custoUnitario),
      vendaId: entrada.vendaId ?? null,
      notaDeCompraId: entrada.notaDeCompraId ?? null,
      observacao: entrada.observacao ?? null,
      registradoPorId: entrada.registradoPorId ?? null,
    },
  });

  return { id: String(registro.id) };
}

/** Lê o saldo atual do produto na mesma transação. */
export async function lerSaldoAtual(
  client: ClienteEstoque,
  produtoId: string
): Promise<number | null> {
  const produto = await obterDelegateProduto(client).findUnique!({
    where: { id: produtoId },
    select: { quantidadeEstoque: true },
  });

  return produto ? produto.quantidadeEstoque : null;
}

/**
 * Custo em string decimal, que é o formato que o Prisma grava em
 * `Decimal(12,2)` sem passar por ponto flutuante (ver lib/dinheiro.ts).
 */
function normalizarCusto(valor: number | string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === "string") return valor;

  try {
    return paraDecimal(Math.round(valor * 100));
  } catch {
    return null;
  }
}
