import { OrdemServico, Cliente } from "@/types/os";

/**
 * Mock - Clientes
 */
export const clientesMock: Cliente[] = [
  {
    id: "cli-001",
    nome: "João Silva",
    email: "joao.silva@email.com",
    telefone: "(11) 98765-4321",
  },
  {
    id: "cli-002",
    nome: "Maria Santos",
    email: "maria.santos@email.com",
    telefone: "(11) 99876-5432",
  },
  {
    id: "cli-003",
    nome: "Carlos Oliveira",
    email: "carlos.oliveira@email.com",
    telefone: "(11) 97654-3210",
  },
  {
    id: "cli-004",
    nome: "Ana Costa",
    email: "ana.costa@email.com",
    telefone: "(11) 96543-2109",
  },
  {
    id: "cli-005",
    nome: "Pedro Ferreira",
    email: "pedro.ferreira@email.com",
    telefone: "(11) 95432-1098",
  },
];

/**
 * Mock - Ordens de Serviço
 */
export const ordensMock: OrdemServico[] = [];

export const mapStatusLabel: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "Aguardando Orçamento",
  AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  APROVADO: "Aprovado",
  AGUARDANDO_PECA: "Aguardando Peça",
  EM_MANUTENCAO: "Em Manutenção",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
};

export const mapStatusColor: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "bg-slate-200 text-slate-800",
  AGUARDANDO_APROVACAO: "bg-yellow-200 text-yellow-800",
  APROVADO: "bg-blue-200 text-blue-800",
  AGUARDANDO_PECA: "bg-orange-200 text-orange-800",
  EM_MANUTENCAO: "bg-purple-200 text-purple-800",
  PRONTO: "bg-green-200 text-green-800",
  ENTREGUE: "bg-emerald-200 text-emerald-800",
};
