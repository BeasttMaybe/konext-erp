"use server";

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import {
  formOportunidadeSchema,
  type EstagioFunil,
  type FormOportunidade,
} from "@/lib/validations/oportunidades";
import { dataDeCalendario } from "@/lib/datas";

export type OportunidadeListagem = {
  id: string;
  titulo: string;
  valor: number;
  estagio: EstagioFunil;
  dataFechamento: string | null;
  clienteId: string;
  clienteNome: string;
  clienteFantasia: string | null;
  clienteDocumento: string;
  criadoEm: string;
  atualizadoEm: string;
};

type ResultadoOportunidade =
  | {
      sucesso: true;
      mensagem: string;
      oportunidade: OportunidadeListagem;
    }
  | {
      sucesso: false;
      mensagem: string;
    };

const etapasFechadas: EstagioFunil[] = ["GANHO", "PERDIDO"];

type LinhaOportunidadeRaw = {
  id: string;
  titulo: string;
  valor: Prisma.Decimal | number | string;
  estagio: string;
  dataFechamento: Date | string | null;
  clienteId: string;
  clienteNome: string;
  clienteFantasia: string | null;
  clienteDocumento: string;
  criadoEm: Date | string;
  atualizadoEm: Date | string;
};

type OportunidadeDelegate = {
  create?: (args: {
    data: {
      titulo: string;
      valor: Prisma.Decimal;
      estagio: EstagioFunil;
      dataFechamento: Date | null;
      clienteId: string;
    };
    include: {
      cliente: {
        select: {
          id: true;
          nomeRazaoSocial: true;
          nomeFantasia: true;
          documento: true;
        };
      };
    };
  }) => Promise<
    Prisma.OportunidadeGetPayload<{
      include: { cliente: { select: { id: true; nomeRazaoSocial: true; nomeFantasia: true; documento: true } } };
    }>
  >;
  findMany?: (args: {
    orderBy: Array<{ atualizadoEm: "desc" | "asc" }>;
    include: {
      cliente: {
        select: {
          id: true;
          nomeRazaoSocial: true;
          nomeFantasia: true;
          documento: true;
        };
      };
    };
  }) => Promise<
    Array<
      Prisma.OportunidadeGetPayload<{
        include: { cliente: { select: { id: true; nomeRazaoSocial: true; nomeFantasia: true; documento: true } } };
      }>
    >
  >;
  update?: (args: {
    where: { id: string };
    data: { estagio: EstagioFunil; dataFechamento: Date | null };
    include: {
      cliente: {
        select: {
          id: true;
          nomeRazaoSocial: true;
          nomeFantasia: true;
          documento: true;
        };
      };
    };
  }) => Promise<
    Prisma.OportunidadeGetPayload<{
      include: { cliente: { select: { id: true; nomeRazaoSocial: true; nomeFantasia: true; documento: true } } };
    }>
  >;
};

function obterDelegateOportunidade(client: PrismaClient): OportunidadeDelegate | null {
  const prismaClient = client as unknown as {
    oportunidade?: OportunidadeDelegate;
    Oportunidade?: OportunidadeDelegate;
  };

  return prismaClient.oportunidade ?? prismaClient.Oportunidade ?? null;
}

function mapearLinhaRaw(linha: LinhaOportunidadeRaw): OportunidadeListagem {
  return {
    id: linha.id,
    titulo: linha.titulo,
    valor: Number(linha.valor),
    estagio: linha.estagio as EstagioFunil,
    dataFechamento: linha.dataFechamento ? new Date(linha.dataFechamento).toISOString() : null,
    clienteId: linha.clienteId,
    clienteNome: linha.clienteNome,
    clienteFantasia: linha.clienteFantasia,
    clienteDocumento: linha.clienteDocumento,
    criadoEm: new Date(linha.criadoEm).toISOString(),
    atualizadoEm: new Date(linha.atualizadoEm).toISOString(),
  };
}

async function buscarOportunidadePorIdRaw(
  client: PrismaClient,
  id: string
): Promise<OportunidadeListagem | null> {
  const prismaClient = client as unknown as {
    $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  };

  const linhas = await prismaClient.$queryRaw<LinhaOportunidadeRaw[]>`
    SELECT
      o.id,
      o.titulo,
      o.valor,
      o.estagio,
      o."dataFechamento" as "dataFechamento",
      o."clienteId" as "clienteId",
      c."nomeRazaoSocial" as "clienteNome",
      c."nomeFantasia" as "clienteFantasia",
      c.documento as "clienteDocumento",
      o."criadoEm" as "criadoEm",
      o."atualizadoEm" as "atualizadoEm"
    FROM "Oportunidade" o
    INNER JOIN "Cliente" c ON c.id = o."clienteId"
    WHERE o.id = ${id}
    LIMIT 1
  `;

  return linhas[0] ? mapearLinhaRaw(linhas[0]) : null;
}

