/**
 * Calculo de precificacao e desconto da venda no PDV — dominio puro.
 *
 * O cliente (navegador) nunca e uma fonte confiavel de preco, custo ou total
 * (AUDIT_REPORT F-04, F-33): o carrinho no PDV permite editar o preco
 * unitario livremente e o total da venda era antes calculado no navegador e
 * apenas conferido contra a soma dos pagamentos. Este modulo recebe os
 * precos/custos JA CARREGADOS DO BANCO (responsabilidade de quem chama) e o
 * desconto PEDIDO pelo operador, e devolve o total real da venda em
 * centavos — a unica fonte de verdade monetaria.
 *
 * Nao importa Prisma, React nem Next: quem chama faz as consultas e passa os
 * fatos ja resolvidos.
 */

import { paraCentavos } from "@/lib/pdv/pagamentos";

export type TipoDescontoPdv = "PERCENTUAL" | "VALOR";

export type DescontoPdv = {
  tipo: TipoDescontoPdv;
  valor: number;
};

export type ProdutoParaCalculoVenda = {
  id: string;
  nome: string;
  precoVenda: number;
  custo: number;
};

export type ItemEntradaCalculoVenda = {
  produto: ProdutoParaCalculoVenda;
  quantidade: number;
  /** Desconto pedido apenas para este item (opcional, alternativo ao desconto total). */
  desconto?: DescontoPdv | null;
};

export type ConfiguracaoDescontoPdv = {
  permitirDescontoPDV: boolean;
  descontoMaximoPDVPercentual: number;
};

export type ItemVendaCalculado = {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  custoUnitarioCentavos: number;
  subtotalBrutoCentavos: number;
  descontoCentavos: number;
  subtotalLiquidoCentavos: number;
};

export type ResultadoCalculoVenda = {
  itens: ItemVendaCalculado[];
  subtotalBrutoCentavos: number;
  descontoCentavos: number;
  totalCentavos: number;
  percentualDescontoEfetivo: number;
  descontoAcimaDoLimite: boolean;
};

export class ErroCalculoVenda extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroCalculoVenda";
  }
}

function calcularDescontoCentavos(
  desconto: DescontoPdv | null | undefined,
  baseCentavos: number
): number {
  if (!desconto || !Number.isFinite(desconto.valor) || desconto.valor <= 0) {
    return 0;
  }

  if (desconto.tipo === "PERCENTUAL") {
    if (desconto.valor > 100) {
      throw new ErroCalculoVenda("Desconto percentual não pode ser maior que 100%.");
    }
    return Math.min(baseCentavos, Math.round((baseCentavos * desconto.valor) / 100));
  }

  const valorCentavos = paraCentavos(desconto.valor);
  return Math.min(baseCentavos, Math.max(0, valorCentavos));
}

/**
 * Calcula o total real da venda em centavos a partir dos produtos (com preco
 * e custo vindos do banco) e do desconto pedido — por item, total, ou ambos.
 *
 * Lanca `ErroCalculoVenda` se o carrinho estiver vazio ou se algum desconto
 * pedido for invalido (ex.: percentual acima de 100%). NAO valida o limite
 * de desconto contra permissao — isso depende do papel do usuario, que e
 * responsabilidade de quem chama (ver `descontoAcimaDoLimite` no retorno).
 */
export function calcularVendaPdv(
  itens: ItemEntradaCalculoVenda[],
  descontoTotal: DescontoPdv | null | undefined,
  configuracao: ConfiguracaoDescontoPdv
): ResultadoCalculoVenda {
  if (itens.length === 0) {
    throw new ErroCalculoVenda("Carrinho vazio para cálculo da venda.");
  }

  const existeDescontoPedido =
    itens.some((item) => item.desconto && item.desconto.valor > 0) ||
    Boolean(descontoTotal && descontoTotal.valor > 0);

  if (existeDescontoPedido && !configuracao.permitirDescontoPDV) {
    throw new ErroCalculoVenda("Desconto no PDV está desabilitado nas configurações.");
  }

  const itensCalculados: ItemVendaCalculado[] = itens.map((entrada) => {
    if (entrada.quantidade <= 0) {
      throw new ErroCalculoVenda(`Quantidade inválida para o produto ${entrada.produto.nome}.`);
    }

    const precoUnitarioCentavos = paraCentavos(entrada.produto.precoVenda);
    const custoUnitarioCentavos = paraCentavos(entrada.produto.custo);
    const subtotalBrutoCentavos = precoUnitarioCentavos * entrada.quantidade;
    const descontoItemCentavos = calcularDescontoCentavos(entrada.desconto, subtotalBrutoCentavos);

    return {
      produtoId: entrada.produto.id,
      nome: entrada.produto.nome,
      quantidade: entrada.quantidade,
      precoUnitarioCentavos,
      custoUnitarioCentavos,
      subtotalBrutoCentavos,
      descontoCentavos: descontoItemCentavos,
      subtotalLiquidoCentavos: subtotalBrutoCentavos - descontoItemCentavos,
    };
  });

  const subtotalBrutoCentavos = itensCalculados.reduce((acc, item) => acc + item.subtotalBrutoCentavos, 0);
  const descontoItensCentavos = itensCalculados.reduce((acc, item) => acc + item.descontoCentavos, 0);
  const baseParaDescontoTotal = subtotalBrutoCentavos - descontoItensCentavos;
  const descontoTotalCentavos = calcularDescontoCentavos(descontoTotal, baseParaDescontoTotal);

  const descontoCentavos = descontoItensCentavos + descontoTotalCentavos;
  const totalCentavos = subtotalBrutoCentavos - descontoCentavos;
  const percentualDescontoEfetivo =
    subtotalBrutoCentavos > 0 ? (descontoCentavos / subtotalBrutoCentavos) * 100 : 0;

  // Margem de ponto flutuante: so considera "acima do limite" alem de um
  // centesimo percentual de folga, para nao acusar excesso por erro de
  // arredondamento quando o operador pede exatamente o limite configurado.
  const descontoAcimaDoLimite = percentualDescontoEfetivo > configuracao.descontoMaximoPDVPercentual + 0.01;

  return {
    itens: itensCalculados,
    subtotalBrutoCentavos,
    descontoCentavos,
    totalCentavos,
    percentualDescontoEfetivo,
    descontoAcimaDoLimite,
  };
}
