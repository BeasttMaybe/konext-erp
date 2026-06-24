import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const propostaItemSchema = z.object({
  descricao: z.string().trim().min(1, "A descrição do item é obrigatória."),
  quantidade: z.coerce.number().int("A quantidade deve ser inteira.").min(1, "A quantidade mínima é 1."),
  precoUnitario: z.coerce.number().min(0, "O preço unitário não pode ser negativo."),
  descontoPercentual: z.coerce
    .number()
    .min(0, "O desconto não pode ser negativo.")
    .max(100, "O desconto não pode ser maior que 100%."),
});

export const propostaFormSchema = z.object({
  cliente: z.string().trim().min(1, "O cliente é obrigatório."),
  aosCuidados: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  dataEmissao: z.string().min(1, "A data de emissão é obrigatória."),
  validade: z.string().min(1, "A validade da proposta é obrigatória."),
  proximoContato: z.preprocess(emptyToUndefined, z.string().optional()),
  equipamento: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  defeito: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  introducao: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  condicoesPagamento: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  detalhesPagamento: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  termosGarantia: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  observacoesInternas: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  itens: z.array(propostaItemSchema).min(1, "Adicione ao menos um item na proposta."),
});

export type PropostaFormInput = z.input<typeof propostaFormSchema>;
export type PropostaFormValues = z.infer<typeof propostaFormSchema>;
