import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
export async function GET(request: NextRequest) {
  // Proteção básica por token — impede que terceiros acionem o cron manualmente.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const prismaAny = prisma as typeof prisma & {
    conta?: ContaDelegate;
    Conta?: ContaDelegate;
    notificacao?: NotificacaoDelegate;
    Notificacao?: NotificacaoDelegate;
  };
  const contaDelegate = prismaAny.conta ?? prismaAny.Conta;
  const notifDelegate = prismaAny.notificacao ?? prismaAny.Notificacao;

  if (!contaDelegate?.findMany || !notifDelegate?.create) {
    return NextResponse.json(
      { error: "Delegates Prisma necessários não estão disponíveis." },
      { status: 500 }
    );
  }

  // Janela de verificação: início do dia atual até o fim do dia seguinte.
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
    return NextResponse.json({ success: true, notificationsCreated: 0 });
  }

  // Formata valor em BRL para a mensagem da notificação.
  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

  let notificationsCreated = 0;

  for (const conta of contas) {
    const venceHoje = conta.vencimento >= inicioDiaAtual && conta.vencimento < inicioAmanha;
    const prazo = venceHoje ? "hoje" : "amanhã";

    const nomeContraparte = conta.cliente?.nome ?? conta.descricao;
    const valorFormatado = formatarMoeda(conta.valor);

    let titulo: string;
    let mensagem: string;

    if (conta.tipo === "PAGAR") {
      titulo = "Conta a Pagar Vencendo";
      mensagem = `Conta a Pagar vence ${prazo}: ${valorFormatado} — ${nomeContraparte}`;
    } else {
      titulo = "Conta a Receber Vencendo";
      mensagem = `Conta a Receber vence ${prazo}: ${valorFormatado} — ${nomeContraparte}`;
    }

    try {
      // Evita duplicatas: se já existe notificação não lida para esta conta, pula.
      const notifExistente = await notifDelegate.findFirst({
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
      // Falha em uma notificação individual não deve interromper as demais.
    }
  }

  return NextResponse.json({ success: true, notificationsCreated });
}
