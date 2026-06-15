"use server";

import { FormaPagamento, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";

const pedidoVendaItemSchema = z.object({
  produtoId: z.string().optional(),
  nome: z.string().min(1, "O nome do produto é obrigatório"),
  quantidade: z.number().min(1, "A quantidade mínima é 1"),
  precoUnitario: z.number().min(0, "O preço unitário não pode ser negativo"),
  descontoPorcentagem: z.number().min(0, "O desconto não pode ser negativo"),
  subtotal: z.number(),
});

const pedidoVendaParcelaSchema = z.object({
  vencimento: z.date(),
  valor: z.number().min(0),
});

const pedidoVendaActionSchema = z.object({
  cliente: z.string().min(1, "O cliente é obrigatório"),
  dataVenda: z.date(),
  vendedor: z.string().min(1, "O vendedor é obrigatório"),
  dataSaida: z.date().optional(),
  listaPrecos: z.string().optional(),
  referencia: z.string().optional(),
  obsNfe: z.string().optional(),
  obsInterna: z.string().optional(),
  itens: z.array(pedidoVendaItemSchema).min(1, "O pedido deve conter ao menos um item"),
  formaPagamento: z.string().min(1, "A forma de pagamento é obrigatória"),
  acrescimos: z.number(),
  descontos: z.number(),
  parcelas: z.array(pedidoVendaParcelaSchema),
});

export type PedidoVendaSchemaType = z.infer<typeof pedidoVendaActionSchema>;

export type CreatePedidoVendaResult =
  | { success: true; message: string; orderId: string }
  | { success: false; message: string };

export type ApprovePedidoVendaResult =
  | { success: true; message: string }
  | { success: false; message: string };

const orderPaymentMethodMap: Record<string, FormaPagamento> = {
  pix: "PIX",
  ted: "TED",
  boleto: "BOLETO",
  "cartao-debito": "CARTAO_DEBITO",
  "cartao-credito-avista": "CARTAO_CREDITO_AVISTA",
  "cartao-credito-parcelado": "CARTAO_CREDITO_PARCELADO",
  dinheiro: "DINHEIRO",
};

const deferredPaymentMethods = new Set<FormaPagamento>([
  "BOLETO",
  "CARTAO_CREDITO_PARCELADO",
  "CREDIARIO",
  "EMPENHO_PUBLICO",
]);

const immediatePaymentMethods = new Set<FormaPagamento>([
  "PIX",
  "TED",
  "DINHEIRO",
  "CARTAO_DEBITO",
  "CARTAO_CREDITO",
  "CARTAO_CREDITO_AVISTA",
]);

function mapOrderPaymentMethod(paymentMethod: string): FormaPagamento {
  const mappedPaymentMethod = orderPaymentMethodMap[paymentMethod];

  if (!mappedPaymentMethod) {
    throw new Error("Forma de pagamento inválida para o pedido.");
  }

  return mappedPaymentMethod;
}

function isDeferredPaymentMethod(paymentMethod: FormaPagamento): boolean {
  return deferredPaymentMethods.has(paymentMethod);
}

function isImmediatePaymentMethod(paymentMethod: FormaPagamento): boolean {
  return immediatePaymentMethods.has(paymentMethod);
}

export async function createPedidoVenda(
  data: PedidoVendaSchemaType
): Promise<CreatePedidoVendaResult> {
  try {
    await exigirSessao();
    const validatedData = pedidoVendaActionSchema.parse(data);
    const paymentMethod = mapOrderPaymentMethod(validatedData.formaPagamento);

    const itemsSubtotal = validatedData.itens.reduce((total, item) => {
      const itemSubtotal = item.quantidade * item.precoUnitario * (1 - item.descontoPorcentagem / 100);
      return total + itemSubtotal;
    }, 0);

    const total = Math.max(0, itemsSubtotal + validatedData.acrescimos - validatedData.descontos);

    const createdOrder = await prisma.pedidoVenda.create({
      data: {
        clienteId: validatedData.cliente,
        vendedor: validatedData.vendedor,
        total,
        status: "PENDENTE",
        origem: "VENDAS",
        formaPagamento: paymentMethod,
        dataCriacao: validatedData.dataVenda,
        itens: {
          create: validatedData.itens.map((item) => ({
            produtoId: item.produtoId || null,
            nome: item.nome,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            descontoPorcentagem: item.descontoPorcentagem,
            subtotal: item.subtotal,
          })),
        },
        parcelas: {
          create: validatedData.parcelas.map((installment) => ({
            valor: installment.valor,
            dataVencimento: installment.vencimento,
          })),
        },
      },
      select: {
        id: true,
      },
    });

    revalidatePath("/vendas/historico");

    return {
      success: true,
      message: "Pedido de venda criado com sucesso.",
      orderId: createdOrder.id,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Sessão")) {
      return { success: false, message: error.message };
    }

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.issues[0]?.message || "Dados inválidos para criar o pedido.",
      };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Não foi possível salvar o pedido de venda no banco de dados.",
      };
    }

    console.error("Erro ao criar pedido de venda:", error);

    return {
      success: false,
      message: "Não foi possível criar o pedido de venda.",
    };
  }
}

