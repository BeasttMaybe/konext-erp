export type StatusConta = 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO';
export type TipoCliente = 'PUBLICO' | 'B2B' | 'B2C';

export interface TransacaoFinanceira {
  id: string;
  descricao: string;
  entidade: string; // Nome do Fornecedor, Empresa ou Órgão Público
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  status: StatusConta;
  tipoOperacao: 'RECEITA' | 'DESPESA';
  tipoCliente?: TipoCliente; // Usado para categorizar as receitas
}

export interface ContaAPagar {
  id: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  dataPagamento?: string;
  status: StatusConta;
  categoria: string;
}

export interface ReceituPorSegmento {
  mes: string;
  receita: number;
}

export interface FaturaLista {
  id: string;
  descricao: string;
  entidade: string;
  valor: number;
  dataVencimento: string;
  status: StatusConta;
}
