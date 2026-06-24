import { z } from "zod";

/**
 * Validação nível ERP para Contas a Pagar
 * Schema robusto com todas as regras de negócio
 */
export const schemaFormContaAPagar = z.object({
  descricao: z
    .string()
    .min(3, "A descrição deve ter no mínimo 3 caracteres."),
  
  fornecedorId: z
    .string()
    .min(1, "Selecione um fornecedor."),
  
  valor: z
    .coerce
    .number()
    .min(0.01, "O valor deve ser maior que zero."),
  
  dataVencimento: z
    .date()
    .refine(
      val => val > new Date(),
      "A data de vencimento deve ser no futuro."
    ),
  
  formaPagamento: z
    .enum([
      "PIX",
      "DINHEIRO",
      "CARTAO_CREDITO",
      "CARTAO_DEBITO",
      "BOLETO",
      "CREDIARIO",
      "EMPENHO_PUBLICO",
    ])
    .refine(
      val => !!val,
      "Selecione uma forma de pagamento válida."
    ),
  
  linhaDigitavel: z
    .string()
    .optional(),
  
  // Classificação
  planoContaId: z
    .string()
    .min(1, "Selecione a categoria (Plano de Contas)."),
  
  centroCusto: z
    .enum([
      "ASSISTENCIA_TECNICA",
      "INFRAESTRUTURA",
      "LICITACOES",
      "LOJA_FISICA",
      "ADMINISTRATIVO",
    ])
    .refine(
      val => !!val,
      "Selecione um centro de custo válido."
    ),
  
  // Juros e Multa (Opcionais, calculados na baixa)
  multaPrevista: z
    .coerce
    .number()
    .min(0)
    .optional()
    .default(0),
  
  jurosPrevisto: z
    .coerce
    .number()
    .min(0)
    .optional()
    .default(0),

  // Parcelamento / Recorrência
  isParcelado: z
    .boolean()
    .default(false),
  
  quantidadeParcelas: z
    .coerce
    .number()
    .min(1, "Mínimo de 1 parcela.")
    .max(120, "Máximo de 120 parcelas.")
    .optional(),
  
  // Anexos
  anexoUrl: z
    .any()
    .optional(),
  
  observacoes: z
    .string()
    .optional(),
});

export type FormContaAPagar = z.infer<typeof schemaFormContaAPagar>;

/**
 * Dados mock de fornecedores para seleção
 */
export const fornecedoresMock = [
  { id: "forn-001", nome: "Imóveis Silva Ltda", email: "contato@imovelsilva.com.br" },
  { id: "forn-002", nome: "Telecomunicações Brasil", email: "suporte@telecom.com.br" },
  { id: "forn-003", nome: "RH Gestão", email: "rh@rhgestao.com.br" },
  { id: "forn-004", nome: "Distribuidora XYZ", email: "vendas@distribuidora.com.br" },
  { id: "forn-005", nome: "Contador Associados", email: "financeiro@contador.com.br" },
  { id: "forn-006", nome: "Tech Solutions Ltda", email: "vendas@techsolutions.com.br" },
  { id: "forn-007", nome: "InfoSegurança Corporativa", email: "info@infoseg.com.br" },
  { id: "forn-008", nome: "Consultoria TI Brasil", email: "contact@consultoriati.com.br" },
];

/**
 * Mapeamento de Plano de Contas para seleção
 */
export const planoContasMock = [
  { id: "pc-001", nome: "Infraestrutura - Aluguel" },
  { id: "pc-002", nome: "Infraestrutura - Internet" },
  { id: "pc-003", nome: "Salários e Encargos" },
  { id: "pc-004", nome: "Fornecedores - Materiais" },
  { id: "pc-005", nome: "Serviços Contábeis" },
  { id: "pc-006", nome: "Energia Elétrica" },
  { id: "pc-007", nome: "Manutenção de Equipamentos" },
  { id: "pc-008", nome: "Despesas Administrativas" },
];

/**
 * Opções de Centro de Custo
 */
export const opçõesCentroCusto = [
  { valor: "ASSISTENCIA_TECNICA", rótulo: "Assistência Técnica" },
  { valor: "INFRAESTRUTURA", rótulo: "Infraestrutura" },
  { valor: "LICITACOES", rótulo: "Licitações" },
  { valor: "LOJA_FISICA", rótulo: "Loja Física" },
  { valor: "ADMINISTRATIVO", rótulo: "Administrativo" },
];

