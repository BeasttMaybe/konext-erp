import type { ContextoTenantSeguro } from "@/types/tenant";

/**
 * Papeis do vinculo UsuarioEmpresa no banco CENTRAL. Fonte unica de verdade
 * para autorizacao — ver o comentario em `types/tenant.ts` sobre por que o
 * `Usuario.role` do tenant (ADMIN/OPERADOR/TECNICO) nunca deve ser usado aqui.
 */
export type PapelEmpresa = "ADMIN" | "GESTOR" | "USUARIO";

export const PAPEIS_EMPRESA: readonly PapelEmpresa[] = ["ADMIN", "GESTOR", "USUARIO"];

const ROTULOS_PAPEL: Readonly<Record<PapelEmpresa, string>> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  USUARIO: "Usuário",
};

export function ehPapelEmpresa(valor: string): valor is PapelEmpresa {
  return (PAPEIS_EMPRESA as readonly string[]).includes(valor);
}

export function rotularPapel(papel: string): string {
  return ehPapelEmpresa(papel) ? ROTULOS_PAPEL[papel] : papel || "não identificado";
}

/**
 * Catalogo tipado de permissoes. Uma unica lista, usada tanto para a matriz de
 * papeis quanto como o tipo `Permissao` (union de string literals) — impossivel
 * pedir/conceder uma permissao que nao exista aqui sem erro de compilacao.
 */
export const CATALOGO_PERMISSOES = [
  // Ordens de servico
  "os.criar",
  "os.editar",
  "os.excluir",
  "os.reabrir",
  "os.finalizar",
  "os.ver_custos",
  // PDV / frente de caixa
  "pdv.vender",
  "pdv.aplicar_desconto_acima_limite",
  "caixa.abrir",
  "caixa.fechar",
  "caixa.ver_historico",
  // Estoque
  "estoque.ver",
  "estoque.editar",
  "estoque.ver_custos",
  "estoque.excluir",
  // CRM
  "crm.ver",
  "crm.editar",
  "crm.excluir",
  "propostas.editar",
  "propostas.excluir",
  // Financeiro
  "financeiro.ver",
  "financeiro.lancar",
  "financeiro.baixar",
  "financeiro.editar",
  "financeiro.excluir",
  // Metas
  "metas.ver",
  "metas.editar",
  "metas.excluir",
  // Vendas
  "vendas.criar",
  "vendas.aprovar",
  "vendas.cancelar",
  // Configuracoes e auditoria
  "configuracoes.empresa",
  "configuracoes.sistema",
  "configuracoes.usuarios",
  "auditoria.ver",
  "dashboard.financeiro",
] as const;

export type Permissao = (typeof CATALOGO_PERMISSOES)[number];

function ehPermissao(valor: string): valor is Permissao {
  return (CATALOGO_PERMISSOES as readonly string[]).includes(valor);
}

const PERMISSOES_NEGADAS_GESTOR: ReadonlySet<Permissao> = new Set([
  "configuracoes.empresa",
  "configuracoes.sistema",
  "configuracoes.usuarios",
]);

const PERMISSOES_USUARIO: readonly Permissao[] = [
  "os.criar",
  "os.editar",
  "os.finalizar",
  "pdv.vender",
  "caixa.abrir",
  "caixa.fechar",
  "estoque.ver",
  "crm.ver",
  "crm.editar",
  "propostas.editar",
  "metas.ver",
  "financeiro.ver",
  "vendas.criar",
];

/**
 * Matriz papel -> permissoes concedidas.
 *   ADMIN   : todas.
 *   GESTOR  : todas, exceto as tres de configuracoes (empresa/sistema/usuarios).
 *   USUARIO : lista curta e explicita de operacoes do dia a dia.
 */
const MATRIZ_PERMISSOES: Readonly<Record<PapelEmpresa, ReadonlySet<Permissao>>> = {
  ADMIN: new Set(CATALOGO_PERMISSOES),
  GESTOR: new Set(CATALOGO_PERMISSOES.filter((permissao) => !PERMISSOES_NEGADAS_GESTOR.has(permissao))),
  USUARIO: new Set(PERMISSOES_USUARIO),
};

/**
 * Erro de negocio tipado por falta de permissao. Quem chama distingue "nao
 * pode" de "deu errado" pela classe, nunca por comparacao de mensagem de erro
 * (AUDIT_REPORT F-37) — a mensagem em si e so para exibicao.
 */
export class ErroPermissao extends Error {
  readonly papelAtual: string;
  readonly permissaoExigida: Permissao;

  constructor(papelAtual: string, permissaoExigida: Permissao) {
    super(
      `Seu perfil (${rotularPapel(papelAtual)}) não tem permissão para esta ação (${permissaoExigida}).`
    );
    this.name = "ErroPermissao";
    this.papelAtual = papelAtual;
    this.permissaoExigida = permissaoExigida;
  }
}

function papelDoContexto(contexto: ContextoTenantSeguro): PapelEmpresa {
  const papel = contexto.papelEmpresa;
  return ehPapelEmpresa(papel) ? papel : "USUARIO";
}

/**
 * Lista de permissoes concedidas ao papel informado. Nao lanca — use para
 * checagens compostas ou para alimentar a UI.
 */
export function permissoesDoPapel(papel: PapelEmpresa): ReadonlySet<Permissao> {
  return MATRIZ_PERMISSOES[papel] ?? MATRIZ_PERMISSOES.USUARIO;
}

export function temPermissao(contexto: ContextoTenantSeguro, permissao: Permissao): boolean {
  return permissoesDoPapel(papelDoContexto(contexto)).has(permissao);
}

/**
 * Exige a permissao informada, lancando `ErroPermissao` caso contrario.
 * Use como a PRIMEIRA linha de toda server action mutante e de toda leitura
 * que exponha dado financeiro ou de custo.
 */
export function exigirPermissao(contexto: ContextoTenantSeguro, permissao: Permissao): void {
  if (!ehPermissao(permissao)) {
    throw new ErroPermissao(contexto.papelEmpresa, permissao);
  }

  if (!temPermissao(contexto, permissao)) {
    throw new ErroPermissao(contexto.papelEmpresa, permissao);
  }
}

/** Verdadeiro se o contexto tem QUALQUER uma das permissoes informadas. */
export function temAlgumaPermissao(contexto: ContextoTenantSeguro, permissoes: readonly Permissao[]): boolean {
  return permissoes.some((permissao) => temPermissao(contexto, permissao));
}

export type PermissoesDoContexto = {
  papel: PapelEmpresa;
  permissoes: readonly Permissao[];
};

/**
 * Forma serializavel (papel + lista de permissoes) para passar de um Server
 * Component para um Client Component/contexto React.
 */
export function obterPermissoesDoContexto(contexto: ContextoTenantSeguro): PermissoesDoContexto {
  const papel = papelDoContexto(contexto);
  return {
    papel,
    permissoes: Array.from(permissoesDoPapel(papel)),
  };
}
