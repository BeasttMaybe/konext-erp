import {
  CartaoKPI,
  DadosFaturamento,
  DadosStatusOS,
  TransacaoRecente,
  Usuario,
} from "@/types/indice";

/**
 * Dados moqueados de KPIs do dashboard
 */
export const kpisExemplo: CartaoKPI[] = [
  {
    id: "kpi-1",
    titulo: "Faturamento Mensal",
    valor: "R$ 125.450",
    unidade: "BRL",
    variacao: 12.5,
    cor: "verde",
    icone: null,
  },
  {
    id: "kpi-2",
    titulo: "OS Concluídas",
    valor: 48,
    variacao: 8.3,
    cor: "azul",
    icone: null,
    descricao: "Ordens de Serviço concluídas este mês",
  },
  {
    id: "kpi-3",
    titulo: "Vendas no PDV",
    valor: "R$ 87.320",
    variacao: -2.1,
    cor: "violeta",
    icone: null,
  },
  {
    id: "kpi-4",
    titulo: "Clientes Ativos",
    valor: 342,
    variacao: 5.7,
    cor: "laranja",
    icone: null,
    descricao: "Clientes com atividade no último mês",
  },
];

/**
 * Dados de faturamento dos últimos 6 meses
 */
export const dadosFaturamento: DadosFaturamento[] = [
  { mes: "Jan", faturamento: 98500, meta: 100000 },
  { mes: "Fev", faturamento: 105200, meta: 100000 },
  { mes: "Mar", faturamento: 112800, meta: 110000 },
  { mes: "Abr", faturamento: 108900, meta: 110000 },
  { mes: "Mai", faturamento: 118450, meta: 115000 },
  { mes: "Jun", faturamento: 125450, meta: 120000 },
];

/**
 * Dados de status das ordens de serviço
 */
export const dadosStatusOS: DadosStatusOS[] = [
  {
    nome: "Concluídas",
    quantidade: 48,
    percentual: 45,
    cor: "hsl(142 71% 45%)",
  },
  {
    nome: "Em Andamento",
    quantidade: 38,
    percentual: 35,
    cor: "hsl(217 91% 60%)",
  },
  {
    nome: "Aguardando",
    quantidade: 15,
    percentual: 14,
    cor: "hsl(263 90% 61%)",
  },
  {
    nome: "Canceladas",
    quantidade: 6,
    percentual: 6,
    cor: "hsl(0 84% 60%)",
  },
];

/**
 * Dados de transações recentes
 */
export const transacoesRecentes: TransacaoRecente[] = [
  {
    id: "tr-1",
    tipo: "entrada",
    descricao: "Venda - Cliente ABC Ltda",
    valor: 15800,
    data: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
    status: "completo",
    cliente: "ABC Ltda",
  },
  {
    id: "tr-2",
    tipo: "saida",
    descricao: "Despesa - Fornecedor XYZ",
    valor: 3200,
    data: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 dias atrás
    status: "completo",
  },
  {
    id: "tr-3",
    tipo: "os",
    descricao: "OS #12345 - Manutenção Preventiva",
    valor: 5600,
    data: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 dia atrás
    status: "completo",
    cliente: "Empresa XYZ",
  },
  {
    id: "tr-4",
    tipo: "pdv",
    descricao: "Venda PDV - Caixa 01",
    valor: 2850,
    data: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 horas atrás
    status: "completo",
  },
  {
    id: "tr-5",
    tipo: "entrada",
    descricao: "Fatura #98765 - Pendente de Confirmação",
    valor: 8900,
    data: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 horas atrás
    status: "pendente",
    cliente: "Parceiro 123",
  },
];

/**
 * Dados do usuário autenticado
 */
export const usuarioAtual: Usuario = {
  id: "usr-1",
  nome: "João Silva",
  email: "joao.silva@konext.com.br",
  cargo: "Gerente de Operações",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=joao",
  departamento: "Operações",
};

/**
 * Dados de navegação do menu lateral
 */
export const itemensNavegacao = [
  {
    id: "nav-1",
    titulo: "Dashboard",
    caminho: "/dashboard",
    icone: "LayoutDashboard",
    ativo: true,
  },
  {
    id: "nav-2",
    titulo: "CRM",
    caminho: "/crm",
    icone: "Users",
    ativo: false,
  },
  {
    id: "nav-3",
    titulo: "PDV",
    caminho: "/pdv",
    icone: "ShoppingCart",
    ativo: false,
  },
  {
    id: "nav-4",
    titulo: "Estoque",
    caminho: "/estoque",
    icone: "Package",
    ativo: false,
  },
  {
    id: "nav-5",
    titulo: "Ordens de Serviço",
    caminho: "/os",
    icone: "Wrench",
    ativo: false,
  },
  {
    id: "nav-6",
    titulo: "Financeiro",
    caminho: "/financeiro",
    icone: "DollarSign",
    ativo: false,
  },
];
