import { CATALOGO_PERMISSOES, type Permissao } from "@/lib/auth/permissoes";

/**
 * Os 5 cargos que toda empresa ganha na Fase 1D-1 (schema + backfill em
 * prisma/central/migrations/20260918130000_cargos_permissoes). Esta lista e
 * a fonte de verdade em TypeScript — mantida manualmente em sincronia com o
 * VALUES de cada INSERT INTO "CargoPermissao" daquela migracao. Usada por
 * lib/auth/mapear-cargo-legado.ts (o conjunto do Gerente) e pelos testes de
 * invariantes/mapeamento.
 */
export type NomeCargoPadrao = "Administrador" | "Gerente" | "Técnico" | "Atendente" | "Financeiro";

const PERMISSOES_NEGADAS_GERENTE: ReadonlySet<Permissao> = new Set([
  "configuracoes.empresa",
  "configuracoes.sistema",
  "configuracoes.usuarios",
]);

/** Tudo, exceto as 3 permissoes de configuracoes — computado do catalogo atual de proposito (cresce junto com ele). */
export const PERMISSOES_GERENTE_PADRAO: readonly Permissao[] = CATALOGO_PERMISSOES.filter(
  (permissao) => !PERMISSOES_NEGADAS_GERENTE.has(permissao)
);

export const PERMISSOES_TECNICO_PADRAO: readonly Permissao[] = [
  "os.criar",
  "os.editar",
  "os.finalizar",
  "os.reabrir",
  "os.ver",
  "estoque.ver",
  "crm.ver",
  "metas.ver",
];

/**
 * Inclui `financeiro.ver`: o Atendente sucede o antigo papel legado USUARIO
 * (ver mapearRoleLegadoParaCargoPadrao), que ja tinha essa permissao — sem
 * isso, todo USUARIO existente perderia acesso ao financeiro no backfill,
 * violando a garantia de "ninguem perde permissao que ja tinha".
 */
export const PERMISSOES_ATENDENTE_PADRAO: readonly Permissao[] = [
  "os.criar",
  "os.editar",
  "os.finalizar",
  "os.ver",
  "os.ver_todas",
  "pdv.vender",
  "vendas.criar",
  "caixa.abrir",
  "caixa.fechar",
  "caixa.ver",
  "estoque.ver",
  "crm.ver",
  "crm.editar",
  "propostas.editar",
  "financeiro.ver",
  "metas.ver",
];

export const PERMISSOES_FINANCEIRO_PADRAO: readonly Permissao[] = [
  "financeiro.ver",
  "financeiro.lancar",
  "financeiro.baixar",
  "financeiro.editar",
  "financeiro.excluir",
  "financeiro.ver_todos",
  "dashboard.financeiro",
  "crm.ver",
  "estoque.ver",
  "estoque.ver_custos",
  "os.ver_custos",
  "os.ver",
  "os.ver_todas",
  "caixa.ver",
  "caixa.ver_todos",
  "metas.ver",
  "auditoria.ver",
];

export type DefinicaoCargoPadrao = {
  nome: NomeCargoPadrao;
  descricao: string;
  fixo: boolean;
  permissoes: readonly Permissao[];
};

export const CARGOS_PADRAO: readonly DefinicaoCargoPadrao[] = [
  {
    nome: "Administrador",
    descricao: "Acesso total ao sistema. Não pode ser editado, renomeado ou arquivado.",
    fixo: true,
    permissoes: CATALOGO_PERMISSOES,
  },
  {
    nome: "Gerente",
    descricao: "Acesso total ao sistema, exceto as configurações de empresa, sistema e usuários.",
    fixo: false,
    permissoes: PERMISSOES_GERENTE_PADRAO,
  },
  {
    nome: "Técnico",
    descricao: "Executa ordens de serviço: cria, edita, finaliza e reabre OS; consulta estoque, CRM e metas.",
    fixo: false,
    permissoes: PERMISSOES_TECNICO_PADRAO,
  },
  {
    nome: "Atendente",
    descricao: "Atendimento e frente de caixa: cria e edita OS, vende no PDV, abre e fecha caixa, consulta CRM e estoque.",
    fixo: false,
    permissoes: PERMISSOES_ATENDENTE_PADRAO,
  },
  {
    nome: "Financeiro",
    descricao: "Módulo financeiro completo, com visão de custos de OS e estoque e do dashboard financeiro.",
    fixo: false,
    permissoes: PERMISSOES_FINANCEIRO_PADRAO,
  },
];
