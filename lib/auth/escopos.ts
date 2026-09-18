import type { Prisma } from "@prisma/client";
import { temPermissao } from "@/lib/auth/permissoes";
import type { ContextoTenantSeguro } from "@/types/tenant";

/**
 * Decisao de escopo de visibilidade (Fase 1D-2) — UNICA fonte de verdade.
 * Cada funcao devolve um fragmento de `where` do Prisma pra area
 * correspondente, sempre aplicado no banco (nunca filtrado depois, na UI ou
 * em memoria): sem a permissao "_todas"/"_todos", o fragmento restringe aos
 * proprios registros; com ela, `{}` (sem restricao nenhuma).
 *
 * Nenhuma tela deve montar seu proprio filtro de "isso e meu" — sempre
 * chama uma destas funcoes e faz `AND` (spread) com o resto do `where`.
 *
 * Sem `usuarioOperacional.id` (sessao central valida mas sem Usuario do
 * tenant mapeado por e-mail — ver lib/tenant/exigir-contexto-tenant.ts),
 * nao ha como saber "o que e meu": falha fechado, devolvendo um `where`
 * que nunca bate com nada, em vez de vazar tudo.
 */

const FILTRO_SEM_RESULTADO = { id: "__sem_usuario_operacional_mapeado__" } as const;

function usuarioOperacionalId(contexto: ContextoTenantSeguro): string | null {
  const id = contexto.usuarioOperacional?.id;
  return id ? id : null;
}

/**
 * OS: sem `os.ver_todas`, só as que o usuário criou OU em que aparece como
 * técnico (TecnicoOS). Usada no quadro, na lista de finalizadas, na aba de
 * garantia, na busca, nos contadores e na rota de detalhe da OS.
 */
export function escopoOrdemServico(contexto: ContextoTenantSeguro): Prisma.OrdemServicoWhereInput {
  if (temPermissao(contexto, "os.ver_todas")) {
    return {};
  }

  const usuarioId = usuarioOperacionalId(contexto);
  if (!usuarioId) {
    return FILTRO_SEM_RESULTADO;
  }

  return {
    OR: [{ criadoPorId: usuarioId }, { tecnicos: { some: { usuarioId } } }],
  };
}

/** Caixa: sem `caixa.ver_todos`, só as sessões que o usuário abriu. */
export function escopoCaixaSession(contexto: ContextoTenantSeguro): Prisma.CaixaSessionWhereInput {
  if (temPermissao(contexto, "caixa.ver_todos")) {
    return {};
  }

  const usuarioId = usuarioOperacionalId(contexto);
  if (!usuarioId) {
    return FILTRO_SEM_RESULTADO;
  }

  return { abertoPorId: usuarioId };
}

/** Financeiro (contas a receber): sem `financeiro.ver_todos`, só os lançamentos que o usuário criou. */
export function escopoContaReceber(contexto: ContextoTenantSeguro): Prisma.ContaReceberWhereInput {
  if (temPermissao(contexto, "financeiro.ver_todos")) {
    return {};
  }

  const usuarioId = usuarioOperacionalId(contexto);
  if (!usuarioId) {
    return FILTRO_SEM_RESULTADO;
  }

  return { criadoPorId: usuarioId };
}

/** Financeiro (despesas/contas a pagar): mesma regra de escopoContaReceber. */
export function escopoDespesa(contexto: ContextoTenantSeguro): Prisma.DespesaWhereInput {
  if (temPermissao(contexto, "financeiro.ver_todos")) {
    return {};
  }

  const usuarioId = usuarioOperacionalId(contexto);
  if (!usuarioId) {
    return FILTRO_SEM_RESULTADO;
  }

  return { criadoPorId: usuarioId };
}
