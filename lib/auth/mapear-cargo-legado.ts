import { PERMISSOES_GERENTE_PADRAO } from "@/lib/auth/cargos-padrao";
import type { PapelEmpresa, Permissao } from "@/lib/auth/permissoes";

const PERMISSOES_CONFIGURACOES: readonly Permissao[] = [
  "configuracoes.empresa",
  "configuracoes.sistema",
  "configuracoes.usuarios",
];

const CONJUNTO_GERENTE_PADRAO: ReadonlySet<Permissao> = new Set(PERMISSOES_GERENTE_PADRAO);

export type CargoParaMapeamentoLegado = {
  fixo: boolean;
  permissoes: ReadonlySet<Permissao>;
};

function conjuntosIguais(a: ReadonlySet<Permissao>, b: ReadonlySet<Permissao>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }

  return true;
}

/**
 * Traduz um Cargo (configuravel, Fase 1D-1) pro RoleEmpresa legado mais
 * proximo — UNICA funcao autorizada a fazer essa traducao, usada em toda
 * escrita que atribui ou altera o cargo de um UsuarioEmpresa (ver
 * app/actions/cargos.ts), pra manter a coluna `role` em escrita dupla
 * enquanto ela nao e removida (mesma estrategia de expand/contract usada em
 * EtapaOS na Fase 1C-3 — ver docs/operacao/migrations.md).
 *
 * Regra:
 *   1. fixo (so o Administrador pode ser, por invariante) -> ADMIN.
 *   2. possui qualquer permissao de configuracoes.* -> ADMIN (o legado nunca
 *      concede acesso de configuracao fora de ADMIN; um cargo customizado
 *      com esse acesso precisa do papel legado mais permissivo pra nao
 *      quebrar nenhuma checagem que ainda use `role` em vez do Cargo).
 *   3. bate exatamente com o conjunto padrao do Gerente (catalogo inteiro
 *      menos as 3 de configuracoes) -> GESTOR.
 *   4. qualquer outra coisa -> USUARIO.
 */
export function mapearCargoParaRoleLegado(cargo: CargoParaMapeamentoLegado): PapelEmpresa {
  if (cargo.fixo) {
    return "ADMIN";
  }

  const possuiConfiguracoes = PERMISSOES_CONFIGURACOES.some((permissao) => cargo.permissoes.has(permissao));
  if (possuiConfiguracoes) {
    return "ADMIN";
  }

  if (conjuntosIguais(cargo.permissoes, CONJUNTO_GERENTE_PADRAO)) {
    return "GESTOR";
  }

  return "USUARIO";
}
