/**
 * Mapeamentos de Status para Ordem de Serviço
 * Utilizados em: cartao-os.tsx, coluna-kanban.tsx
 */

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
