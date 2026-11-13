import "server-only";

import type { PrismaClient } from "@prisma/client";

import { prismaCentral } from "@/lib/central/prisma-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { resolverConexaoTenant } from "@/lib/tenant/resolver-conexao-tenant";

/**
 * Abre o banco de uma loja a partir do slug, SEM sessão.
 *
 * É a peça que faltava para uma rota pública existir num sistema de um banco
 * por loja. Até agora a única rota sem sessão do projeto, o rastreio, estava
 * presa ao banco do tenant principal com um comentário dizendo exatamente
 * isso: faltava "identificador publico seguro".
 *
 * As duas alternativas que este módulo existe para evitar:
 *
 * - **Procurar em todos os bancos.** Transformaria qualquer URL inventada
 *   numa consulta contra a base de todas as lojas, e o tempo de resposta
 *   contaria a quem tentasse em qual banco o valor foi encontrado.
 * - **Um índice central de segredos.** Espalharia a credencial por dois
 *   bancos, e a revogação teria que acertar os dois para valer.
 *
 * Aqui o slug diz qual banco, e só. Quem autoriza é o segredo, que é
 * conferido lá dentro — este módulo não autoriza nada, apenas abre a porta
 * certa. É por isso que ele devolve o cliente do Prisma e nada mais: quem
 * chama ainda precisa provar que pode fazer o que veio fazer.
 */
export type TenantPublico = {
  tenantId: string;
  empresaId: string;
  empresaNome: string;
  prisma: PrismaClient;
};

export async function abrirTenantPorSlug(slug: string): Promise<TenantPublico | null> {
  const tenant = await prismaCentral.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      connectionRef: true,
      empresa: { select: { id: true, nome: true, status: true } },
    },
  });

  if (!tenant || !tenant.connectionRef) return null;

  // Loja suspensa ou tenant fora do ar não atende rota pública nenhuma: o
  // link de uma loja desativada tem que parar de funcionar junto com ela.
  if (tenant.status !== "ATIVO" || tenant.empresa.status !== "ATIVA") return null;

  try {
    return {
      tenantId: tenant.id,
      empresaId: tenant.empresa.id,
      empresaNome: tenant.empresa.nome,
      prisma: obterPrismaTenant({
        tenantId: tenant.id,
        connectionString: resolverConexaoTenant(tenant.connectionRef),
      }),
    };
  } catch {
    // `resolverConexaoTenant` recusa connectionRef fora do padrão e variável
    // de ambiente ausente. Numa rota pública isso vira "link inválido", nunca
    // uma página de erro que conta como o sistema está configurado por dentro.
    return null;
  }
}