/**
 * Opções de Forma de Pagamento
 */
export const opçõesFormaPagamento = [
  { valor: "PIX", rótulo: "PIX" },
  { valor: "DINHEIRO", rótulo: "Dinheiro" },
  { valor: "CARTAO_CREDITO", rótulo: "Cartão de Crédito" },
  { valor: "CARTAO_DEBITO", rótulo: "Cartão de Débito" },
  { valor: "BOLETO", rótulo: "Boleto" },
  { valor: "CREDIARIO", rótulo: "Crediário" },
  { valor: "EMPENHO_PUBLICO", rótulo: "Empenho Público" },
];

// ============================================================================
// CONTAS A RECEBER (Receivable Accounts)
// ============================================================================

/**
 * Validação nível ERP para Contas a Receber
 * Schema robusto que garante origem clara de toda receita
 */
export const formContaAReceberSchema = z.object({
  descricao: z
    .string()
    .min(3, "A descrição deve ter no mínimo 3 caracteres."),

  clienteId: z
    .string()
    .min(1, "Selecione o cliente, empresa ou órgão público."),

  valor: z
    .coerce
    .number()
    .min(0.01, "O valor deve ser maior que zero."),

  // Datas
  dataVencimento: z
    .coerce
    .date()
    .refine(
      val => val > new Date(),
      "A data de vencimento/previsão deve ser no futuro."
    ),

  dataCompetencia: z.preprocess(
    (valor) => (valor === "" ? undefined : valor),
    z.coerce.date().optional()
  ), // Para contratos B2B mensais

  // Como e de onde vem (Rastreamento de Origem)
  formaRecebimento: z
    .enum([
      "PIX",
      "DINHEIRO",
      "CARTAO_CREDITO",
      "CARTAO_DEBITO",
      "BOLETO",
      "CREDIARIO",
      "EMPENHO_PUBLICO",
    ])
    .refine(
      val => !!val,
      "Selecione uma forma de recebimento válida."
    ),

  origemDaReceita: z
    .enum(["VENDA_PDV", "ORDEM_SERVICO", "CONTRATO_RECORRENTE", "LICITACAO", "AVULSO"])
    .refine(
      val => !!val,
      "Selecione a origem da receita."
    ),

  // Vínculos com outros módulos do ERP
  documentoOrigemId: z
    .string()
    .optional(), // ID da OS ou Número do Empenho

  // Fiscal e Acréscimos
  notaFiscalEmitida: z
    .boolean()
    .default(false),

  jurosCobrados: z
    .coerce
    .number()
    .min(0)
    .optional(),

  descontoConcedido: z
    .coerce
    .number()
    .min(0)
    .optional(),

  // Parcelamento do recebimento
  isParcelado: z
    .boolean()
    .default(false),

  quantidadeParcelas: z
    .coerce
    .number()
    .int("A quantidade de parcelas deve ser um número inteiro.")
    .min(2, "Para parcelar, informe no mínimo 2 parcelas.")
    .max(24, "Máximo de 24 parcelas.")
    .optional(),

  observacoes: z
    .string()
    .optional(),
}).superRefine((dados, ctx) => {
  if (dados.isParcelado && !dados.quantidadeParcelas) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["quantidadeParcelas"],
      message: "Informe a quantidade de parcelas.",
    });
  }
});

export type FormContaAReceber = z.infer<typeof formContaAReceberSchema>;

/**
 * Dados mock de clientes para seleção
 */
