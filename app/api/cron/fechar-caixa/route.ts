import { NextRequest, NextResponse } from "next/server";
import { decidirAutorizacaoDoCron } from "@/lib/cron/autorizacao";

import { prismaCentral } from "@/lib/central/prisma-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { conexaoDoTenant } from "@/lib/tenant/resolver-conexao-tenant";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { deDecimal, paraDecimal, somar } from "@/lib/dinheiro";
import { calcularEsperadoFechamento } from "@/lib/dominio/financeiro/estorno";
import {
  decidirFechamentoAutomatico,
  type CaixaParaFechar,
} from "@/lib/dominio/caixa/fechamento-automatico";

/**
 * GET /api/cron/fechar-caixa
 *
 * Fecha o caixa que passou do horário configurado.
 *
 * O QUE ESTA ROTINA CONSERTA
 *
 * A configuração "Fechamento automático do caixa" existia, com horário e
 * tudo — e o sistema só DESENHAVA um aviso na tela do caixa dizendo
 * "Fechamento automático 23:59". Nada fechava. O dono podia ligar a opção,
 * ver o aviso todo dia e confiar nela enquanto o caixa seguia aberto a noite
 * inteira. Opção que promete e não cumpre é pior que opção que não existe.
 *
 * A REGRA NÃO MORA AQUI
 *
 * Quem decide o que está atrasado é `lib/dominio/caixa/fechamento-automatico`,
 * puro e com 13 testes — inclusive o caso do caixa esquecido aberto há dias e
 * o do servidor em UTC enquanto a loja está em São Paulo. Aqui fica só o que
 * precisa de banco: ler os caixas abertos, somar o esperado, gravar.
 *
 * UMA VEZ POR DIA, ÀS 00:05 DE BRASÍLIA (03:05 UTC)
 *
 * A primeira versão rodava de hora em hora, e isso PAROU TODOS OS DEPLOYS:
 * o plano Hobby da Vercel só aceita rotinas diárias e recusa o build inteiro
 * quando uma não é — de 10/11 a 11/11 nenhuma publicação entrou no ar.
 * Guardado por lib/cron/agenda-da-vercel.test.ts.
 *
 * Uma vez por dia basta porque a regra OLHA PARA TRÁS: fecha todo caixa
 * aberto antes da última passagem pelo horário configurado, e grava como
 * data de fechamento esse horário, não o da execução. Às 00:05, o horário de
 * qualquer loja (padrão 23:59) já passou. No Hobby a Vercel pode disparar em
 * qualquer minuto daquela hora — continua sendo depois da meia-noite.
 */

type DecimalPrisma = { toString(): string };

type PrismaDoTenant = {
  configuracao: {
    findFirst: (args: unknown) => Promise<{
      fechamentoAutomaticoCaixaAtivo: boolean | null;
      fechamentoAutomaticoCaixaHorario: string | null;
      fusoHorario: string | null;
    } | null>;
  };
  caixaSession: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        dataAbertura: Date;
        valorAbertura: DecimalPrisma;
        vendas: Array<{ valorTotal: DecimalPrisma }>;
        vendasEstornadasAqui: Array<{ valorTotal: DecimalPrisma }>;
      }>
    >;
    update: (args: unknown) => Promise<unknown>;
  };
};

type ResumoDoTenant = {
  fechados: number;
  /** ISO do instante usado como corte, para o log dizer POR QUE fechou. */
  limite: string | null;
};

