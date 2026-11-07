import { NextRequest, NextResponse } from "next/server";

import { prismaCentral } from "@/lib/central/prisma-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { resolverConexaoTenant } from "@/lib/tenant/resolver-conexao-tenant";
import {
  FUSO_HORARIO_PADRAO,
  hojeComoDataDeCalendario,
  somarDiasEmDataDeCalendario,
} from "@/lib/datas";
import { deDecimal } from "@/lib/dinheiro";
import {
  chaveDoAviso,
  DIAS_DE_AVISO,
  montarAvisosDeVencimento,
  type AvisoDeVencimento,
  type ContaParaAviso,
} from "@/lib/dominio/financeiro/avisos-de-vencimento";
import { enviarMensagemNoTelegram, telegramEstaConfigurado } from "@/lib/notificacoes/telegram";

/**
 * GET /api/cron/verificar-vencimentos
 *
 * Avisa de conta vencendo: 3 dias antes, 2, 1 e no dia. Dentro do sistema
 * (sininho) e, quando a loja configurou, no Telegram.
 *
 * O QUE ESTA ROTA FAZIA ANTES
 *
 * Ela existe e roda todo dia às 11:00 UTC desde sempre — e consultava o model
 * `Conta`, uma tabela legada com `status` e `tipo` como texto solto, em que
 * NADA no sistema escreve. As contas de verdade vivem em `ParcelaDespesa` e
 * `ContaReceber`. O cron rodava, encontrava zero linhas e não avisava nada.
 *
 * Isso é o tipo de defeito que não dá sinal: um cron que não acha nada é
 * indistinguível de um cron que não tem nada pra achar. Só apareceu porque o
 * dono pediu o aviso no Telegram e foi preciso olhar o que já existia.
 *
 * A REGRA NÃO MORA AQUI
 *
 * Quais avisos saem hoje e o que eles dizem é
 * `lib/dominio/financeiro/avisos-de-vencimento.ts`, puro e com 20 testes.
 * Aqui fica só o que precisa de banco e de rede: ler as contas, gravar o que
 * saiu, mandar a mensagem.
 */

type DecimalPrisma = { toString(): string };

type ParcelaDespesaLida = {
  id: string;
  valor: DecimalPrisma;
  dataVencimento: Date;
  despesa: {
    fornecedor: string;
    descricao: string;
    cliente: { nomeRazaoSocial: string } | null;
  } | null;
};

type ContaReceberLida = {
  id: string;
  descricao: string;
  valor: DecimalPrisma;
  dataVencimento: Date;
  cliente: { nomeRazaoSocial: string } | null;
};

type AvisoGravado = { tipo: "PAGAR" | "RECEBER"; contaId: string; diasDeAntecedencia: number };

type PrismaDoTenant = {
  parcelaDespesa?: { findMany: (args: unknown) => Promise<ParcelaDespesaLida[]> };
  contaReceber?: { findMany: (args: unknown) => Promise<ContaReceberLida[]> };
  avisoDeVencimentoEnviado?: {
    findMany: (args: unknown) => Promise<AvisoGravado[]>;
    createMany: (args: unknown) => Promise<unknown>;
  };
  notificacao?: { create: (args: unknown) => Promise<unknown> };
  configuracao?: {
    findFirst: (args: unknown) => Promise<{
      fusoHorario?: string | null;
      telegramChatId?: string | null;
      avisarVencimentoNoTelegram?: boolean | null;
    } | null>;
  };
};

export type ResumoDoTenant = {
  avisos: number;
  notificacoesCriadas: number;
  telegram: "enviado" | "sem-chat" | "desligado" | "sem-token" | "nada-a-avisar" | "falhou";
  detalheDoTelegram?: string;
};

/**
 * O fuso da LOJA, não do processo.
 *
 * A Vercel roda em UTC. Decidir "vence hoje" com o fuso do processo marcaria
 * como "vence amanhã" uma conta que, pra quem está na loja, vence hoje — toda
 * noite entre 21h e meia-noite.
 */
