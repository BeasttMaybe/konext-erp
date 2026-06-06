import { ReceituPorSegmento, FaturaLista } from "@/types/financeiro";

/**
 * Dados Mock - Dashboard Financeiro
 * Simula receitas por segmento e faturas pendentes
 */

// Receitas por segmento (últimos 6 meses)
export const receitusPorSegmento = {
  PUBLICO: [
    { mes: "Jan", receita: 45000 },
    { mes: "Fev", receita: 52000 },
    { mes: "Mar", receita: 48000 },
    { mes: "Abr", receita: 61000 },
    { mes: "Mai", receita: 55000 },
    { mes: "Jun", receita: 68000 },
  ] as ReceituPorSegmento[],
  B2B: [
    { mes: "Jan", receita: 78000 },
    { mes: "Fev", receita: 82000 },
    { mes: "Mar", receita: 91000 },
    { mes: "Abr", receita: 85000 },
    { mes: "Mai", receita: 95000 },
    { mes: "Jun", receita: 105000 },
  ] as ReceituPorSegmento[],
  B2C: [
    { mes: "Jan", receita: 12000 },
    { mes: "Fev", receita: 15000 },
    { mes: "Mar", receita: 18000 },
    { mes: "Abr", receita: 22000 },
    { mes: "Mai", receita: 25000 },
    { mes: "Jun", receita: 28000 },
  ] as ReceituPorSegmento[],
};

// Top 5 faturas pendentes por segmento
export const faturasTop5PorSegmento = {
  PUBLICO: [
    {
      id: "fat-p-001",
      descricao: "Empenho Prefeitura - Fornecimento de Switches 48 portas",
      entidade: "Prefeitura Municipal de São Paulo",
      valor: 18500,
      dataVencimento: "2026-06-20",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-p-002",
      descricao: "Fornecimento Cabos de Fibra Óptica - Câmara Municipal",
      entidade: "Câmara Municipal de Curitiba",
      valor: 9200,
      dataVencimento: "2026-06-15",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-p-003",
      descricao: "Equipamentos Networking - Secretaria de Educação",
      entidade: "Secretaria de Educação do Estado",
      valor: 25000,
      dataVencimento: "2026-06-10",
      status: "ATRASADO" as const,
    },
    {
      id: "fat-p-004",
      descricao: "Suporte Técnico - Prefeitura de Brasília",
      entidade: "Prefeitura de Brasília",
      valor: 4500,
      dataVencimento: "2026-07-05",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-p-005",
      descricao: "Troca de Servidores - Tribunal de Justiça",
      entidade: "Tribunal de Justiça do Estado",
      valor: 32000,
      dataVencimento: "2026-07-10",
      status: "PENDENTE" as const,
    },
  ] as FaturaLista[],
  B2B: [
    {
      id: "fat-b2b-001",
      descricao: "Contrato Manutenção Servidores - 12 meses",
      entidade: "Tech Solutions Ltda",
      valor: 24000,
      dataVencimento: "2026-06-15",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-b2b-002",
      descricao: "Fornecimento Licenças Antivírus - 50 computadores",
      entidade: "InfoSegurança Corporativa",
      valor: 8500,
      dataVencimento: "2026-06-20",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-b2b-003",
      descricao: "Implementação Sistema ERP - Consultoria",
      entidade: "Consultoria TI Brasil",
      valor: 45000,
      dataVencimento: "2026-06-10",
      status: "ATRASADO" as const,
    },
    {
      id: "fat-b2b-004",
      descricao: "Upgrade Infrastructure Cloud - AWS",
      entidade: "Amazon Web Services",
      valor: 12500,
      dataVencimento: "2026-06-25",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-b2b-005",
      descricao: "Treinamento Equipe TI - Certificação",
      entidade: "Instituto de Tecnologia Avançada",
      valor: 6800,
      dataVencimento: "2026-07-01",
      status: "PENDENTE" as const,
    },
  ] as FaturaLista[],
  B2C: [
    {
      id: "fat-b2c-001",
      descricao: "Troca de Tela Smartphone - Samsung Galaxy S23",
      entidade: "João Silva",
      valor: 650,
      dataVencimento: "2026-06-08",
      status: "ATRASADO" as const,
    },
    {
      id: "fat-b2c-002",
      descricao: "Reparo Placa Mãe Notebook",
      entidade: "Maria Santos",
      valor: 380,
      dataVencimento: "2026-06-12",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-b2c-003",
      descricao: "Instalação Câmera de Segurança IP",
      entidade: "Carlos Oliveira",
      valor: 1200,
      dataVencimento: "2026-06-18",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-b2c-004",
      descricao: "Formatação Computador + Instalação Software",
      entidade: "Ana Costa",
      valor: 220,
      dataVencimento: "2026-06-25",
      status: "PENDENTE" as const,
    },
    {
      id: "fat-b2c-005",
      descricao: "Upgra de Memória RAM 16GB",
      entidade: "Pedro Ferreira",
      valor: 480,
      dataVencimento: "2026-06-28",
      status: "PENDENTE" as const,
    },
  ] as FaturaLista[],
};

// Métricas gerais
export const metricasGerais = {
  contasAPagar: 125000,
  contasAReceber: 245000,
  inadimplencia: 35000,
};
