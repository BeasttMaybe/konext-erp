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
export const ordensMock: OrdemServico[] = [
  {
    id: "os-001",
    numeroOS: "OS-2026-001",
    clienteId: "cli-001",
    nomeCliente: "João Silva",
    equipamento: "iPhone 13",
    marca: "Apple",
    modelo: "iPhone 13 Pro",
    numeroSerieImei: "358123045237847",
    senhaAcesso: "••••••••",
    checklist: {
      relatoCliente: "Tela trincada no canto inferior direito",
      condicaoFisica: "Riscos leves em volta, tela com trinca grande",
      acessoriosDeixados: "Carregador original, capinha preta",
    },
    itensOrcamento: [
      {
        id: "item-001",
        tipo: "TELA",
        descricao: "Tela OLED para iPhone 13 Pro",
        custoPeca: 180,
        valorCobrado: 495, // 180 * 2.75 (175% markup)
      },
    ],
    totalOrcamento: 495,
    status: "AGUARDANDO_APROVACAO",
    observacoesInternas: "Cliente aceitou orçamento via WhatsApp",
    dataCriacao: "2026-06-01T10:30:00Z",
    dataAtualizacao: "2026-06-02T14:15:00Z",
  },
  {
    id: "os-002",
    numeroOS: "OS-2026-002",
    clienteId: "cli-002",
    nomeCliente: "Maria Santos",
    equipamento: "Notebook Dell",
    marca: "Dell",
    modelo: "Inspiron 15 3520",
    numeroSerieImei: "4M2TH02",
    senhaAcesso: "••••••••",
    checklist: {
      relatoCliente: "Bateria não carrega",
      condicaoFisica: "Bom estado, alguns riscos leves",
      acessoriosDeixados: "Carregador, mochila",
    },
    itensOrcamento: [
      {
        id: "item-002",
        tipo: "BATERIA",
        descricao: "Bateria Dell Inspiron 15 3520",
        custoPeca: 120,
        valorCobrado: 330, // 120 * 2.75 (175% markup)
      },
    ],
    totalOrcamento: 330,
    status: "APROVADO",
    observacoesInternas: "Cliente aprovou. Peça já está em estoque.",
    dataCriacao: "2026-06-02T09:00:00Z",
    dataAtualizacao: "2026-06-03T11:20:00Z",
  },
  {
    id: "os-003",
    numeroOS: "OS-2026-003",
    clienteId: "cli-003",
    nomeCliente: "Carlos Oliveira",
    equipamento: "Samsung Galaxy S23",
    marca: "Samsung",
    modelo: "Galaxy S23 Ultra",
    numeroSerieImei: "R5CW80ABC123",
    senhaAcesso: "••••••••",
    checklist: {
      relatoCliente: "Conector de carga solto, não carrega",
      condicaoFisica: "Pequeno arranhão na costa",
      acessoriosDeixados: "Carregador USB-C, case",
    },
    itensOrcamento: [
      {
        id: "item-003",
        tipo: "CONECTOR_CARGA",
        descricao: "Reparo/limpeza do conector de carga",
        custoPeca: 50,
        valorCobrado: 150, // 50 + 100 de mão de obra
      },
    ],
    totalOrcamento: 150,
    status: "EM_MANUTENCAO",
    observacoesInternas: "Começou o reparo hoje, deve estar pronto amanhã.",
    dataCriacao: "2026-06-03T13:45:00Z",
    dataAtualizacao: "2026-06-04T08:30:00Z",
  },
  {
    id: "os-004",
    numeroOS: "OS-2026-004",
    clienteId: "cli-004",
    nomeCliente: "Ana Costa",
    equipamento: "iPhone 12",
    marca: "Apple",
    modelo: "iPhone 12",
    numeroSerieImei: "DMPTL1AA8B",
    senhaAcesso: "••••••••",
    checklist: {
      relatoCliente: "Tela não liga",
      condicaoFisica: "Bom estado geral",
      acessoriosDeixados: "Carregador, EarPods",
    },
    itensOrcamento: [
      {
        id: "item-004",
        tipo: "TELA",
        descricao: "Tela LCD para iPhone 12",
        custoPeca: 120,
        valorCobrado: 360, // 120 * 3 (200% markup)
      },
    ],
    totalOrcamento: 360,
    status: "PRONTO",
    observacoesInternas: "Teste realizado. Tudo funcionando perfeitamente.",
    dataCriacao: "2026-05-30T15:00:00Z",
    dataAtualizacao: "2026-06-04T16:45:00Z",
  },
  {
    id: "os-005",
    numeroOS: "OS-2026-005",
    clienteId: "cli-005",
    nomeCliente: "Pedro Ferreira",
    equipamento: "Motorola Moto G54",
    marca: "Motorola",
    modelo: "Moto G54",
    numeroSerieImei: "860123456789012",
    senhaAcesso: "••••••••",
    checklist: {
      relatoCliente: "Tampa traseira rachada",
      condicaoFisica: "Tampa com trinca grande, resto OK",
      acessoriosDeixados: "Nenhum acessório",
    },
    itensOrcamento: [
      {
        id: "item-005",
        tipo: "TAMPA_ANDROID",
        descricao: "Tampa traseira Motorola Moto G54",
        custoPeca: 45,
        valorCobrado: 125, // 45 + 80 de mão de obra
      },
    ],
    totalOrcamento: 125,
    status: "ENTREGUE",
    observacoesInternas: "Cliente buscou em 04/06 às 18:30. Pagamento em dinheiro.",
    dataCriacao: "2026-05-28T10:15:00Z",
    dataAtualizacao: "2026-06-04T18:30:00Z",
  },
  {
    id: "os-006",
    numeroOS: "OS-2026-006",
    clienteId: "cli-001",
    nomeCliente: "João Silva",
    equipamento: "Tablet Samsung",
    marca: "Samsung",
    modelo: "Galaxy Tab S8",
    numeroSerieImei: "R5CW70ABC456",
    senhaAcesso: "••••••••",
    checklist: {
      relatoCliente: "Bateria não funciona, não liga",
      condicaoFisica: "Excelente estado",
      acessoriosDeixados: "Carregador, suporte",
    },
    itensOrcamento: [],
    totalOrcamento: 0,
    status: "AGUARDANDO_ORCAMENTO",
    observacoesInternas: "Aguardando levantamento técnico.",
    dataCriacao: "2026-06-04T14:20:00Z",
    dataAtualizacao: "2026-06-04T14:20:00Z",
  },
];

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