async function lerConfiguracao(prisma: PrismaDoTenant) {
  try {
    const configuracao = await prisma.configuracao?.findFirst({
      orderBy: { criadoEm: "asc" },
      select: { fusoHorario: true, telegramChatId: true, avisarVencimentoNoTelegram: true },
    });

    const fuso = configuracao?.fusoHorario?.trim();

    return {
      fusoHorario: fuso && fuso.length > 0 ? fuso : FUSO_HORARIO_PADRAO,
      telegramChatId: configuracao?.telegramChatId?.trim() ?? "",
      avisarNoTelegram: configuracao?.avisarVencimentoNoTelegram !== false,
    };
  } catch {
    return { fusoHorario: FUSO_HORARIO_PADRAO, telegramChatId: "", avisarNoTelegram: false };
  }
}

/**
 * A mensagem única do dia, em vez de um ping por conta.
 *
 * Com dez vencimentos na mesma semana, dez notificações separadas numa manhã
 * é o caminho mais curto pra pessoa silenciar o bot — e aí perder também os
 * avisos que importam. Uma mensagem, com as linhas em ordem de urgência.
 */
function montarMensagemDoDia(avisos: AvisoDeVencimento[]): string {
  const cabecalho =
    avisos.length === 1 ? "Konext — 1 conta no radar" : `Konext — ${avisos.length} contas no radar`;

  return [cabecalho, "", ...avisos.map((aviso) => aviso.mensagem)].join("\n\n");
}