function mapearOportunidade(
  oportunidade: Prisma.OportunidadeGetPayload<{
    include: { cliente: { select: { id: true; nomeRazaoSocial: true; nomeFantasia: true; documento: true } } };
  }>
): OportunidadeListagem {
  return {
    id: oportunidade.id,
    titulo: oportunidade.titulo,
    valor: Number(oportunidade.valor),
    estagio: oportunidade.estagio as EstagioFunil,
    dataFechamento: oportunidade.dataFechamento ? oportunidade.dataFechamento.toISOString() : null,
    clienteId: oportunidade.cliente.id,
    clienteNome: oportunidade.cliente.nomeRazaoSocial,
    clienteFantasia: oportunidade.cliente.nomeFantasia,
    clienteDocumento: oportunidade.cliente.documento,
    criadoEm: oportunidade.criadoEm.toISOString(),
    atualizadoEm: oportunidade.atualizadoEm.toISOString(),
  };
}

export async function criarOportunidade(dados: FormOportunidade): Promise<ResultadoOportunidade> {
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.editar");
    const prismaTenant = contextoTenant.prisma;
    const delegate = obterDelegateOportunidade(prismaTenant);

    const dadosValidados = formOportunidadeSchema.parse(dados);
    const dataFechamentoInformada = dadosValidados.dataFechamento?.trim();
    // Data de calendário digitada pelo usuário ("yyyy-MM-dd") — nunca
    // `new Date(`${texto}T00:00:00`)`: isso assume meia-noite do fuso do
    // PROCESSO, que não é a convenção usada pra data de calendário neste
    // projeto (meia-noite UTC — ver lib/datas.ts).
    const dataFechamento = dataFechamentoInformada
      ? dataDeCalendario(dataFechamentoInformada)
      : etapasFechadas.includes(dadosValidados.estagio)
        ? new Date()
        : null;

    if (dataFechamentoInformada && dataFechamento === null) {
      return {
        sucesso: false,
        mensagem: "A data de fechamento informada e invalida.",
      };
    }

    if (typeof delegate?.create === "function") {
      const oportunidade = await delegate.create({
        data: {
          titulo: dadosValidados.titulo.trim(),
          valor: new Prisma.Decimal(dadosValidados.valor),
          estagio: dadosValidados.estagio,
          dataFechamento,
          clienteId: dadosValidados.clienteId,
        },
        include: {
          cliente: {
            select: {
              id: true,
              nomeRazaoSocial: true,
              nomeFantasia: true,
              documento: true,
            },
          },
        },
      });

      revalidatePath("/crm");
      revalidatePath("/crm/oportunidades");

      return {
        sucesso: true,
        mensagem: "Oportunidade criada com sucesso.",
        oportunidade: mapearOportunidade(oportunidade),
      };
    }

    const prismaClient = prismaTenant as unknown as {
      $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
    };

    const oportunidadeId = crypto.randomUUID();

    await prismaClient.$executeRaw`
      INSERT INTO "Oportunidade" ("id", "titulo", "valor", "estagio", "dataFechamento", "clienteId")
      VALUES (
        ${oportunidadeId},
        ${dadosValidados.titulo.trim()},
        ${new Prisma.Decimal(dadosValidados.valor)},
        CAST(${dadosValidados.estagio} AS "EstagioFunil"),
        ${dataFechamento},
        ${dadosValidados.clienteId}
      )
    `;

    const oportunidadeRaw = await buscarOportunidadePorIdRaw(prismaTenant, oportunidadeId);

    if (!oportunidadeRaw) {
      return {
        sucesso: false,
        mensagem: "Nao foi possivel recuperar a oportunidade apos criar.",
      };
    }

    revalidatePath("/crm");
    revalidatePath("/crm/oportunidades");

    return {
      sucesso: true,
      mensagem: "Oportunidade criada com sucesso.",
      oportunidade: oportunidadeRaw,
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("Sessão")) {
      return { sucesso: false, mensagem: erro.message };
    }

    if (erro instanceof ZodError) {
      return {
        sucesso: false,
        mensagem: erro.issues[0]?.message ?? "Dados invalidos para criar a oportunidade.",
      };
    }

    if (erro instanceof Prisma.PrismaClientKnownRequestError) {
      if (erro.code === "P2025") {
        return {
          sucesso: false,
          mensagem: "Contato nao encontrado.",
        };
      }

      if (erro.code === "P2003") {
        return {
          sucesso: false,
          mensagem: "Nao foi possivel vincular a oportunidade a este contato.",
        };
      }
    }

    console.error("Erro ao criar oportunidade:", erro);
    return {
      sucesso: false,
      mensagem: "Nao foi possivel criar a oportunidade. Tente novamente.",
    };
  }
}