export async function aprovarPedido(pedidoId: string): Promise<ApprovePedidoVendaResult> {
  try {
    await exigirSessao();

    if (!pedidoId.trim()) {
      return { success: false, message: "Pedido de venda inválido." };
    }

    await prisma.$transaction(async (transaction) => {
      const order = await transaction.pedidoVenda.findUnique({
        where: { id: pedidoId },
        include: {
          itens: true,
          cliente: {
            select: {
              id: true,
              nomeRazaoSocial: true,
              nomeFantasia: true,
            },
          },
          parcelas: {
            orderBy: {
              dataVencimento: "asc",
            },
          },
        },
      });

      if (!order) {
        throw new Error("Pedido de venda não encontrado.");
      }

      if (order.status !== "PENDENTE") {
        throw new Error("Este pedido já foi processado e não pode ser alterado.");
      }

      if (!order.formaPagamento) {
        throw new Error("O pedido não possui forma de pagamento informada.");
      }

      const paymentMethod = order.formaPagamento;

      for (const item of order.itens) {
        if (!item.produtoId) {
          continue;
        }

        const inventoryUpdate = await transaction.produto.updateMany({
          where: {
            id: item.produtoId,
            quantidadeEstoque: {
              gte: item.quantidade,
            },
          },
          data: {
            quantidadeEstoque: {
              decrement: item.quantidade,
            },
          },
        });

        if (inventoryUpdate.count === 0) {
          throw new Error(`Estoque insuficiente para o produto ${item.nome}.`);
        }
      }

      const customerLabel =
        order.cliente?.nomeFantasia?.trim() || order.cliente?.nomeRazaoSocial || "Cliente não informado";

      if (isDeferredPaymentMethod(paymentMethod) && order.parcelas.length > 0) {
        await transaction.contaReceber.createMany({
          data: order.parcelas.map((installment, index) => ({
            pedidoId: order.id,
            clienteId: order.clienteId ?? null,
            descricao: `Pedido #${order.numeroPedido} - Parcela ${index + 1}/${order.parcelas.length}`,
            valor: installment.valor,
            dataVencimento: installment.dataVencimento,
            status: "PENDENTE",
            formaPagamento: paymentMethod,
            formaRecebimento: paymentMethod,
            origem: "AVULSO",
            observacaoLancamento: `Conta a receber gerada na aprovação do pedido para ${customerLabel}.`,
            parcelamentoId: order.parcelas.length > 1 ? order.id : null,
            numeroParcela: index + 1,
            totalParcelas: order.parcelas.length,
          })),
        });
      }

      if (isImmediatePaymentMethod(paymentMethod)) {
        await transaction.contaReceber.create({
          data: {
            pedidoId: order.id,
            clienteId: order.clienteId ?? null,
            descricao: `Pedido #${order.numeroPedido} - Recebimento imediato`,
            valor: order.total,
            dataVencimento: order.dataCriacao,
            dataRecebimento: new Date(),
            status: "RECEBIDO",
            formaPagamento: paymentMethod,
            formaRecebimento: paymentMethod,
            origem: "AVULSO",
            observacaoLancamento: `Recebimento imediato registrado na aprovação do pedido para ${customerLabel}.`,
            numeroParcela: 1,
            totalParcelas: 1,
          },
        });
      }

      await transaction.pedidoVenda.update({
        where: { id: order.id },
        data: { status: "APROVADO" },
      });
    });

    revalidatePath("/vendas/historico");
    revalidatePath("/financeiro/receber");

    return {
      success: true,
      message: "Pedido aprovado com sucesso.",
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Sessão")) {
      return { success: false, message: error.message };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Não foi possível aprovar o pedido de venda no banco de dados.",
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }

    console.error("Erro ao aprovar pedido de venda:", error);

    return {
      success: false,
      message: "Não foi possível aprovar o pedido de venda.",
    };
  }
}

