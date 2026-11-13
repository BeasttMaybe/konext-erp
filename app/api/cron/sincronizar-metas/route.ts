import { NextRequest, NextResponse } from "next/server";
import { decidirAutorizacaoDoCron } from "@/lib/cron/autorizacao";
import { CHAMADA_INTERNA } from "@/lib/auth/chamada-interna";

import { prismaCentral } from "@/lib/central/prisma-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { conexaoDoTenant } from "@/lib/tenant/resolver-conexao-tenant";
import { sincronizarMetasAutomaticasDoTenant } from "@/app/actions/metas";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";
import type { PrismaClient } from "@prisma/client";

/**
 * Sincroniza as metas automáticas de todos os tenants ativos.
 *
 * Antes disto, nada puxava o número de uma meta automática: a sincronização
 * só rodava no clique de um botão. A conta estava certa e nunca era
 * executada — era isso o "parte funciona e os dados não se cruzam".
 *
 * Mesma proteção do `verificar-vencimentos`: Bearer com `CRON_SECRET`, e um
 * tenant que falha não derruba os outros — a falha entra no relatório da
 * resposta em vez de abortar a rota.
 */
export async function GET(request: NextRequest) {
  const autorizacao = decidirAutorizacaoDoCron({
    cabecalho: request.headers.get("authorization"),
    segredo: process.env.CRON_SECRET,
    ambiente: process.env.NODE_ENV,
  });

  if (!autorizacao.autorizado) {
    return NextResponse.json({ error: autorizacao.erro }, { status: autorizacao.status });
  }

  try {
    const tenantsAtivos = await prismaCentral.tenant.findMany({
      where: { status: "ATIVO" },
      select: { id: true, slug: true, connectionRef: true },
    });

    let metasVerificadas = 0;
    let metasAtualizadas = 0;
    let metasComFalha = 0;
    let tenantsProcessados = 0;
    const falhas: Array<{ tenantId: string; tenantSlug: string; erro: string }> = [];

    for (const tenant of tenantsAtivos) {
      if (!tenant.connectionRef) {
        falhas.push({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          erro: "Tenant sem connectionRef.",
        });
        continue;
      }

      try {
        const connectionString = await conexaoDoTenant(tenant);
        const prismaTenant = obterPrismaTenant({
          tenantId: tenant.id,
          connectionString,
        });

        const fusoHorario = await resolverFusoHorarioTenant(prismaTenant);
        const resultado = await sincronizarMetasAutomaticasDoTenant(CHAMADA_INTERNA, prismaTenant, fusoHorario);

        metasVerificadas += resultado.verificadas;
        metasAtualizadas += resultado.atualizadas;
        metasComFalha += resultado.falhas;
        tenantsProcessados += 1;
      } catch (erro) {
        falhas.push({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          erro: erro instanceof Error ? erro.message : String(erro),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      tenantsProcessados,
      metasVerificadas,
      metasAtualizadas,
      metasComFalha,
      falhas,
    });
  } catch (erro) {
    console.error("[cron:sincronizar-metas] falha geral", erro);

    return NextResponse.json({ error: "Falha ao sincronizar metas automaticas." }, { status: 500 });
  }
}

/**
 * Fuso da loja por tenant. Este endpoint roda fora de
 * `exigirContextoTenant` (é chamado pelo cron), e "este mês" de uma meta
 * depende do fuso da loja — a Vercel roda em UTC, e decidir o período com o
 * fuso do processo erraria a janela por até 3 horas, o que no primeiro e no
 * último dia do mês muda o número.
 */
async function resolverFusoHorarioTenant(prisma: PrismaClient): Promise<string> {
  try {
    const configuracao = await prisma.configuracao.findFirst({
      select: { fusoHorario: true },
      orderBy: { criadoEm: "asc" },
    });

    return configuracao?.fusoHorario?.trim() || FUSO_HORARIO_PADRAO;
  } catch {
    return FUSO_HORARIO_PADRAO;
  }
}