async function processarTenant(prisma: PrismaDoTenant): Promise<ResumoDoTenant> {
  const { fusoHorario, telegramChatId, avisarNoTelegram } = await lerConfiguracao(prisma);

  const hoje = hojeComoDataDeCalendario(fusoHorario);
  const maiorAntecedencia = Math.max(...DIAS_DE_AVISO);
  const limite = somarDiasEmDataDeCalendario(hoje, maiorAntecedencia);

  // A janela vai de hoje até o marco mais distante. Conta já vencida fica de
  // fora de propósito — ver o comentário em `montarAvisosDeVencimento`.
  const janela = { gte: hoje, lte: limite };

  const [parcelas, contasAReceber] = await Promise.all([
    prisma.parcelaDespesa?.findMany({
      where: { status: "PENDENTE", dataVencimento: janela },
      select: {
        id: true,
        valor: true,
        dataVencimento: true,
        despesa: {
          select: {
            fornecedor: true,
            descricao: true,
            cliente: { select: { nomeRazaoSocial: true } },
          },
        },
      },
    }) ?? Promise.resolve([]),
    prisma.contaReceber?.findMany({
      where: {
        status: { notIn: ["RECEBIDO", "PAGO", "ESTORNADO"] },
        estornadaEm: null,
        dataVencimento: janela,
      },
      select: {
        id: true,
        descricao: true,
        valor: true,
        dataVencimento: true,
        cliente: { select: { nomeRazaoSocial: true } },
      },
    }) ?? Promise.resolve([]),
  ]);

  const contas: ContaParaAviso[] = [
    ...parcelas.map((parcela) => ({
      id: parcela.id,
      tipo: "PAGAR" as const,
      descricao: parcela.despesa?.descricao ?? "Despesa",
      // O fornecedor é quem recebe; o cliente, quando existe, é a quem a
      // despesa foi vinculada. O fornecedor é a informação útil no aviso.
      contraparte: parcela.despesa?.fornecedor ?? null,
      valorCentavos: deDecimal(parcela.valor.toString()),
      dataVencimento: parcela.dataVencimento,
    })),
    ...contasAReceber.map((conta) => ({
      id: conta.id,
      tipo: "RECEBER" as const,
      descricao: conta.descricao,
      contraparte: conta.cliente?.nomeRazaoSocial ?? null,
      valorCentavos: deDecimal(conta.valor.toString()),
      dataVencimento: conta.dataVencimento,
    })),
  ];

  if (contas.length === 0) {
    return { avisos: 0, notificacoesCriadas: 0, telegram: "nada-a-avisar" };
  }

  const jaAvisados =
    (await prisma.avisoDeVencimentoEnviado?.findMany({
      where: {
        contaId: { in: contas.map((conta) => conta.id) },
        diasDeAntecedencia: { in: [...DIAS_DE_AVISO] },
      },
      select: { tipo: true, contaId: true, diasDeAntecedencia: true },
    })) ?? [];

  const avisos = montarAvisosDeVencimento({
    contas,
    hoje,
    chavesJaAvisadas: new Set(
      jaAvisados.map((aviso) =>
        chaveDoAviso(aviso.tipo, aviso.contaId, aviso.diasDeAntecedencia)
      )
    ),
  });

  if (avisos.length === 0) {
    return { avisos: 0, notificacoesCriadas: 0, telegram: "nada-a-avisar" };
  }

  // O sininho dentro do sistema sai sempre — ele não depende de o Telegram
  // estar configurado, e é o aviso que existe pra quem usa o sistema no
  // balcão. Falha numa linha não interrompe as outras.
  let notificacoesCriadas = 0;
  for (const aviso of avisos) {
    try {
      await prisma.notificacao?.create({
        data: { titulo: aviso.titulo, mensagem: aviso.mensagem },
      });
      notificacoesCriadas += 1;
    } catch {
      // Um aviso que não entrou no sininho não justifica abortar o resto.
    }
  }

  let telegram: ResumoDoTenant["telegram"] = "desligado";
  let detalheDoTelegram: string | undefined;

  if (!avisarNoTelegram) {
    telegram = "desligado";
  } else if (!telegramEstaConfigurado()) {
    telegram = "sem-token";
  } else if (telegramChatId === "") {
    telegram = "sem-chat";
  } else {
    const resultado = await enviarMensagemNoTelegram({
      chatId: telegramChatId,
      texto: montarMensagemDoDia(avisos),
    });

    telegram = resultado.enviado ? "enviado" : "falhou";
    if (!resultado.enviado) detalheDoTelegram = resultado.motivo;
  }

  // Marcar como avisado SÓ depois de o aviso existir em algum canal.
  //
  // A ordem importa: se gravasse antes e o envio falhasse, o aviso de hoje
  // estaria marcado como entregue e nunca mais sairia — a conta venceria em
  // silêncio, que é exatamente o que este cron existe pra impedir. Com a
  // gravação depois, o pior caso é o aviso repetir amanhã, e repetir é
  // melhor que faltar.
  //
  // `skipDuplicates` porque duas execuções simultâneas chegariam aqui com as
  // mesmas chaves, e o UNIQUE recusaria o lote inteiro.
  try {
    await prisma.avisoDeVencimentoEnviado?.createMany({
      data: avisos.map((aviso) => ({
        tipo: aviso.conta.tipo,
        contaId: aviso.conta.id,
        diasDeAntecedencia: aviso.diasDeAntecedencia,
      })),
      skipDuplicates: true,
    });
  } catch (erro) {
    detalheDoTelegram = `Aviso enviado, mas nao registrado (pode repetir amanha): ${
      erro instanceof Error ? erro.message : String(erro)
    }`;
  }

  return { avisos: avisos.length, notificacoesCriadas, telegram, detalheDoTelegram };
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
      select: { id: true, slug: true, connectionRef: true },
    });

    let avisos = 0;
    let notificacoesCriadas = 0;
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
          connectionString: resolverConexaoTenant(tenant.connectionRef),
        }) as unknown as PrismaDoTenant;

        const resumo = await processarTenant(prismaTenant);

        avisos += resumo.avisos;
        notificacoesCriadas += resumo.notificacoesCriadas;
        porTenant.push({ tenantSlug: tenant.slug, ...resumo });
      } catch (erro) {
        // Um tenant com problema não pode deixar os outros sem aviso.
        falhas.push({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          erro: erro instanceof Error ? erro.message : String(erro),
        });
      }
    }

    return NextResponse.json({
      success: true,
      avisos,
      notificacoesCriadas,
      tenantsProcessados: porTenant.length,
      tenantsComFalha: falhas.length,
      porTenant,
      falhas,
    });
  } catch (erro) {
    return NextResponse.json(
      { success: false, error: erro instanceof Error ? erro.message : String(erro) },
      { status: 500 }
    );
  }
}
