import { z } from "zod";

export const statusOsEnum = z.enum([
  "AGUARDANDO_ORCAMENTO", 
  "AGUARDANDO_APROVACAO", 
  "APROVADO", 
  "AGUARDANDO_PECA", 
  "EM_MANUTENCAO", 
  "GARANTIA_RETORNO",
  "PRONTO", 
  "ENTREGUE"
]);

export const tipoItemOrcamentoEnum = z.enum([
  "TELA",
  "BATERIA",
  "CONECTOR_CARGA",
  "TAMPA_IPHONE",
  "TAMPA_ANDROID",
  "OUTROS"
]);

export const itemOrcamentoSchema = z.object({
  tipo: tipoItemOrcamentoEnum,
  descricao: z.string().nonempty("Descrição do item é obrigatória."),
  custoPeca: z.coerce
    .number()
    .min(0, "Custo da peça não pode ser negativo."),
  valorCobrado: z.coerce
    .number()
    .min(0, "Valor cobrado não pode ser negativo."),
});

export const formOsSchema = z.object({
  clienteId: z.string().uuid("ID do cliente inválido."),
  
  // ===== Dados do Aparelho =====
  equipamento: z.string().nonempty("Ex: iPhone 13, Notebook Dell, FZ25..."),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  imei: z.string().optional(),
  senha: z.string().optional(),
  senhaDesenho: z.string().optional(),
  
  // ===== Checklist de Entrada =====
  relatoCliente: z.string().nonempty("Descreva o que o cliente informou."),
  condicaoFisica: z.string().optional(), // Arranhões, tela trincada, etc
  acessorios: z.string().optional(), // Capinha, carregador, etc
  
  // ===== Orçamento (Motor de Cálculo) =====
  itensOrcamento: z
    .array(itemOrcamentoSchema)
    .min(1, "Pelo menos um item de orçamento é obrigatório.")
    .optional(),
  
  status: statusOsEnum.default("AGUARDANDO_ORCAMENTO"),
  observacoesInternas: z.string().optional(),
});

export type ItemOrcamento = z.infer<typeof itemOrcamentoSchema>;
export type FormOrdemServico = z.infer<typeof formOsSchema>;
