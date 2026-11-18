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
  "os.ver",
  "os.ver_todas",
  // PDV / frente de caixa
  "pdv.vender",
  "pdv.aplicar_desconto_acima_limite",
  "caixa.abrir",
  "caixa.fechar",
  "caixa.ver_historico",
  "caixa.ver",
  "caixa.ver_todos",
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
  "financeiro.ver_todos",
  // Metas
  "metas.ver",
  "metas.editar",
  "metas.excluir",
  // Marketing
  "marketing.ver",
  "marketing.publicar",
  "marketing.conectar",
  "marketing.anunciar",
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

export function ehPermissao(valor: string): valor is Permissao {
  return (CATALOGO_PERMISSOES as readonly string[]).includes(valor);
}

/**
 * Modulo de exibicao de cada permissao — usado so pra agrupar o catalogo
 * (listarPermissoesDisponiveis, em app/actions/cargos.ts) na mesma ordem
 * das secoes acima.
 */
export type ModuloPermissao =
  | "os"
  | "pdv"
  | "estoque"
  | "crm"
  | "financeiro"
  | "metas"
  | "marketing"
  | "vendas"
  | "sistema";

const MODULO_POR_PREFIXO: Readonly<Record<string, ModuloPermissao>> = {
  os: "os",
  pdv: "pdv",
  caixa: "pdv",
  estoque: "estoque",
  crm: "crm",
  propostas: "crm",
  financeiro: "financeiro",
  dashboard: "financeiro",
  metas: "metas",
  marketing: "marketing",
  vendas: "vendas",
  configuracoes: "sistema",
  auditoria: "sistema",
};

export const ROTULOS_MODULO_PERMISSAO: Readonly<Record<ModuloPermissao, string>> = {
  os: "Ordens de Serviço",
  pdv: "PDV e Caixa",
  estoque: "Estoque",
  crm: "CRM e Propostas",
  financeiro: "Financeiro",
  metas: "Metas",
  marketing: "Marketing",
  vendas: "Vendas",
  sistema: "Sistema e Configurações",
};

function moduloDaPermissao(permissao: Permissao): ModuloPermissao {
  const prefixo = permissao.split(".")[0] ?? "";
  return MODULO_POR_PREFIXO[prefixo] ?? "sistema";
}

/**
 * Rotulo e descricao em pt-BR de cada permissao — fonte UNICA, pronta pra
 * tela de gerenciamento de cargos da Fase 1D-2 (listarPermissoesDisponiveis,
 * em app/actions/cargos.ts). Nenhuma tela deve manter seu proprio texto pra
 * uma permissao.
 *
 * As permissoes `*.ver_todas`/`*.ver_todos` (Fase 1D-1, addendum) ainda nao
 * filtram nada: o efeito real comeca na Fase 1D-2, junto do modelo de
 * tecnicos por OS. Ate la elas so existem no catalogo e nos cargos padrao.
 */
