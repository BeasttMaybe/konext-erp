/** Meta de faturamento diário em Reais. */
export const META_DIARIA_REAIS = 300;

export interface ItemFormaFechamento {
  forma: string;
  rotulo: string;
  valor: number;
}

export interface DadosFechamentoCaixa {
  /** Receita do PDV (soma de Venda.valorTotal de hoje). */
  faturamentoPdv: number;
  /** Receita de OS (ContaReceber RECEBIDO + origem ORDEM_SERVICO de hoje). */
  faturamentoOs: number;
  /** Faturamento total do dia (PDV + OS). */
  faturamentoTotal: number;
  /** Custo de mercadoria do PDV: soma de (custoUnitario * quantidade) nos itens de vendas de hoje. */
  custoPdv: number;
  /** Custo de peças das OS: soma de custoPeca dos itens de OS entregues hoje. */
  custoOs: number;
  /** Custo total do dia (PDV + OS). */
  custoTotal: number;
  /** Lucro Bruto = faturamentoTotal - custoTotal. */
  lucroBruto: number;
  /** Receita do dia agrupada por forma de pagamento. */
  porForma: ItemFormaFechamento[];
}