export async function listarOportunidades(): Promise<OportunidadeListagem[]> {
  const contextoTenant = await exigirContextoTenant();
  exigirPermissao(contextoTenant, "crm.ver");
  const prismaTenant = contextoTenant.prisma;
  const delegate = obterDelegateOportunidade(prismaTenant);

  if (typeof delegate?.findMany === "function") {
    const oportunidades = await delegate.findMany({
      orderBy: [{ atualizadoEm: "desc" }],
      include: {
        cliente: {
          select: {
            id: true,
            nomeRazaoSocial: true,
            nomeFantasia: true,
            documento: true,
          },
        },
      },
    });

    return oportunidades.map(mapearOportunidade);
  }

  console.error("Delegate Prisma de oportunidade indisponivel. Usando fallback SQL para listagem.");

  const prismaClient = prismaTenant as unknown as {
    $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  };

  const oportunidades = await prismaClient.$queryRaw<LinhaOportunidadeRaw[]>`
    SELECT
      o.id,
      o.titulo,
      o.valor,
      o.estagio,
      o."dataFechamento" as "dataFechamento",
      o."clienteId" as "clienteId",
      c."nomeRazaoSocial" as "clienteNome",
      c."nomeFantasia" as "clienteFantasia",
      c.documento as "clienteDocumento",
      o."criadoEm" as "criadoEm",
      o."atualizadoEm" as "atualizadoEm"
    FROM "Oportunidade" o
    INNER JOIN "Cliente" c ON c.id = o."clienteId"
    ORDER BY o."atualizadoEm" DESC
  `;

  return oportunidades.map(mapearLinhaRaw);
}

export async function atualizarEstagioOportunidade(
  oportunidadeId: string,
  estagio: EstagioFunil
): Promise<ResultadoOportunidade> {
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.editar");
    const prismaTenant = contextoTenant.prisma;
    const delegate = obterDelegateOportunidade(prismaTenant);

    if (typeof delegate?.update === "function") {
      const oportunidadeAtualizada = await delegate.update({
        where: { id: oportunidadeId },
        data: {
          estagio,
          dataFechamento: etapasFechadas.includes(estagio) ? new Date() : null,
        },
        include: {
          cliente: {
            select: {
              id: true,
              nomeRazaoSocial: true,
              nomeFantasia: true,
              documento: true,
            },
          },
        },
      });

      revalidatePath("/crm");
      revalidatePath("/crm/oportunidades");

      return {
        sucesso: true,
        mensagem: "Estagio da oportunidade atualizado.",
        oportunidade: mapearOportunidade(oportunidadeAtualizada),
      };
    }

    const prismaClient = prismaTenant as unknown as {
      $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
    };

    const ids = await prismaClient.$queryRaw<Array<{ id: string }>>`
      UPDATE "Oportunidade"
      SET
        "estagio" = CAST(${estagio} AS "EstagioFunil"),
        "dataFechamento" = ${etapasFechadas.includes(estagio) ? new Date() : null},
        "atualizadoEm" = NOW()
      WHERE "id" = ${oportunidadeId}
      RETURNING id
    `;

    if (!ids[0]?.id) {
      return {
        sucesso: false,
        mensagem: "Oportunidade nao encontrada.",
      };
    }

    const oportunidadeRaw = await buscarOportunidadePorIdRaw(prismaTenant, oportunidadeId);

    if (!oportunidadeRaw) {
      return {
        sucesso: false,
        mensagem: "Nao foi possivel recuperar a oportunidade apos atualizar.",
      };
    }

    revalidatePath("/crm");
    revalidatePath("/crm/oportunidades");

    return {
      sucesso: true,
      mensagem: "Estagio da oportunidade atualizado.",
      oportunidade: oportunidadeRaw,
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("Sessão")) {
      return { sucesso: false, mensagem: erro.message };
    }

    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return {
        sucesso: false,
        mensagem: "Oportunidade nao encontrada.",
      };
    }

    console.error("Erro ao atualizar estagio da oportunidade:", erro);
    return {
      sucesso: false,
      mensagem: "Nao foi possivel atualizar o estagio da oportunidade.",
    };
  }
}
