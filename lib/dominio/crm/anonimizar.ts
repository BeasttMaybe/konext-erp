/**
 * O que fica no cadastro de um cliente anonimizado (LGPD): nada que
 * identifique a pessoa. Usado por anonimizarCliente (app/actions/crm.ts).
 */
export const NOME_DO_CLIENTE_ANONIMIZADO = "Cliente anonimizado";

export const DADOS_DO_CLIENTE_ANONIMIZADO = {
  nomeRazaoSocial: NOME_DO_CLIENTE_ANONIMIZADO,
  nomeFantasia: null,
  documento: null,
  inscricaoEstadual: null,
  email: null,
  telefone: "",
  isWhatsapp: false,
  cep: null,
  logradouro: null,
  numero: null,
  bairro: null,
  cidade: null,
  estado: null,
  observacoes: null,
} as const;
