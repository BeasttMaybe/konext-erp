import type { ContextoTenantServidor } from "@/types/tenant";

/**
 * Papeis do vinculo UsuarioEmpresa no banco central.
 * `exigirContextoTenant` propaga esse valor em `usuarioOperacional.role`.
 */
export type PapelEmpresa = "ADMIN" | "GESTOR" | "USUARIO";

export const PAPEIS_EMPRESA: readonly PapelEmpresa[] = ["ADMIN", "GESTOR", "USUARIO"];

const ROTULOS_PAPEL: Readonly<Record<PapelEmpresa, string>> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  USUARIO: "Usuário",
};

/**
 * Erro de regra de negocio por falta de permissao.
 * Classe propria para que as actions distingam "nao pode" de "deu errado" sem
 * recorrer a comparacao de string de mensagem, padrao que o codebase usa hoje
 * em varios pontos (AUDIT_REPORT F-37).
 */
export class ErroPermissaoNegada extends Error {
  readonly papelAtual: string;
  readonly papeisExigidos: readonly PapelEmpresa[];

  constructor(papelAtual: string, papeisExigidos: readonly PapelEmpresa[]) {
    const exigidos = papeisExigidos.map((papel) => ROTULOS_PAPEL[papel]).join(" ou ");
    super(`Esta ação exige perfil de ${exigidos}. Seu perfil atual é ${rotularPapel(papelAtual)}.`);
    this.name = "ErroPermissaoNegada";
    this.papelAtual = papelAtual;
    this.papeisExigidos = papeisExigidos;
  }
}

export function rotularPapel(papel: string): string {
  return ehPapelEmpresa(papel) ? ROTULOS_PAPEL[papel] : papel || "não identificado";
}

export function ehPapelEmpresa(valor: string): valor is PapelEmpresa {
  return (PAPEIS_EMPRESA as readonly string[]).includes(valor);
}

export function possuiPapel(
  contexto: ContextoTenantServidor,
  papeisPermitidos: readonly PapelEmpresa[]
): boolean {
  const papel = String(contexto.usuarioOperacional.role ?? "").trim().toUpperCase();
  return ehPapelEmpresa(papel) && papeisPermitidos.includes(papel);
}

/**
 * Exige um dos papeis informados, lancando `ErroPermissaoNegada` caso contrario.
 *
 * Isto NAO e um sistema de permissoes: e uma trava pontual para as operacoes
 * destrutivas introduzidas na Fase 1A. O sistema segue sem camada de
 * autorizacao (AUDIT_REPORT F-01), que e trabalho de uma fase propria.
 */
export function exigirPapel(
  contexto: ContextoTenantServidor,
  papeisPermitidos: readonly PapelEmpresa[]
): void {
  if (!possuiPapel(contexto, papeisPermitidos)) {
    throw new ErroPermissaoNegada(
      String(contexto.usuarioOperacional.role ?? ""),
      papeisPermitidos
    );
  }
}
