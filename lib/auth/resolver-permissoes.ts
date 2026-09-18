import { cache } from "react";
import { prismaCentral } from "@/lib/central/prisma-central";
import { CATALOGO_PERMISSOES, ehPermissao, permissoesDoPapel, type PapelEmpresa, type Permissao } from "@/lib/auth/permissoes";

/**
 * Resolve as permissoes efetivas do vinculo UsuarioEmpresa (Fase 1D-1):
 * le o Cargo atribuido e devolve o catalogo inteiro se ele for fixo
 * (Administrador — ver lib/auth/invariantes-cargos.ts) ou o conjunto de
 * CargoPermissao caso contrario.
 *
 * `cache()` do React memoriza por REQUISICAO: a mesma dupla
 * (usuarioCentralId, empresaId) so bate no banco uma vez, nao importa quantas
 * vezes exigirContextoTenant for chamado dentro da mesma renderizacao/acao —
 * e o cache nunca atravessa pra a proxima requisicao (Next.js cria um
 * escopo novo a cada uma). E por isso que uma mudanca de cargo/permissao
 * vale a partir da PROXIMA requisicao do usuario, sem precisar relogar: nao
 * ha nenhum dado de permissao gravado no cookie nem em cache de processo —
 * so o token opaco da sessao, resolvido do zero a cada chamada.
 *
 * Nunca lanca: sem cargo atribuido, ou qualquer falha ao consultar o banco
 * central, cai pra matriz legada (permissoesDoPapel) e registra
 * console.error — a requisicao nunca falha por causa disso.
 */
export const resolverPermissoesEfetivas = cache(
  async (
    usuarioCentralId: string,
    empresaId: string,
    papelLegado: PapelEmpresa
  ): Promise<ReadonlySet<Permissao>> => {
    try {
      const vinculo = await prismaCentral.usuarioEmpresa.findUnique({
        where: {
          usuarioId_empresaId: {
            usuarioId: usuarioCentralId,
            empresaId,
          },
        },
        select: {
          empresa: { select: { nome: true } },
          cargo: {
            select: {
              fixo: true,
              permissoes: {
                select: { permissao: true },
              },
            },
          },
        },
      });

      if (!vinculo?.cargo) {
        const nomeEmpresa = vinculo?.empresa?.nome ?? empresaId;
        console.error(
          `[permissoes] ALERTA: usuário sem cargo atribuído na empresa "${nomeEmpresa}" — usando a matriz legada (papel ${papelLegado}) até o cargo ser corrigido.`
        );
        return permissoesDoPapel(papelLegado);
      }

      if (vinculo.cargo.fixo) {
        return new Set(CATALOGO_PERMISSOES);
      }

      const permissoes = vinculo.cargo.permissoes
        .map((linha) => linha.permissao)
        .filter(ehPermissao);

      return new Set(permissoes);
    } catch (erro) {
      const nomeEmpresa = await obterNomeEmpresaParaLog(empresaId);
      console.error(
        `[permissoes] ALERTA: falha ao consultar o cargo do usuário na empresa "${nomeEmpresa}" — usando a matriz legada (papel ${papelLegado}). Erro: ${erro instanceof Error ? erro.message : String(erro)}`
      );
      return permissoesDoPapel(papelLegado);
    }
  }
);

/** So pra deixar o log do catch legivel — se ate isso falhar, cai pro id mesmo. */
async function obterNomeEmpresaParaLog(empresaId: string): Promise<string> {
  try {
    const empresa = await prismaCentral.empresa.findUnique({ where: { id: empresaId }, select: { nome: true } });
    return empresa?.nome ?? empresaId;
  } catch {
    return empresaId;
  }
}