export const clientesMock = [
  { id: "cli-001", nome: "Empresa ABC Ltda", email: "contato@empresaabc.com.br", tipo: "Pessoa Jurídica" },
  { id: "cli-002", nome: "João Silva Consultoria", email: "joao@consultoria.com.br", tipo: "Pessoa Física" },
  { id: "cli-003", nome: "Prefeitura de São Paulo", email: "financeiro@prefsp.gov.br", tipo: "Órgão Público" },
  { id: "cli-004", nome: "Tech Solutions Partners", email: "vendas@techpartners.com.br", tipo: "Pessoa Jurídica" },
  { id: "cli-005", nome: "Maria Santos", email: "maria@email.com", tipo: "Pessoa Física" },
  { id: "cli-006", nome: "Governo do Estado MG", email: "licitacoes@mg.gov.br", tipo: "Órgão Público" },
  { id: "cli-007", nome: "Indústrias XYZ S.A", email: "compras@industriasxyz.com.br", tipo: "Pessoa Jurídica" },
  { id: "cli-008", nome: "PDV Varejo Ltda", email: "pdv@varejoltda.com.br", tipo: "Pessoa Jurídica" },
];

/**
 * Opções de Forma de Recebimento
 */
export const opçõesFormaRecebimento = [
  { valor: "PIX", rótulo: "PIX" },
  { valor: "DINHEIRO", rótulo: "Dinheiro" },
  { valor: "CARTAO_CREDITO", rótulo: "Cartão de Crédito" },
  { valor: "CARTAO_DEBITO", rótulo: "Cartão de Débito" },
  { valor: "BOLETO", rótulo: "Boleto" },
  { valor: "CREDIARIO", rótulo: "Crediário" },
  { valor: "EMPENHO_PUBLICO", rótulo: "Empenho Público" },
];

/**
 * Opções de Origem da Receita
 */
export const opçõesOrigemReceita = [
  { valor: "VENDA_PDV", rótulo: "Venda PDV" },
  { valor: "ORDEM_SERVICO", rótulo: "Ordem de Serviço" },
  { valor: "CONTRATO_RECORRENTE", rótulo: "Contrato Recorrente" },
  { valor: "LICITACAO", rótulo: "Licitação Pública" },
  { valor: "AVULSO", rótulo: "Avulso/Pontual" },
];

// ============================================================================
// REGISTRO DE COBRANÇA (Collection Register for Debt Collection)
// ============================================================================

/**
 * Validação nível ERP para Registro de Cobrança
 * Schema robusto para rastrear contato com devedores
 */
export const formRegistroCobrancaSchema = z.object({
  clienteId: z
    .string()
    .min(1, "ID do cliente é obrigatório."),

  dataContato: z
    .coerce
    .date()
    .refine(
      val => val <= new Date(),
      "A data do contato não pode ser no futuro."
    ),

  canalContato: z
    .enum(["WHATSAPP", "LIGACAO", "EMAIL", "PRESENCIAL", "NOTIFICACAO_EXTRAJUDICIAL"])
    .refine(
      val => !!val,
      "Selecione um canal de contato válido."
    ),

  statusNegociacao: z
    .enum([
      "PROMESSA_PAGAMENTO",
      "NAO_ATENDEU",
      "RENEGOCIADO",
      "CONTESTADO",
      "ACAO_JUDICIAL"
    ])
    .refine(
      val => !!val,
      "Selecione um status de negociação válido."
    ),

  dataPromessaPagamento: z.preprocess(
    (valor) => (valor === "" ? undefined : valor),
    z.coerce.date().optional()
  ),

  observacoes: z
    .string()
    .min(5, "Registre um resumo da conversa com o devedor."),
});

export type FormRegistroCobranca = z.infer<typeof formRegistroCobrancaSchema>;

/**
 * Opções de Canal de Contato para Cobrança
 */
export const opçõesCanalContato = [
  { valor: "WHATSAPP", rótulo: "WhatsApp" },
  { valor: "LIGACAO", rótulo: "Ligação" },
  { valor: "EMAIL", rótulo: "E-mail" },
  { valor: "PRESENCIAL", rótulo: "Presencial" },
  { valor: "NOTIFICACAO_EXTRAJUDICIAL", rótulo: "Notificação Extrajudicial" },
];

/**
 * Opções de Status de Negociação
 */
export const opçõesStatusNegociacao = [
  { valor: "PROMESSA_PAGAMENTO", rótulo: "Promessa de Pagamento" },
  { valor: "NAO_ATENDEU", rótulo: "Não Atendeu" },
  { valor: "RENEGOCIADO", rótulo: "Renegociado" },
  { valor: "CONTESTADO", rótulo: "Contestado" },
  { valor: "ACAO_JUDICIAL", rótulo: "Ação Judicial" },
];