export const ROTULOS_PERMISSAO: Readonly<Record<Permissao, { rotulo: string; descricao: string }>> = {
  "os.criar": { rotulo: "Criar ordens de serviço", descricao: "Abrir uma nova OS." },
  "os.editar": { rotulo: "Editar ordens de serviço", descricao: "Alterar dados, itens e status de uma OS." },
  "os.excluir": { rotulo: "Excluir ordens de serviço", descricao: "Excluir logicamente uma OS." },
  "os.reabrir": { rotulo: "Reabrir ordens de serviço", descricao: "Reabrir uma OS já entregue." },
  "os.finalizar": { rotulo: "Finalizar ordens de serviço", descricao: "Entregar e finalizar uma OS." },
  "os.ver_custos": { rotulo: "Ver custos de peças da OS", descricao: "Enxergar o custo (não o preço de venda) de cada item da OS." },
  "os.ver": {
    rotulo: "Ver ordens de serviço",
    descricao: "Ver as OS em que participa (efeito a partir da 1D-2, junto do modelo de técnicos por OS).",
  },
  "os.ver_todas": {
    rotulo: "Ver todas as ordens de serviço",
    descricao: "Remove a restrição de \"só as minhas\" de os.ver (efeito a partir da 1D-2).",
  },
  "pdv.vender": { rotulo: "Vender no PDV", descricao: "Fechar uma venda no PDV." },
  "pdv.aplicar_desconto_acima_limite": { rotulo: "Aplicar desconto acima do limite", descricao: "Ignorar o limite de desconto configurado no PDV." },
  "caixa.abrir": { rotulo: "Abrir caixa", descricao: "Abrir uma sessão de caixa." },
  "caixa.fechar": { rotulo: "Fechar caixa", descricao: "Fechar a própria sessão de caixa." },
  "caixa.ver_historico": { rotulo: "Ver histórico de caixa", descricao: "Consultar sessões de caixa já fechadas." },
  "caixa.ver": {
    rotulo: "Ver caixa",
    descricao: "Ver a própria sessão de caixa (efeito a partir da 1D-2).",
  },
  "caixa.ver_todos": {
    rotulo: "Ver todos os caixas",
    descricao: "Remove a restrição de \"só o meu\" de caixa.ver (efeito a partir da 1D-2).",
  },
  "estoque.ver": { rotulo: "Ver estoque", descricao: "Consultar itens e saldos de estoque." },
  "estoque.editar": { rotulo: "Editar estoque", descricao: "Alterar itens e saldos de estoque." },
  "estoque.ver_custos": { rotulo: "Ver custos de estoque", descricao: "Enxergar o custo dos itens de estoque." },
  "estoque.excluir": { rotulo: "Excluir itens de estoque", descricao: "Excluir itens do estoque." },
  "crm.ver": { rotulo: "Ver CRM", descricao: "Consultar clientes e propostas do CRM." },
  "crm.editar": { rotulo: "Editar CRM", descricao: "Criar e alterar clientes e propostas." },
  "crm.excluir": { rotulo: "Excluir CRM", descricao: "Excluir clientes e propostas." },
  "propostas.editar": { rotulo: "Editar propostas", descricao: "Criar e alterar propostas comerciais." },
  "propostas.excluir": { rotulo: "Excluir propostas", descricao: "Excluir propostas comerciais." },
  "financeiro.ver": {
    rotulo: "Ver financeiro",
    descricao: "Ver os lançamentos financeiros em que participa (efeito a partir da 1D-2).",
  },
  "financeiro.lancar": { rotulo: "Lançar no financeiro", descricao: "Criar contas a pagar e a receber." },
  "financeiro.baixar": { rotulo: "Baixar contas", descricao: "Registrar pagamento/recebimento de uma conta." },
  "financeiro.editar": { rotulo: "Editar financeiro", descricao: "Alterar lançamentos financeiros." },
  "financeiro.excluir": { rotulo: "Excluir financeiro", descricao: "Excluir lançamentos financeiros." },
  "financeiro.ver_todos": {
    rotulo: "Ver todo o financeiro",
    descricao: "Remove a restrição de \"só os meus\" de financeiro.ver (efeito a partir da 1D-2).",
  },
  "metas.ver": { rotulo: "Ver metas", descricao: "Consultar metas e indicadores." },
  "metas.editar": { rotulo: "Editar metas", descricao: "Criar e alterar metas." },
  "metas.excluir": { rotulo: "Excluir metas", descricao: "Excluir metas." },
  "marketing.ver": { rotulo: "Ver Marketing", descricao: "Acessar a área de Marketing, publicações e conexões." },
  "marketing.publicar": { rotulo: "Publicar nas redes", descricao: "Criar, agendar e publicar posts orgânicos nas redes conectadas." },
  "marketing.conectar": { rotulo: "Conectar contas de marketing", descricao: "Ligar e desligar as contas das plataformas (Meta, Google, TikTok, Perfil do Google)." },
  "marketing.anunciar": { rotulo: "Criar anúncios pagos", descricao: "Criar e aprovar campanhas de anúncios pagos, que gastam verba." },
  "vendas.criar": { rotulo: "Criar vendas", descricao: "Gerar um pedido de venda." },
  "vendas.aprovar": { rotulo: "Aprovar vendas", descricao: "Aprovar um pedido de venda." },
  "vendas.cancelar": { rotulo: "Cancelar vendas", descricao: "Cancelar um pedido de venda." },
  "configuracoes.empresa": { rotulo: "Configurar dados da empresa", descricao: "Alterar dados cadastrais da empresa." },
  "configuracoes.sistema": { rotulo: "Configurar o sistema", descricao: "Alterar regras operacionais do ERP." },
  "configuracoes.usuarios": { rotulo: "Gerenciar usuários e cargos", descricao: "Criar, editar e desativar usuários e cargos." },
  "auditoria.ver": { rotulo: "Ver auditoria", descricao: "Consultar a trilha de auditoria do sistema." },
  "dashboard.financeiro": { rotulo: "Ver dashboard financeiro", descricao: "Enxergar os indicadores financeiros do painel inicial." },
};

export type PermissaoDisponivel = {
  permissao: Permissao;
  rotulo: string;
  descricao: string;
  modulo: ModuloPermissao;
  rotuloModulo: string;
};

/** Catalogo agrupado por modulo, pronto pra tela de gerenciamento de cargos da Fase 1D-2. */
export function listarCatalogoAgrupado(): readonly PermissaoDisponivel[] {
  return CATALOGO_PERMISSOES.map((permissao) => ({
    permissao,
    ...ROTULOS_PERMISSAO[permissao],
    modulo: moduloDaPermissao(permissao),
    rotuloModulo: ROTULOS_MODULO_PERMISSAO[moduloDaPermissao(permissao)],
  }));
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

/**
 * Fonte da decisao: o conjunto de permissoes ja resolvido do Cargo do
 * usuario (Fase 1D-1) — ver lib/auth/resolver-permissoes.ts, chamado uma vez
 * por requisicao em exigirContextoTenant. So cai pra matriz legada quando o
 * contexto, por algum motivo, nao tem `permissoes` resolvido (ex.: um
 * ContextoTenantSeguro montado a mao em teste/script antigo).
 */
export function temPermissao(contexto: ContextoTenantSeguro, permissao: Permissao): boolean {
  if (contexto.permissoes) {
    return contexto.permissoes.has(permissao);
  }

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
    permissoes: Array.from(contexto.permissoes ?? permissoesDoPapel(papel)),
  };
}