export async function rejeitarPedido(pedidoId: string): Promise<ApprovePedidoVendaResult> {
  try {
    await exigirSessao();

    if (!pedidoId.trim()) {
      return { success: false, message: "Pedido de venda inválido." };
    }

    await prisma.$transaction(async (transaction) => {
      const order = await transaction.pedidoVenda.findUnique({
        where: { id: pedidoId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!order) {
        throw new Error("Pedido de venda não encontrado.");
      }

      if (order.status !== "PENDENTE") {
        throw new Error("Este pedido já foi processado e não pode ser alterado.");
      }

      await transaction.pedidoVenda.update({
        where: { id: order.id },
        data: { status: "REJEITADO" },
      });
    });

    revalidatePath("/vendas/historico");

    return {
      success: true,
      message: "Pedido rejeitado com sucesso.",
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Sessão")) {
      return { success: false, message: error.message };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Não foi possível rejeitar o pedido de venda no banco de dados.",
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }

    console.error("Erro ao rejeitar pedido de venda:", error);

    return {
      success: false,
      message: "Não foi possível rejeitar o pedido de venda.",
    };
  }
}

export async function cancelarPedido(pedidoId: string): Promise<ApprovePedidoVendaResult> {
  try {
    await exigirSessao();

    if (!pedidoId.trim()) {
      return { success: false, message: "Pedido de venda inválido." };
    }

    await prisma.$transaction(async (transaction) => {
      const order = await transaction.pedidoVenda.findUnique({
        where: { id: pedidoId },
        include: {
          itens: true,
        },
      });

      if (!order) {
        throw new Error("Pedido de venda não encontrado.");
      }

      if (order.origem !== "PDV") {
        throw new Error("Somente vendas do PDV podem ser estornadas por esta ação.");
      }

      if (order.status !== "APROVADO") {
        throw new Error("Este pedido não está elegível para estorno.");
      }

      for (const item of order.itens) {
        if (!item.produtoId) {
          continue;
        }

        await transaction.produto.update({
          where: {
            id: item.produtoId,
          },
          data: {
            quantidadeEstoque: {
              increment: item.quantidade,
            },
          },
        });
      }

      const receivableWhere = [
        { pedidoId: order.id },
        ...(order.vendaId ? [{ vendaId: order.vendaId }] : []),
      ];

      await transaction.contaReceber.deleteMany({
        where: {
          OR: receivableWhere,
        },
      });

      await transaction.pedidoVenda.update({
        where: { id: order.id },
        data: { status: "CANCELADO" },
      });
    });

    revalidatePath("/vendas/historico");
    revalidatePath("/financeiro/receber");

    return {
      success: true,
      message: "Pedido cancelado com sucesso.",
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Sessão")) {
      return { success: false, message: error.message };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        message: "Não foi possível cancelar o pedido de venda no banco de dados.",
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }

    console.error("Erro ao cancelar pedido de venda:", error);

    return {
      success: false,
      message: "Não foi possível cancelar o pedido de venda.",
    };
  }
}
