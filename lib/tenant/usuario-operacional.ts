import type { ContextoTenantServidor } from "@/types/tenant";

/**
 * Identidade operacional para gravacao em colunas de id de usuario.
 *
 * `mapearUsuarioOperacional` devolve `id: ""` quando o usuario central nao tem
 * um `Usuario` correspondente no banco do tenant (lib/tenant/exigir-contexto-tenant.ts).
 * Gravar essa string vazia tem dois efeitos ruins, ambos observados em producao
 * (AUDIT_REPORT F-10 e 16.3-2):
 *
 *   - em colunas COM foreign key (OrdemServico.excluidaPorId) o banco rejeita a
 *     linha e a transacao inteira falha — a exclusao de OS simplesmente nao
 *     funciona para esse usuario;
 *   - em colunas SEM foreign key (RetornoGarantiaOS.finalizadoPorId) a string
 *     vazia e gravada em silencio e a autoria se perde.
 *
 * Este modulo centraliza a normalizacao: string vazia ou so espacos vira `null`.
 */
export function obterIdUsuarioOperacionalOuNulo(contexto: ContextoTenantServidor): string | null {
  const idNormalizado = String(contexto.usuarioOperacional.id ?? "").trim();
  return idNormalizado.length > 0 ? idNormalizado : null;
}

/**
 * Mesma normalizacao a partir do usuario ja extraido do contexto, para os
 * pontos que so recebem `contexto.usuarioOperacional`.
 */
export function normalizarIdUsuarioOperacional(
  usuarioOperacional: ContextoTenantServidor["usuarioOperacional"]
): string | null {
  const idNormalizado = String(usuarioOperacional.id ?? "").trim();
  return idNormalizado.length > 0 ? idNormalizado : null;
}

export type AutoriaAuditoria = {
  /** true quando nao ha Usuario operacional correspondente neste tenant. */
  autorSemUsuarioOperacional: true;
  /** Identidade central, para que a autoria nunca se perca. */
  autorUsuarioCentralId: string;
  autorEmail: string;
};

/**
 * Fragmento a ser mesclado em `dadosDepois` da auditoria quando nao existe
 * usuario operacional. Assim a coluna de FK fica null (sem quebrar o banco) mas
 * a trilha ainda registra QUEM fez a operacao.
 *
 * Devolve `{}` quando o mapeamento existe — nesse caso `LogAuditoria.usuarioId`
 * ja identifica o autor.
 */
export function descreverAutoria(
  contexto: ContextoTenantServidor
): AutoriaAuditoria | Record<string, never> {
  if (obterIdUsuarioOperacionalOuNulo(contexto) !== null) {
    return {};
  }

  return {
    autorSemUsuarioOperacional: true,
    autorUsuarioCentralId: contexto.usuarioCentralId,
    autorEmail: contexto.usuarioOperacional.email,
  };
}
