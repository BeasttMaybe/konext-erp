import { z } from "zod";

import { UNIDADES_DE_MEDIDA, UNIDADE_PADRAO } from "@/lib/dominio/estoque/preco";
import { TAMANHO_MAXIMO_SKU } from "@/lib/dominio/estoque/sku";

/**
 * Categorias de produto são CADASTRO, não enum.
 *
 * Esta constante existia com os cinco valores fixos do antigo
 * `enum CategoriaProduto` do schema. Ficou só porque o PDV e a lista de
 * produtos ainda precisam ler a coluna legada `Produto.categoria` do histórico
 * enquanto ela não for removida — nada novo é gravado com estes valores.
 *
 * Para escolher categoria, use `listarCategoriasAtivas`
 * (app/actions/categorias-produto.ts).
 */
export const categoriasLegadasProduto = [
  "ACESSORIO",
  "PECA_REPARO",
  "EQUIPAMENTO_REDE",
  "SERVICO",
  "OUTROS",
] as const;

const unidadesValidas = UNIDADES_DE_MEDIDA.map((unidade) => unidade.valor) as [
  string,
  ...string[],
];

export const formProdutoSchema = z
  .object({
    nome: z.string().trim().min(3, "O nome do produto deve ter no mínimo 3 caracteres."),
    categoriaId: z.string().min(1, "Escolha a categoria do produto."),
    /**
     * Vazio é permitido: a action gera o SKU quando não vem nada. O formato é
     * conferido em `validarSku` (lib/dominio/estoque/sku.ts), que é também quem
     * normaliza para maiúsculas.
     */
    sku: z.string().trim().max(TAMANHO_MAXIMO_SKU).optional(),
    unidade: z.enum(unidadesValidas).default(UNIDADE_PADRAO),
    codigoBarras: z.string().trim().optional(),
    compatibilidade: z.string().trim().max(120).optional(),
    imagemUrl: z
      .string()
      .trim()
      .url("Informe uma URL válida para a imagem.")
      .optional()
      .or(z.literal("")),
    descricao: z.string().trim().optional(),
    /**
     * Custo zero é PERMITIDO (era `positive()`, e isso impedia cadastrar
     * serviço e brinde: mão de obra não tem custo de compra, e o cadastro
     * obrigava a digitar R$ 0,01 pra passar da validação).
     */
    custo: z.number().min(0, "O custo não pode ser negativo."),
    precoVenda: z.number().min(0, "O preço de venda não pode ser negativo."),
    quantidadeEstoque: z.number().int("A quantidade em estoque deve ser um número inteiro."),
    estoqueMinimo: z
      .number()
      .int("O estoque mínimo deve ser um número inteiro.")
      .min(0, "O estoque mínimo não pode ser negativo.")
      .default(3),
    permiteVendaSemEstoque: z.boolean().default(false),
    ativo: z.boolean().default(true),
  })
  .strict();

export type FormProduto = z.infer<typeof formProdutoSchema>;
export type FormProdutoEntrada = z.input<typeof formProdutoSchema>;
