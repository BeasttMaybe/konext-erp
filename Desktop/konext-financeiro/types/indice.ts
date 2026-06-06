// Tipos e Interfaces do Konext ERP

/**
 * Interface para dados de KPI (Indicador Chave de Desempenho)
 */
export interface CartaoKPI {
  id: string;
  titulo: string;
  valor: string | number;
  unidade?: string;
  variacao: number;
  icone: React.ReactNode;
  cor: "verde" | "azul" | "violeta" | "laranja";
  descricao?: string;
}

/**
 * Interface para dados de faturamento mensal
 */
export interface DadosFaturamento {
  mes: string;
  faturamento: number;
  meta?: number;
}

/**
 * Interface para status de ordens de serviço
 */
export interface DadosStatusOS {
  nome: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

/**
 * Interface para transações recentes
 */
export interface TransacaoRecente {
  id: string;
  tipo: "entrada" | "saida" | "os" | "pdv";
  descricao: string;
  valor: number;
  data: Date;
  status: "completo" | "pendente" | "cancelado";
  cliente?: string;
}

/**
 * Interface para usuário
 */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  avatar?: string;
  departamento: string;
}

/**
 * Interface para item do menu de navegação
 */
export interface ItemNavegacao {
  id: string;
  titulo: string;
  caminho: string;
  icone: React.ReactNode;
  subItens?: ItemNavegacao[];
  ativo?: boolean;
}
