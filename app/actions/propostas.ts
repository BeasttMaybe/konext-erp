"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { propostaFormSchema, type PropostaFormValues } from "@/lib/validations/propostas";
import { aplicarPercentual, deDecimal, multiplicarPorQuantidade, paraDecimal, paraMoeda, somar, subtrair } from "@/lib/dinheiro";

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
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.ver");
    const prisma = contextoTenant.prisma;

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
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.ver");
    const prisma = contextoTenant.prisma;

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

    return produtos.map((produto) => ({ ...produto, precoVenda: paraMoeda(deDecimal(produto.precoVenda)) }));
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
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "propostas.editar");
    const prisma = contextoTenant.prisma;

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

    // Centavo-exato (Fase 2A-2): preço unitário/desconto vêm do formulário em
    // reais/percentual, mas toda soma/multiplicação/desconto passa por
    // lib/dinheiro.ts — nunca ponto flutuante direto (o subtotal bruto/total
    // gravado tinha que bater, item a item, com a soma dos subtotais de cada
    // linha, e ponto flutuante puro não garante isso).
    const itensComCentavos = normalizedItems.map((item) => {
      const precoUnitarioCentavos = deDecimal(item.precoUnitario);
      const linhaBrutaCentavos = multiplicarPorQuantidade(precoUnitarioCentavos, item.quantidade);
      const linhaDescontoCentavos = aplicarPercentual(linhaBrutaCentavos, item.descontoPercentual);
      const linhaSubtotalCentavos = Math.max(0, subtrair(linhaBrutaCentavos, linhaDescontoCentavos));

      return { ...item, precoUnitarioCentavos, linhaBrutaCentavos, linhaDescontoCentavos, linhaSubtotalCentavos };
    });

    const subtotalBrutoCentavos = somar(...itensComCentavos.map((item) => item.linhaBrutaCentavos));
    const descontoTotalCentavos = somar(...itensComCentavos.map((item) => item.linhaDescontoCentavos));
    const valorTotalCentavos = Math.max(0, subtrair(subtotalBrutoCentavos, descontoTotalCentavos));

    const subtotalBruto = paraMoeda(subtotalBrutoCentavos);
    const descontoTotal = paraMoeda(descontoTotalCentavos);
    const valorTotal = paraMoeda(valorTotalCentavos);
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
        subtotalBruto: paraDecimal(subtotalBrutoCentavos),
        descontoTotal: paraDecimal(descontoTotalCentavos),
        valorTotal: paraDecimal(valorTotalCentavos),
        status,
        itens: {
          create: itensComCentavos.map((item) => ({
            descricao: item.descricao,
            quantidade: item.quantidade,
            precoUnitario: paraDecimal(item.precoUnitarioCentavos),
            descontoPercentual: item.descontoPercentual,
            subtotal: paraDecimal(item.linhaSubtotalCentavos),
          })),
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
