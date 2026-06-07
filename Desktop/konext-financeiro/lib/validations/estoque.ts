import { z } from "zod";

export const categoriasProduto = [
  "ACESSORIO",
  "PECA_REPARO",
  "EQUIPAMENTO_REDE",
  "SERVICO",
  "OUTROS",
] as const;

export const formProdutoSchema = z
  .object({
    nome: z.string().min(3, "O nome do produto deve ter no minimo 3 caracteres."),
    codigoBarras: z.string().optional(),
    imagemUrl: z.string().url("Informe uma URL valida para a imagem.").optional().or(z.literal("")),
    descricao: z.string().optional(),
    categoria: z.enum(categoriasProduto),
    custo: z.number().positive("O custo deve ser maior que zero."),
    precoVenda: z.number().positive("O preco de venda deve ser maior que zero."),
    quantidadeEstoque: z
      .number()
      .int("A quantidade em estoque deve ser um numero inteiro."),
    estoqueMinimo: z
      .number()
      .int("O estoque minimo deve ser um numero inteiro.")
      .default(3),
  })
  .strict();

export type FormProduto = z.infer<typeof formProdutoSchema>;
