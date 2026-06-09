import { z } from "zod";

export const formClienteSchema = z.object({
  tipoPessoa: z.enum(["FISICA", "JURIDICA"]).default("FISICA"),

  // Dados Principais
  nomeRazaoSocial: z
    .string()
    .min(3, "O nome ou Razão Social é obrigatório."),
  nomeFantasia: z.string().optional(),
  documento: z
    .string()
    .nonempty("CPF ou CNPJ é obrigatório."), // Pode adicionar regex de validação depois
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
