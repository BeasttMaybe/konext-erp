import "server-only";

import { prismaCentral } from "@/lib/central/prisma-central";
import type { UsuarioComAcessoAdmin } from "@/lib/auth/invariantes-cargos";
import { permissoesEfetivasDoCargo } from "@/lib/auth/permissoes-efetivas-cargo";

/**
 * Todo vinculo da empresa, com se cada um possui (efetivamente) a permissao
 * configuracoes.usuarios — base pra checar a invariante "sempre sobra 1
 * admin ativo" (lib/auth/invariantes-cargos.ts).
 *
 * POR QUE MORA AQUI E NAO EM app/actions/cargos.ts
 *
 * Morava la, exportada de um arquivo "use server" — o que a tornava um
 * endpoint. Ela recebe um `empresaId` e nao confere sessao nenhuma, porque
 * foi escrita para ser chamada por actions que ja conferiram. Como endpoint,
 * respondia a qualquer pessoa, logada ou nao, com a lista de usuarios de
 * QUALQUER empresa: ids, quem esta ativo e quem e administrador.
 *
 * Auxiliar que confia no chamador nao pode ser alcancavel de fora. Aqui,
 * `server-only` garante que so codigo do servidor a importa.
 */
export async function listarUsuariosComAcessoAdmin(empresaId: string): Promise<UsuarioComAcessoAdmin[]> {
  const vinculos = await prismaCentral.usuarioEmpresa.findMany({
    where: { empresaId },
    select: {
      usuarioId: true,
      ativo: true,
      cargo: { select: { fixo: true, permissoes: { select: { permissao: true } } } },
    },
  });

  return vinculos.map((vinculo) => ({
    usuarioId: vinculo.usuarioId,
    ativo: vinculo.ativo,
    possuiConfiguracoesUsuarios: vinculo.cargo
      ? permissoesEfetivasDoCargo(vinculo.cargo).includes("configuracoes.usuarios")
      : false,
  }));
}
