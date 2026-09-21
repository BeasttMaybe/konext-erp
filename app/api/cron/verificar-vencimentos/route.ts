import { NextRequest, NextResponse } from "next/server";
import { prismaCentral } from "@/lib/central/prisma-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { resolverConexaoTenant } from "@/lib/tenant/resolver-conexao-tenant";
import {
  FUSO_HORARIO_PADRAO,
  hojeComoDataDeCalendario,
  somarDiasEmDataDeCalendario,
} from "@/lib/datas";

type ContaVencimento = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: Date;
  status: string;
  tipo: string;
  cliente: { nome: string } | null;
};

type ContaDelegate = {
  findMany?: (args: unknown) => Promise<ContaVencimento[]>;
};

type NotificacaoDelegate = {
  findFirst?: (args: unknown) => Promise<{ id: string } | null>;
  create?: (args: unknown) => Promise<unknown>;
};

type ConfiguracaoDelegate = {
  findFirst?: (args: unknown) => Promise<{ fusoHorario?: string | null } | null>;
};

/**
 * Fuso horário da loja (Fase 2A-1) — este endpoint roda fora de
 * exigirContextoTenant (é chamado pelo cron, não por uma requisição de
 * usuário), então resolve `Configuracao.fusoHorario` direto por tenant.
 * Nunca decide "vence hoje"/"vence amanhã" com o fuso do processo (a Vercel
 * roda em UTC) — ver lib/datas.ts.
 */
async function resolverFusoHorarioTenant(prisma: {
  configuracao?: ConfiguracaoDelegate;
  Configuracao?: ConfiguracaoDelegate;
}): Promise<string> {
  try {
    const delegate = prisma.configuracao ?? prisma.Configuracao;
    const configuracao = await delegate?.findFirst?.({
      orderBy: { criadoEm: "asc" },
      select: { fusoHorario: true },
    });
    const valor = configuracao?.fusoHorario?.trim();
    return valor && valor.length > 0 ? valor : FUSO_HORARIO_PADRAO;
  } catch {
    return FUSO_HORARIO_PADRAO;
  }
}

/**
 * GET /api/cron/verificar-vencimentos
 *
 * Verifica contas (a pagar e a receber) que vencem hoje ou amanhã com status PENDENTE
 * e cria notificações no sistema.
 *
 * Protegido por Authorization Bearer token (CRON_SECRET) para evitar execuções não autorizadas.
 * Configurar a variável de ambiente CRON_SECRET no ambiente de produção.
 * Ideal para ser chamado por um agendador (Vercel Cron, Cron-job.org, etc.) uma vez por dia.
 */
async function processarVencimentosTenant(prisma: {
  conta?: ContaDelegate;
  Conta?: ContaDelegate;
  notificacao?: NotificacaoDelegate;
  Notificacao?: NotificacaoDelegate;
  configuracao?: ConfiguracaoDelegate;
  Configuracao?: ConfiguracaoDelegate;
}): Promise<number> {
  const contaDelegate = prisma.conta ?? prisma.Conta;
  const notifDelegate = prisma.notificacao ?? prisma.Notificacao;

  if (!contaDelegate?.findMany || !notifDelegate?.create) {
    throw new Error("Delegates Prisma necessarios nao estao disponiveis no tenant.");
  }

  // `Conta.vencimento` é DATA DE CALENDÁRIO (dia puro, sem hora
  // significativa — mesma convenção de `ContaReceber.dataVencimento`):
  // guardada como meia-noite UTC, nunca meia-noite do fuso da loja. Resolver
  // "hoje"/"amanhã" primeiro no fuso da loja e SÓ DEPOIS representar como
  // meia-noite UTC (`hojeComoDataDeCalendario`) evita marcar uma conta que
  // vence hoje como atrasada logo depois da meia-noite UTC (21h no horário
  // da loja) — ver lib/datas.ts.
  const fusoHorario = await resolverFusoHorarioTenant(prisma);
  const inicioDiaAtual = hojeComoDataDeCalendario(fusoHorario);
  const inicioAmanha = somarDiasEmDataDeCalendario(inicioDiaAtual, 1);

  // `vencimento` só existe como meia-noite exata (dia puro), então "hoje ou
  // amanhã" é exatamente esses dois valores — sem precisar de uma fronteira
  // de "fim do dia" separada.
  const contas = await contaDelegate.findMany({
    where: {
      status: "PENDENTE",
      vencimento: {
        gte: inicioDiaAtual,
        lte: inicioAmanha,
      },
    },
    select: {
      id: true,
      descricao: true,
      valor: true,
      vencimento: true,
      status: true,
      tipo: true,
      cliente: {
        select: { nome: true },
      },
    },
  });

  if (contas.length === 0) {
    return 0;
  }

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

  let notificationsCreated = 0;

  for (const conta of contas) {
    const venceHoje = conta.vencimento >= inicioDiaAtual && conta.vencimento < inicioAmanha;
    const prazo = venceHoje ? "hoje" : "amanha";

    const nomeContraparte = conta.cliente?.nome ?? conta.descricao;
    const valorFormatado = formatarMoeda(conta.valor);

    let titulo: string;
    let mensagem: string;

    if (conta.tipo === "PAGAR") {
      titulo = "Conta a Pagar Vencendo";
      mensagem = `Conta a Pagar vence ${prazo}: ${valorFormatado} - ${nomeContraparte}`;
    } else {
      titulo = "Conta a Receber Vencendo";
      mensagem = `Conta a Receber vence ${prazo}: ${valorFormatado} - ${nomeContraparte}`;
    }

    try {
      const notifExistente = await notifDelegate.findFirst?.({
        where: {
          lida: false,
          mensagem: { contains: nomeContraparte },
          titulo,
        },
      });

      if (!notifExistente) {
        await notifDelegate.create({
          data: { titulo, mensagem },
        });
        notificationsCreated++;
      }
    } catch {
      // Falhas pontuais de registro nao interrompem o restante do tenant.
    }
  }

  return notificationsCreated;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const tenantsAtivos = await prismaCentral.tenant.findMany({
      where: { status: "ATIVO" },
      select: {
        id: true,
        slug: true,
        connectionRef: true,
      },
    });

    let notificationsCreated = 0;
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
        const connectionString = resolverConexaoTenant(tenant.connectionRef);
        const prismaTenant = obterPrismaTenant({
          tenantId: tenant.id,
          connectionString,
        }) as unknown as {
          conta?: ContaDelegate;
          Conta?: ContaDelegate;
          notificacao?: NotificacaoDelegate;
          Notificacao?: NotificacaoDelegate;
        };

        const criadasNoTenant = await processarVencimentosTenant(prismaTenant);
        notificationsCreated += criadasNoTenant;
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
      success: true,
      notificationsCreated,
      tenantsProcessados,
      tenantsComFalha: falhas.length,
      falhas,
    });
  } catch (erro) {
    return NextResponse.json(
      {
        success: false,
        error: erro instanceof Error ? erro.message : String(erro),
      },
      { status: 500 }
    );
  }
}
