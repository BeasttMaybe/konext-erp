import { NextRequest, NextResponse } from "next/server";
import { prismaCentral } from "@/lib/central/prisma-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { resolverConexaoTenant } from "@/lib/tenant/resolver-conexao-tenant";

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
}): Promise<number> {
  const contaDelegate = prisma.conta ?? prisma.Conta;
  const notifDelegate = prisma.notificacao ?? prisma.Notificacao;

  if (!contaDelegate?.findMany || !notifDelegate?.create) {
    throw new Error("Delegates Prisma necessarios nao estao disponiveis no tenant.");
  }

  const agora = new Date();
  const inicioDiaAtual = new Date(agora);
  inicioDiaAtual.setHours(0, 0, 0, 0);

  const fimDiaAmanha = new Date(agora);
  fimDiaAmanha.setDate(fimDiaAmanha.getDate() + 1);
  fimDiaAmanha.setHours(23, 59, 59, 999);

  const inicioAmanha = new Date(agora);
  inicioAmanha.setDate(inicioAmanha.getDate() + 1);
  inicioAmanha.setHours(0, 0, 0, 0);

  const contas = await contaDelegate.findMany({
    where: {
      status: "PENDENTE",
      vencimento: {
        gte: inicioDiaAtual,
        lte: fimDiaAmanha,
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
