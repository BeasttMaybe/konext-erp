/**
 * Tipos e Interfaces para Ordem de Serviço (OS)
 */

export type StatusOS =
  | "AGUARDANDO_ORCAMENTO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADO"
  | "AGUARDANDO_PECA"
  | "EM_MANUTENCAO"
  | "PRONTO"
  | "ENTREGUE";

export type TipoPecaOrcamento =
  | "TELA"
  | "BATERIA"
  | "CONECTOR_CARGA"
  | "TAMPA_IPHONE"
  | "TAMPA_ANDROID"
  | "OUTROS";

export interface ItemOrcamento {
  id: string;
  tipo: TipoPecaOrcamento;
  descricao: string;
  custoPeca: number;
  valorCobrado: number;
}

export interface ChecklistEntrada {
  relatoCliente: string;
  condicaoFisica: string;
  acessorios: string;
}

export interface OrdemServico {
  id: string;
  numeroOS: string;
  clienteId: string;
  nomeCliente: string;
  
  // Dados do aparelho
  equipamento: string;
  marca?: string;
  modelo?: string;
  imei?: string;
  senha?: string;
  senhaDesenho?: string;
  
  // Entrada
  checklist: ChecklistEntrada;
  
  // Orçamento
  itensOrcamento: ItemOrcamento[];
  totalOrcamento: number;
  
  // Status e metadados
  status: StatusOS;
  observacoesInternas?: string;
  dataCriacao: string;
  dataAtualizacao: string;
}

export interface Cliente {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
}
