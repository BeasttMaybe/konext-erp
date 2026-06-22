"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { exigirSessao } from "@/lib/auth/sessao";

type CaixaDelegate = {
  findFirst?: (args: unknown) => Promise<{ id?: string; valorAbertura?: number } | null>;
  create?: (args: unknown) => Promise<{ id: string; valorAbertura: number; dataAbertura: Date }>;
  update?: (args: unknown) => Promise<{ id: string; valorFechamento?: number; dataFechamento?: Date | null }>;
};

type SqlExecutor = {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

type SqlMutator = SqlExecutor & {
  $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

type CaixaClient = SqlMutator & {
  caixaSession?: CaixaDelegate;
  CaixaSession?: CaixaDelegate;
};

export interface ResumoCaixaAbertoAtual {
  caixaId: string;
  valorAbertura: number;
  totalVendasSessao: number;
  valorSugeridoFechamento: number;
}

function obterCaixaDelegate(client: unknown): CaixaDelegate | undefined {
  const prismaClient = client as CaixaClient;
  return prismaClient.caixaSession ?? prismaClient.CaixaSession;
}

async function buscarCaixaAbertoViaSql(client: SqlExecutor): Promise<{ id: string } | null> {
  const resultado = await client.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "CaixaSession"
    WHERE status::text = 'ABERTO'
    ORDER BY "dataAbertura" DESC
    LIMIT 1
  `;

  if (!Array.isArray(resultado) || resultado.length === 0 || !resultado[0]?.id) {
    return null;
  }

  return { id: String(resultado[0].id) };
}

async function criarCaixaViaSql(client: SqlExecutor, valorAbertura: number) {
  const id = randomUUID();

  const resultado = await client.$queryRaw<
    Array<{ id: string; valorAbertura: number; dataAbertura: Date }>
  >`
    INSERT INTO "CaixaSession" (id, status, "valorAbertura", "criadoEm", "atualizadoEm")
    VALUES (${id}, 'ABERTO', ${valorAbertura}, NOW(), NOW())
    RETURNING id, "valorAbertura", "dataAbertura"
  `;

  if (!Array.isArray(resultado) || resultado.length === 0) {
    throw new Error("Nao foi possivel abrir o caixa no banco de dados.");
  }

  const novo = resultado[0];
  return {
    id: String(novo.id),
    valorAbertura: Number(novo.valorAbertura),
    dataAbertura: new Date(novo.dataAbertura).toISOString(),
  };
}

async function fecharCaixaViaSql(client: SqlExecutor, caixaId: string, valorFechamento: number) {
  const resultado = await client.$queryRaw<
    Array<{ id: string; valorFechamento: number; dataFechamento: Date }>
  >`
    UPDATE "CaixaSession"
    SET
      status = 'FECHADO',
      "valorFechamento" = ${valorFechamento},
      "dataFechamento" = NOW(),
      "atualizadoEm" = NOW()
    WHERE id = ${caixaId}
    RETURNING id, "valorFechamento", "dataFechamento"
  `;

  if (!Array.isArray(resultado) || resultado.length === 0) {
    throw new Error("Nao foi possivel fechar o caixa no banco de dados.");
  }

  const caixaFechado = resultado[0];
  return {
    id: String(caixaFechado.id),
    valorFechamento: Number(caixaFechado.valorFechamento),
    dataFechamento: new Date(caixaFechado.dataFechamento).toISOString(),
  };
}

async function obterResumoCaixaAbertoAtualViaSql(client: SqlExecutor): Promise<ResumoCaixaAbertoAtual> {
  const caixaAberto = await client.$queryRaw<
    Array<{ id: string; valorAbertura: number }>
  >`
    SELECT id, "valorAbertura"
    FROM "CaixaSession"
    WHERE status::text = 'ABERTO'
    ORDER BY "dataAbertura" DESC
    LIMIT 1
  `;

  if (!Array.isArray(caixaAberto) || caixaAberto.length === 0 || !caixaAberto[0]?.id) {
    throw new Error("Nao existe caixa aberto para fechamento.");
  }

  const caixaId = String(caixaAberto[0].id);
  const valorAbertura = Number(caixaAberto[0].valorAbertura ?? 0);

  const totaisVenda = await client.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM("valorTotal"), 0) AS total
    FROM "Venda"
    WHERE "caixaSessionId" = ${caixaId}
  `;

  const totalVendasSessao = Number(totaisVenda?.[0]?.total ?? 0);

  return {
    caixaId,
    valorAbertura,
    totalVendasSessao,
    valorSugeridoFechamento: valorAbertura + totalVendasSessao,
  };
}

async function obterResumoCaixaAbertoAtualInterno(client: CaixaClient): Promise<ResumoCaixaAbertoAtual> {
  const caixaDelegate = obterCaixaDelegate(client);

  if (caixaDelegate?.findFirst) {
    const caixaAberto = await caixaDelegate.findFirst({
      where: {
        status: "ABERTO",
      },
      orderBy: {
        dataAbertura: "desc",
      },
      select: {
        id: true,
        valorAbertura: true,
      },
    });

    if (!caixaAberto?.id) {
      throw new Error("Nao existe caixa aberto para fechamento.");
    }

    const totaisVenda = await client.$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM("valorTotal"), 0) AS total
      FROM "Venda"
      WHERE "caixaSessionId" = ${String(caixaAberto.id)}
    `;

    const valorAbertura = Number(caixaAberto.valorAbertura ?? 0);
    const totalVendasSessao = Number(totaisVenda?.[0]?.total ?? 0);

    return {
      caixaId: String(caixaAberto.id),
      valorAbertura,
      totalVendasSessao,
      valorSugeridoFechamento: valorAbertura + totalVendasSessao,
    };
  }

  return obterResumoCaixaAbertoAtualViaSql(client);
}

export async function verificarStatusCaixa(): Promise<boolean> {
  const prismaAny = prisma as CaixaClient;
  const caixaDelegate = obterCaixaDelegate(prismaAny);

  if (caixaDelegate?.findFirst) {
    const caixaAberto = await caixaDelegate.findFirst({
      where: {
        status: "ABERTO",
      },
      orderBy: {
        dataAbertura: "desc",
      },
      select: {
        id: true,
      },
    });

    return Boolean(caixaAberto?.id);
  }

  const caixaAberto = await buscarCaixaAbertoViaSql(prismaAny);
  return Boolean(caixaAberto?.id);
}

export async function abrirNovaCaixaSession(valorAbertura: number) {
  // C1: exige sessao valida antes de abrir o caixa.
  await exigirSessao();

  const valorNumerico = Number(valorAbertura);

  if (!Number.isFinite(valorNumerico) || valorNumerico < 0) {
    throw new Error("Informe um valor inicial válido para abrir o caixa.");
  }

  const novaSessao = await prisma.$transaction(async (tx) => {
    const txAny = tx as CaixaClient;
    const txCaixaDelegate = obterCaixaDelegate(txAny);

    if (txCaixaDelegate?.findFirst && txCaixaDelegate?.create) {
      const caixaAberto = await txCaixaDelegate.findFirst({
        where: {
          status: "ABERTO",
        },
        select: {
          id: true,
        },
      });

      if (caixaAberto?.id) {
        throw new Error("Ja existe um caixa aberto. Feche o caixa atual antes de abrir um novo.");
      }

      const sessao = await txCaixaDelegate.create({
        data: {
          status: "ABERTO",
          valorAbertura: valorNumerico,
        },
        select: {
          id: true,
          valorAbertura: true,
          dataAbertura: true,
        },
      });

      return {
        id: String(sessao.id),
        valorAbertura: Number(sessao.valorAbertura),
        dataAbertura: new Date(sessao.dataAbertura).toISOString(),
      };
    }

    const caixaAbertoSql = await buscarCaixaAbertoViaSql(txAny);

    if (caixaAbertoSql?.id) {
      throw new Error("Ja existe um caixa aberto. Feche o caixa atual antes de abrir um novo.");
    }

    return criarCaixaViaSql(txAny, valorNumerico);
  });

  revalidatePath("/pdv");

  return {
    id: novaSessao.id,
    valorAbertura: novaSessao.valorAbertura,
    dataAbertura: novaSessao.dataAbertura,
  };
}

export async function obterResumoCaixaAbertoAtual(): Promise<ResumoCaixaAbertoAtual> {
  const prismaAny = prisma as CaixaClient;
  return obterResumoCaixaAbertoAtualInterno(prismaAny);
}

export async function fecharCaixaSessionAtual(valorFechamento?: number | null) {
  // C1: exige sessao valida antes de fechar o caixa.
  await exigirSessao();

  const valorInformado = Number(valorFechamento);

  const fechamento = await prisma.$transaction(async (tx) => {
    const txAny = tx as CaixaClient;
    const txCaixaDelegate = obterCaixaDelegate(txAny);
    const resumoAtual = await obterResumoCaixaAbertoAtualInterno(txAny);
    const valorFinal = Number.isFinite(valorInformado) && valorInformado >= 0
      ? valorInformado
      : resumoAtual.valorSugeridoFechamento;

    if (txCaixaDelegate?.findFirst && txCaixaDelegate?.update) {
      const caixaFechado = await txCaixaDelegate.update({
        where: {
          id: resumoAtual.caixaId,
        },
        data: {
          status: "FECHADO",
          valorFechamento: valorFinal,
          dataFechamento: new Date(),
        },
        select: {
          id: true,
          valorFechamento: true,
          dataFechamento: true,
        },
      });

      return {
        id: String(caixaFechado.id),
        valorFechamento: Number(caixaFechado.valorFechamento ?? valorFinal),
        dataFechamento: new Date(caixaFechado.dataFechamento ?? new Date()).toISOString(),
      };
    }

    return fecharCaixaViaSql(txAny, resumoAtual.caixaId, valorFinal);
  });

  revalidatePath("/pdv");

  return fechamento;
}
