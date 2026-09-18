/**
 * Tipos e Interfaces para Ordem de Serviço (OS)
 */

// StatusOS vive em lib/dominio/os/maquina-estados.ts (fonte unica de verdade,
// modelo legado). EtapaOS/SituacaoOS vivem em lib/dominio/os/etapas.ts —
// fonte de leitura viva a partir da Fase 1C-3.
import type { StatusOS } from "@/lib/dominio/os/maquina-estados";
import type { EtapaOS, SituacaoOS } from "@/lib/dominio/os/etapas";

export type { StatusOS, EtapaOS, SituacaoOS };

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
  /** null quando o usuário logado não tem a permissão `os.ver_custos`. */
  custoPeca: number | null;
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
  /** Fonte de leitura viva a partir da Fase 1C-3 — ver lib/dominio/os/etapas.ts. */
  etapa: EtapaOS;
  situacao: SituacaoOS | null;
  ehRetornoGarantia?: boolean;
  osOrigemGarantiaId?: string;
  numeroOSOrigemGarantia?: string;
  retornoGarantiaId?: string;
  retornoGarantiaFinalizadoEm?: string;
  observacoesInternas?: string;
  /** OS ENTREGUE sem nenhum item/serviço vinculado — ver finalizarSemServico. */
  entregueSemServico?: boolean;
  motivoSemServico?: string;
  /** Preenchido só na entrega (finalizarOrdemServico/finalizarSemServico). null enquanto nao arquivada, mesmo com status ENTREGUE — o caso de "resgate". */
  archivedAt?: string | null;
  dataCriacao: string;
  dataAtualizacao: string;
}

export interface OrdemServicoExcluida {
  id: string;
  numeroOS: string;
  nomeCliente: string;
  equipamento: string;
  totalOrcamento: number;
  statusAnterior: string;
  excluidaPor: string;
  motivoExclusao: string;
  excluidaEm: string;
}

export interface Cliente {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
}
