export type SecaoConfiguracoesId =
  | "empresa"
  | "documentos"
  | "os"
  | "marcas-peca"
  | "garantias"
  | "pdv-caixa"
  | "usuarios";

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
    id: "marcas-peca",
    rotulo: "Marcas de peça",
    descricao: "Cadastre as marcas que aparecem na hora de lançar a peça na OS.",
  },
  {
    id: "garantias",
    rotulo: "Garantias",
    descricao: "Gerencie a base das configurações e documentos de garantia.",
  },
  {
    id: "pdv-caixa",
    rotulo: "PDV e Caixa",
    descricao: "Centralize preferências de vendas, pagamentos e caixa.",
  },
  {
    id: "usuarios",
    rotulo: "Usuários e Cargos",
    descricao: "Organize os acessos, cargos e permissões dos usuários do sistema.",
  },
];
