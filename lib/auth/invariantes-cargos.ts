import type { Permissao } from "@/lib/auth/permissoes";

/**
 * Regras de negocio que protegem o sistema de cargos configuraveis (Fase
 * 1D-1) — dominio puro, sem Prisma, React ou Next. Quem chama faz as
 * consultas e passa os fatos ja resolvidos; cada funcao aqui so decide se a
 * operacao pode prosseguir e, se nao puder, por que (mensagem pt-BR pronta
 * pra exibir).
 */

export type ResultadoInvarianteCargo = { permitido: true } | { permitido: false; motivo: string };

const PERMITIDO: ResultadoInvarianteCargo = { permitido: true };

function negado(motivo: string): ResultadoInvarianteCargo {
  return { permitido: false, motivo };
}

// ============================================================================
// 1. O cargo Administrador e fixo: permissoes, nome e arquivamento travados.
// ============================================================================

export type CargoFixavel = { fixo: boolean };

export function podeEditarPermissoesDoCargo(cargo: CargoFixavel): ResultadoInvarianteCargo {
  if (cargo.fixo) {
    return negado("O cargo Administrador é fixo: suas permissões não podem ser alteradas.");
  }
  return PERMITIDO;
}

export function podeRenomearCargo(cargo: CargoFixavel): ResultadoInvarianteCargo {
  if (cargo.fixo) {
    return negado("O cargo Administrador é fixo: não pode ser renomeado.");
  }
  return PERMITIDO;
}

// ============================================================================
// 2. Uma empresa sempre precisa de pelo menos 1 usuario ATIVO com acesso a
//    configuracoes.usuarios ("quem gerencia usuarios e cargos").
// ============================================================================

export type UsuarioComAcessoAdmin = {
  usuarioId: string;
  ativo: boolean;
  possuiConfiguracoesUsuarios: boolean;
};

/** Quantos usuarios ATIVOS com configuracoes.usuarios existem no conjunto informado. */
export function contarAdminsAtivos(usuarios: readonly UsuarioComAcessoAdmin[]): number {
  return usuarios.filter((usuario) => usuario.ativo && usuario.possuiConfiguracoesUsuarios).length;
}

/**
 * Confere se e seguro tirar o acesso admin de `usuarioAlvoId` — mudar de
 * cargo pra um sem configuracoes.usuarios, ou desativar o usuario. `usuarios`
 * deve conter TODOS os vinculos da empresa (inclusive o alvo, com o estado
 * ATUAL, antes da operacao) — nao so os que ja tem acesso admin.
 */
export function podeRemoverAcessoAdminDoUsuario(
  usuarios: readonly UsuarioComAcessoAdmin[],
  usuarioAlvoId: string
): ResultadoInvarianteCargo {
  const alvo = usuarios.find((usuario) => usuario.usuarioId === usuarioAlvoId);

  if (!alvo?.ativo || !alvo.possuiConfiguracoesUsuarios) {
    // Alvo nao tinha acesso admin ativo pra comecar — nada a proteger.
    return PERMITIDO;
  }

  const restantes = usuarios.filter(
    (usuario) => usuario.usuarioId !== usuarioAlvoId && usuario.ativo && usuario.possuiConfiguracoesUsuarios
  );

  if (restantes.length === 0) {
    return negado(
      "Esta é a única pessoa ativa com acesso a configurações e usuários nesta empresa. Conceda esse acesso a outra pessoa antes de continuar."
    );
  }

  return PERMITIDO;
}

// ============================================================================
// 3. Um cargo em uso nao pode ser arquivado ate seus usuarios serem movidos.
// ============================================================================

export function podeArquivarCargo(cargo: {
  fixo: boolean;
  quantidadeUsuariosAtivos: number;
}): ResultadoInvarianteCargo {
  if (cargo.fixo) {
    return negado("O cargo Administrador é fixo: não pode ser arquivado.");
  }

  if (cargo.quantidadeUsuariosAtivos > 0) {
    const plural = cargo.quantidadeUsuariosAtivos === 1 ? "1 usuário está" : `${cargo.quantidadeUsuariosAtivos} usuários estão`;
    return negado(`Este cargo não pode ser arquivado: ${plural} atribuído(s) a ele. Mova-os para outro cargo antes.`);
  }

  return PERMITIDO;
}

// ============================================================================
// 4. Ninguem concede permissao que nao tem, nem edita o proprio cargo.
// ============================================================================

export function podeConcederPermissoes(params: {
  permissoesDoAutor: ReadonlySet<Permissao>;
  permissoesAlvo: readonly Permissao[];
}): ResultadoInvarianteCargo {
  const semPermissao = params.permissoesAlvo.filter((permissao) => !params.permissoesDoAutor.has(permissao));

  if (semPermissao.length > 0) {
    return negado(`Você não pode conceder uma permissão que não possui: ${semPermissao.join(", ")}.`);
  }

  return PERMITIDO;
}

/** Ninguem pode trocar o proprio cargo (atribuir outro cargo a si mesmo). */
export function podeAtribuirCargoAoUsuario(params: {
  autorUsuarioCentralId: string;
  usuarioAlvoCentralId: string;
}): ResultadoInvarianteCargo {
  if (params.autorUsuarioCentralId === params.usuarioAlvoCentralId) {
    return negado("Você não pode alterar o seu próprio cargo.");
  }
  return PERMITIDO;
}

/** Ninguem pode editar as permissoes do cargo que ele proprio ocupa. */
export function podeEditarPermissoesConsiderandoAutor(params: {
  autorUsuarioCentralId: string;
  usuariosDoCargoIds: readonly string[];
}): ResultadoInvarianteCargo {
  if (params.usuariosDoCargoIds.includes(params.autorUsuarioCentralId)) {
    return negado("Você não pode editar as permissões do seu próprio cargo.");
  }
  return PERMITIDO;
}
