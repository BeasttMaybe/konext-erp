import { z } from "zod";

export const estagiosFunil = [
  "PROSPECCAO",
  "DIAGNOSTICO",
  "PROPOSTA",
  "NEGOCIACAO",
  "GANHO",
  "PERDIDO",
] as const;

export const formOportunidadeSchema = z.object({
  titulo: z.string().min(3, "O titulo da oportunidade e obrigatorio."),
  valor: z.coerce.number().min(0, "Informe um valor valido."),
  clienteId: z.string().min(1, "Selecione um contato para a oportunidade."),
  estagio: z.enum(estagiosFunil).default("PROSPECCAO"),
  dataFechamento: z.string().optional().or(z.literal("")),
});

export type FormOportunidade = z.infer<typeof formOportunidadeSchema>;
export type EstagioFunil = (typeof estagiosFunil)[number];
