export type SecaoConfiguracoesId =
  | "empresa"
  | "documentos"
  | "os"
  | "garantias"
  | "pdv-vendas"
  | "financeiro"
  | "estoque"
  | "crm"
  | "metas"
  | "usuarios"
  | "auditoria"
  | "aparencia";

export type ItemSecaoConfiguracoes = {
  id: SecaoConfiguracoesId;
  rotulo: string;
  descricao: string;
};

export const SECOES_CONFIGURACOES: ItemSecaoConfiguracoes[] = [
  {
    id: "empresa",
    rotulo: "Empresa",
    descricao: "Dados cadastrais e identidade institucional da empresa.",
  },
  {
    id: "documentos",
    rotulo: "Documentos",
    descricao: "Personalize propostas, termos, cupons e impressões do sistema.",
  },
  {
    id: "os",
    rotulo: "Ordens de Serviço",
    descricao: "Defina preferências gerais do fluxo operacional das OS.",
  },
  {
    id: "garantias",
    rotulo: "Garantias",
    descricao: "Gerencie a base das configurações e documentos de garantia.",
  },
  {
    id: "pdv-vendas",
    rotulo: "PDV e Vendas",
    descricao: "Centralize preferências de vendas, recebimentos e formas de pagamento.",
  },
  {
    id: "financeiro",
    rotulo: "Financeiro",
    descricao: "Ajuste parâmetros gerais de contas, caixa e comportamento financeiro.",
  },
  {
    id: "estoque",
    rotulo: "Estoque",
    descricao: "Controle preferências de movimentação, baixa e disponibilidade de itens.",
  },
  {
    id: "crm",
    rotulo: "CRM",
    descricao: "Ajuste informações e preferências relacionadas aos clientes.",
  },
  {
    id: "metas",
    rotulo: "Metas",
    descricao: "Defina preferências iniciais do módulo de metas e indicadores.",
  },
  {
    id: "usuarios",
    rotulo: "Usuários e Permissões",
    descricao: "Organize os acessos e papéis dos usuários do sistema.",
  },
  {
    id: "auditoria",
    rotulo: "Segurança e Auditoria",
    descricao: "Centralize logs, rastreabilidade e segurança operacional.",
  },
  {
    id: "aparencia",
    rotulo: "Aparência",
    descricao: "Personalize tema, identidade visual e preferências da interface.",
  },
];
