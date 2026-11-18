import { CATALOGO_PERMISSOES, type Permissao } from "./permissoes";

/**
 * Estrutura da tela "Permissões do cargo" (Fase 1D-3): uma grade Ver/Criar/
 * Editar/Excluir por recurso, mais dois blocos à parte — "especiais" (ações
 * que não são um CRUD comum) e "escopo" (as três permissões `*_todas`/
 * `*_todos`, que alternam entre "vê apenas os seus" e "vê de todos", não
 * entre ligado/desligado).
 *
 * Rótulo e descrição de cada permissão continuam vindo só de
 * ROTULOS_PERMISSAO (via listarCatalogoAgrupado) — este módulo só decide EM
 * QUAL célula/bloco cada permissão do catálogo aparece.
 */

export type ColunaGradePermissoes = "ver" | "criar" | "editar" | "excluir";

export const ROTULOS_COLUNA_GRADE: Readonly<Record<ColunaGradePermissoes, string>> = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
};

export type LinhaGradePermissoes = {
  chave: string;
  rotulo: string;
  colunas: Partial<Record<ColunaGradePermissoes, Permissao>>;
};

/** Uma linha por recurso — nunca a nível do ModuloPermissao (mais grosso), pra colunas nunca colidirem (ex.: CRM e Propostas). */
export const GRADE_PERMISSOES: readonly LinhaGradePermissoes[] = [
  { chave: "os", rotulo: "Ordens de Serviço", colunas: { ver: "os.ver", criar: "os.criar", editar: "os.editar", excluir: "os.excluir" } },
  { chave: "pdv", rotulo: "PDV", colunas: { criar: "pdv.vender" } },
  { chave: "caixa", rotulo: "Caixa", colunas: { ver: "caixa.ver", criar: "caixa.abrir", editar: "caixa.fechar" } },
  { chave: "estoque", rotulo: "Estoque", colunas: { ver: "estoque.ver", editar: "estoque.editar", excluir: "estoque.excluir" } },
  { chave: "crm", rotulo: "CRM", colunas: { ver: "crm.ver", editar: "crm.editar", excluir: "crm.excluir" } },
  { chave: "propostas", rotulo: "Propostas", colunas: { editar: "propostas.editar", excluir: "propostas.excluir" } },
  { chave: "financeiro", rotulo: "Financeiro", colunas: { ver: "financeiro.ver", criar: "financeiro.lancar", editar: "financeiro.editar", excluir: "financeiro.excluir" } },
  { chave: "metas", rotulo: "Metas", colunas: { ver: "metas.ver", editar: "metas.editar", excluir: "metas.excluir" } },
  { chave: "marketing", rotulo: "Marketing", colunas: { ver: "marketing.ver", criar: "marketing.publicar" } },
  { chave: "vendas", rotulo: "Vendas", colunas: { criar: "vendas.criar", editar: "vendas.aprovar", excluir: "vendas.cancelar" } },
];

/**
 * Permissões que não são um CRUD comum de nenhum recurso — vão num bloco
 * separado ("Permissões especiais"), como checkboxes avulsos.
 *
 * As 6 primeiras são as que a Fase 1D-3 pediu explicitamente; as demais
 * (os.finalizar, caixa.ver_historico, configuracoes.*, dashboard.financeiro)
 * são o resto do catálogo que também não cabe na grade — sem elas, um cargo
 * poderia ter essas permissões no banco sem nenhum jeito de ligar/desligar
 * pela tela. `grade-permissoes.test.ts` garante que todo permissao do
 * catálogo aparece em exatamente um lugar (grade, especiais ou escopo).
 */
export const PERMISSOES_ESPECIAIS: readonly Permissao[] = [
  "os.ver_custos",
  "estoque.ver_custos",
  "pdv.aplicar_desconto_acima_limite",
  "os.reabrir",
  "financeiro.baixar",
  "auditoria.ver",
  "os.finalizar",
  "caixa.ver_historico",
  "configuracoes.empresa",
  "configuracoes.sistema",
  "configuracoes.usuarios",
  "dashboard.financeiro",
  "marketing.conectar",
  "marketing.anunciar",
];

export type PermissaoEscopo = {
  permissao: Permissao;
  rotulo: string;
  rotuloAtivo: string;
  rotuloInativo: string;
};

/** As 3 permissões de escopo (Fase 1D-2): não são um boolean comum, são "vê apenas os seus" x "vê de todos". */
export const PERMISSOES_ESCOPO: readonly PermissaoEscopo[] = [
  { permissao: "os.ver_todas", rotulo: "Ordens de Serviço", rotuloAtivo: "Vê de todos", rotuloInativo: "Vê apenas os seus" },
  { permissao: "caixa.ver_todos", rotulo: "Caixa", rotuloAtivo: "Vê de todos", rotuloInativo: "Vê apenas os seus" },
  { permissao: "financeiro.ver_todos", rotulo: "Financeiro", rotuloAtivo: "Vê de todos", rotuloInativo: "Vê apenas os seus" },
];

function permissoesDaGrade(): Permissao[] {
  return GRADE_PERMISSOES.flatMap((linha) => Object.values(linha.colunas));
}

/** Todo permissao do catálogo, em exatamente um lugar — usado pela tela e conferido em teste. */
export function localizarPermissao(permissao: Permissao): "grade" | "especial" | "escopo" | "nenhum" {
  if (permissoesDaGrade().includes(permissao)) return "grade";
  if (PERMISSOES_ESPECIAIS.includes(permissao)) return "especial";
  if (PERMISSOES_ESCOPO.some((item) => item.permissao === permissao)) return "escopo";
  return "nenhum";
}

/** Verdadeiro se todo item do catálogo aparece em exatamente um lugar — chamado pelo teste deste módulo. */
export function catalogoTotalmenteMapeado(): boolean {
  return CATALOGO_PERMISSOES.every((permissao) => localizarPermissao(permissao) !== "nenhum");
}
