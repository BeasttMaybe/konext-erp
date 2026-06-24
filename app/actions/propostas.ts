"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";
import { propostaFormSchema, type PropostaFormValues } from "@/lib/validations/propostas";

type PropostaStatusInput = "RASCUNHO" | "ENVIADA";

type CreatePropostaResult =
  | { success: true; message: string; propostaId: string }
  | { success: false; message: string };

type ClientePropostaSugestao = {
  id: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  documento: string;
};

type ProdutoPropostaSugestao = {
  id: string;
  nome: string;
  descricao: string | null;
  codigoBarras: string | null;
  precoVenda: number;
};

export async function listarClientesProposta(): Promise<ClientePropostaSugestao[]> {
  try {
    await exigirSessao();

    const clientes = await prisma.cliente.findMany({
      select: {
        id: true,
        nomeRazaoSocial: true,
        nomeFantasia: true,
        documento: true,
      },
      orderBy: {
        nomeRazaoSocial: "asc",
      },
      take: 300,
    });

    return clientes;
  } catch (error) {
    console.error("Erro ao listar clientes para proposta:", error);
    return [];
  }
}

export async function listarProdutosProposta(): Promise<ProdutoPropostaSugestao[]> {
  try {
    await exigirSessao();

    const produtos = await prisma.produto.findMany({
      select: {
        id: true,
        nome: true,
        descricao: true,
        codigoBarras: true,
        precoVenda: true,
      },
      where: {
        ativo: true,
      },
      orderBy: {
        nome: "asc",
      },
      take: 300,
    });

    return produtos;
  } catch (error) {
    console.error("Erro ao listar produtos para proposta:", error);
    return [];
  }
}

function toDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Uma das datas informadas é inválida.");
  }
  return parsed;
}

export async function createProposta(
  data: PropostaFormValues,
  status: PropostaStatusInput
): Promise<CreatePropostaResult> {
  try {
    await exigirSessao();

    const validated = propostaFormSchema.parse(data);

    const normalizedItems = validated.itens
      .map((item) => ({
        descricao: item.descricao.trim(),
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        descontoPercentual: item.descontoPercentual,
      }))
      .filter((item) => item.descricao !== "");

    if (normalizedItems.length === 0) {
      return {
        success: false,
        message: "Adicione ao menos um item com descrição para salvar a proposta.",
      };
    }

    const subtotalBruto = normalizedItems.reduce(
      (total, item) => total + item.quantidade * item.precoUnitario,
      0
    );

    const descontoTotal = normalizedItems.reduce((total, item) => {
      const lineGross = item.quantidade * item.precoUnitario;
      return total + lineGross * (item.descontoPercentual / 100);
    }, 0);

    const valorTotal = Math.max(0, subtotalBruto - descontoTotal);
    const paymentSummary = [validated.condicoesPagamento, validated.detalhesPagamento]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .join(" | ");

    const created = await prisma.propostaComercial.create({
      data: {
        cliente: validated.cliente.trim(),
        aosCuidados: validated.aosCuidados,
        dataEmissao: toDateOnly(validated.dataEmissao),
        validade: toDateOnly(validated.validade),
        proximoContato: validated.proximoContato ? toDateOnly(validated.proximoContato) : null,
        equipamento: validated.equipamento,
        defeito: validated.defeito,
        introducao: validated.introducao,
        condicoesPagamento: paymentSummary || null,
        termosGarantia: validated.termosGarantia,
        observacoesInternas: validated.observacoesInternas,
        subtotalBruto,
        descontoTotal,
        valorTotal,
        status,
        itens: {
          create: normalizedItems.map((item) => {
            const gross = item.quantidade * item.precoUnitario;
            const subtotal = Math.max(0, gross - gross * (item.descontoPercentual / 100));

            return {
              descricao: item.descricao,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              descontoPercentual: item.descontoPercentual,
              subtotal,
            };
          }),
        },
      },
      select: {
        id: true,
      },
    });

    revalidatePath("/crm/propostas");

    return {
      success: true,
      message:
        status === "RASCUNHO"
          ? "Proposta guardada como rascunho com sucesso!"
          : "Proposta guardada com sucesso!",
      propostaId: created.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.issues[0]?.message ?? "Dados inválidos para guardar a proposta.",
      };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Não foi possível guardar a proposta no banco de dados.",
      };
    }

    if (error instanceof Error && error.message.includes("Sessão")) {
      return {
        success: false,
        message: error.message,
      };
    }

    console.error("Erro ao guardar proposta:", error);

    return {
      success: false,
      message: "Não foi possível guardar a proposta.",
    };
  }
}
