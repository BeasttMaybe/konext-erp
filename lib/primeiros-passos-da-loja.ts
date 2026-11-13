import "server-only";

import { prismaCentral } from "@/lib/central/prisma-central";
import { ID_CLIENTE_CONSUMIDOR_FINAL } from "@/lib/dominio/crm/consumidor-final";
import { dadosDaEmpresaCompletos, montarPrimeirosPassos, type PassoInicial } from "@/lib/dominio/primeiros-passos";
import { IDS_DE_MODULO } from "@/lib/modulos/catalogo";
import type { ContextoTenantServidor } from "@/types/tenant";

/**
 * Le os fatos da loja para os "Primeiros passos" (lib/dominio/primeiros-passos.ts).
 * Contagens com `take` pequeno: so importa se ha 0, 1 ou "mais de um".
 * Nunca lanca — sem a lista, o Dashboard segue igual.
 */
export async function primeirosPassosDaLoja(
  contexto: ContextoTenantServidor,
  configuracao: { razaoSocial?: string | null; cnpj?: string | null; telefone?: string | null; endereco?: string | null; logoUrl?: string | null }
): Promise<PassoInicial[] | null> {
  try {
    const prisma = contexto.prisma;
    const [usuariosAtivos, assinatura, clientes, produtos, ordens] = await Promise.all([
      prismaCentral.usuarioEmpresa.count({ where: { empresaId: contexto.empresaId, ativo: true } }),
      contexto.usuarioOperacional.id
        ? prisma.assinaturaUsuario.findUnique({ where: { usuarioId: contexto.usuarioOperacional.id }, select: { usuarioId: true } })
        : Promise.resolve(null),
      prisma.cliente.count({ where: { id: { not: ID_CLIENTE_CONSUMIDOR_FINAL } }, take: 1 }),
      prisma.produto.count({ take: 1 }),
      prisma.ordemServico.count({ take: 1 }),
    ]);
    return montarPrimeirosPassos(
      {
        dadosDaEmpresa: dadosDaEmpresaCompletos(configuracao),
        logo: Boolean(configuracao.logoUrl?.trim()),
        usuariosAtivos,
        minhaAssinatura: Boolean(assinatura),
        clientes,
        produtos,
        ordensDeServico: ordens,
      },
      contexto.modulosAtivos ?? new Set(IDS_DE_MODULO)
    );
  } catch (erro) {
    console.error("[primeiros-passos] leitura falhou", erro instanceof Error ? erro.message : erro);
    return null;
  }
}