async function processarTenant(prisma: PrismaDoTenant, agora: Date): Promise<ResumoDoTenant> {
  const configuracao = await prisma.configuracao.findFirst({
    orderBy: { criadoEm: "asc" },
    select: {
      fechamentoAutomaticoCaixaAtivo: true,
      fechamentoAutomaticoCaixaHorario: true,
      fusoHorario: true,
    },
  });

  if (!configuracao?.fechamentoAutomaticoCaixaAtivo) {
    return { fechados: 0, limite: null };
  }

  const abertos = await prisma.caixaSession.findMany({
    where: { status: "ABERTO" },
    select: {
      id: true,
      dataAbertura: true,
      valorAbertura: true,
      vendas: { select: { valorTotal: true } },
      vendasEstornadasAqui: { select: { valorTotal: true } },
    },
  });

  const decisao = decidirFechamentoAutomatico({
    ativo: true,
    horarioTexto: configuracao.fechamentoAutomaticoCaixaHorario,
    fusoHorario: configuracao.fusoHorario || FUSO_HORARIO_PADRAO,
    agora,
    caixasAbertos: abertos.map(
      (caixa): CaixaParaFechar => ({ id: caixa.id, dataAbertura: caixa.dataAbertura })
    ),
  });

  if (!decisao) return { fechados: 0, limite: null };

  const porId = new Map(abertos.map((caixa) => [caixa.id, caixa]));
  let fechados = 0;

  for (const alvo of decisao.aFechar) {
    const caixa = porId.get(alvo.id);
    if (!caixa) continue;

    // O VALOR DE FECHAMENTO É O ESPERADO, e não um valor contado.
    //
    // Não há ninguém contando a gaveta às 23:59. O esperado é a única coisa
    // honesta a gravar. A diferença entre esperado e contado — que é o ponto
    // do fechamento manual — não existe aqui, e inventar um valor contado
    // seria fabricar uma conferência que ninguém fez.
    //
    // E O ESPERADO É O DA REGRA, NÃO UMA CONTA PARECIDA.
    //
    // A primeira versão desta rotina somava "abertura + vendas não
    // estornadas". Parece a mesma coisa que a regra de estorno
    // (`calcularEsperadoFechamento`), e não é: pela regra, a venda NUNCA sai
    // da sessão em que foi feita, e o estorno é descontado da sessão que o
    // ABSORVEU — a que estava aberta quando o dinheiro saiu da gaveta.
    //
    // As duas contas só coincidem quando a venda é estornada no mesmo caixa
    // em que foi feita. Num caixa que devolveu o dinheiro de uma venda de
    // OUTRO dia, a conta antiga não descontava nada: gravava um fechamento
    // maior que o esperado, e o histórico — que usa a regra — passava a
    // mostrar uma "sobra" que nunca existiu, do valor exato do estorno.
    //
    // Agora a rotina grava o que o histórico vai recalcular, pela mesma
    // função. A diferença de um fechamento automático é zero por construção.
    const esperado = calcularEsperadoFechamento({
      aberturaCentavos: deDecimal(caixa.valorAbertura),
      vendasDaSessaoCentavos: somar(...caixa.vendas.map((venda) => deDecimal(venda.valorTotal))),
      estornosAbsorvidosCentavos: somar(
        ...caixa.vendasEstornadasAqui.map((venda) => deDecimal(venda.valorTotal))
      ),
    });

    await prisma.caixaSession.update({
      where: { id: caixa.id },
      data: {
        status: "FECHADO",
        valorFechamento: paraDecimal(esperado),
        // A data de fechamento é o HORÁRIO CONFIGURADO, não o instante em que
        // esta rotina rodou. O caixa das 23:59 que fechou na execução de
        // 00:00 pertence ao dia anterior — gravar 00:00 jogaria o fechamento
        // para o dia seguinte nos relatórios.
        dataFechamento: decisao.limite,
      },
    });

    fechados += 1;
  }

  return { fechados, limite: decisao.limite.toISOString() };
}

export async function GET(request: NextRequest) {
  const autorizacao = decidirAutorizacaoDoCron({
    cabecalho: request.headers.get("authorization"),
    segredo: process.env.CRON_SECRET,
    ambiente: process.env.NODE_ENV,
  });

  if (!autorizacao.autorizado) {
    return NextResponse.json({ error: autorizacao.erro }, { status: autorizacao.status });
  }

  const agora = new Date();

  try {
    const tenantsAtivos = await prismaCentral.tenant.findMany({
      where: { status: "ATIVO" },
      select: { id: true, slug: true, connectionRef: true },
    });

    let fechados = 0;
    const porTenant: Array<{ tenantSlug: string } & ResumoDoTenant> = [];
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
        const prismaTenant = obterPrismaTenant({
          tenantId: tenant.id,
          connectionString: await conexaoDoTenant(tenant),
        }) as unknown as PrismaDoTenant;

        const resumo = await processarTenant(prismaTenant, agora);

        fechados += resumo.fechados;
        porTenant.push({ tenantSlug: tenant.slug, ...resumo });
      } catch (erro) {
        // Um tenant com problema não pode deixar o caixa dos outros aberto.
        falhas.push({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          erro: erro instanceof Error ? erro.message : String(erro),
        });
      }
    }

    return NextResponse.json({
      success: true,
      fechados,
      tenantsProcessados: porTenant.length,
      porTenant,
      falhas,
    });
  } catch (erro) {
    console.error("Erro no cron de fechamento de caixa:", erro);
    return NextResponse.json(
      { error: erro instanceof Error ? erro.message : "Erro desconhecido." },
      { status: 500 }
    );
  }
}
