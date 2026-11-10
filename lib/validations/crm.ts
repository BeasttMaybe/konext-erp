import { z } from "zod";

export const formClienteSchema = z.object({
  tipoPessoa: z.enum(["FISICA", "JURIDICA"]).default("FISICA"),
  papel: z.enum(["CLIENTE", "FORNECEDOR"]).default("CLIENTE"),

  // Dados Principais
  nomeRazaoSocial: z
    .string()
    .min(3, "O nome ou Razão Social é obrigatório."),
  nomeFantasia: z.string().optional(),
  // Opcional por decisão do dono: no cadastro de cliente, só nome e telefone
  // são obrigatórios. Quem atende no balcão nem sempre tem o documento na
  // hora, e exigir um campo que a pessoa não tem leva ao pior dos mundos --
  // alguém digita qualquer coisa só para passar da tela.
  documento: z.string().optional(),
  inscricaoEstadual: z.string().optional(),

  // Contato
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  telefone: z.string().min(10, "Telefone inválido."),
  isWhatsapp: z.boolean().default(true),

  // Endereço
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z
    .string()
    .length(2, "Use a sigla do estado (ex: SP).")
    .optional()
    .or(z.literal("")),

  // Classificação
  categoria: z
    .enum(["CLIENTE_FINAL", "EMPRESA", "ORGAO_PUBLICO"])
    .default("CLIENTE_FINAL"),
  observacoes: z.string().optional(),
});

export type FormCliente = z.infer<typeof formClienteSchema>;
