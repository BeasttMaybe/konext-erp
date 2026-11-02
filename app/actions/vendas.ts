"use server";

import { FormaPagamento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { paraMensagemSegura } from "@/lib/erros";
import {
  aplicarPercentual,
  deDecimal,
  multiplicarPorQuantidade,
  paraDecimal,
  paraMoeda,
  somar,
  subtrair,
} from "@/lib/dinheiro";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { decidirDestinoDoEstorno, pedidoPodeSerEstornado } from "@/lib/dominio/financeiro/estorno";
import { registrarMovimentacaoEstoque } from "@/lib/estoque-movimentacao";

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
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "vendas.criar");
    const { prisma } = contexto;
    const validatedData = pedidoVendaActionSchema.parse(data);
    const paymentMethod = mapOrderPaymentMethod(validatedData.formaPagamento);

    // Centavo-exato (Fase 2A-2): antes, item.quantidade * item.precoUnitario *
    // (1 - desconto/100) era somado em ponto flutuante puro, sem nenhum
    // arredondamento — o único fluxo de "venda"/"pedido" no app que não
    // passava por lib/dinheiro.ts nem por paraCentavos/paraMoeda.
    const itemsSubtotalCentavos = somar(
      ...validatedData.itens.map((item) => {
        const precoUnitarioCentavos = deDecimal(item.precoUnitario);
        const brutoCentavos = multiplicarPorQuantidade(precoUnitarioCentavos, item.quantidade);
        const descontoCentavos = aplicarPercentual(brutoCentavos, item.descontoPorcentagem);
        return subtrair(brutoCentavos, descontoCentavos);
      })
    );

    const totalCentavos = Math.max(
      0,
      subtrair(somar(itemsSubtotalCentavos, deDecimal(validatedData.acrescimos)), deDecimal(validatedData.descontos))
    );

    const createdOrder = await prisma.pedidoVenda.create({
      data: {
        clienteId: validatedData.cliente,
        vendedor: validatedData.vendedor,
        total: paraDecimal(totalCentavos),
        status: "PENDENTE",
        origem: "VENDAS",
        formaPagamento: paymentMethod,
        dataCriacao: validatedData.dataVenda,
        itens: {
          create: validatedData.itens.map((item) => ({
            produtoId: item.produtoId || null,
            nome: item.nome,
            quantidade: item.quantidade,
            precoUnitario: paraDecimal(deDecimal(item.precoUnitario)),
            descontoPorcentagem: item.descontoPorcentagem,
            subtotal: paraDecimal(deDecimal(item.subtotal)),
          })),
        },
        parcelas: {
          create: validatedData.parcelas.map((installment) => ({
            valor: paraDecimal(deDecimal(installment.valor)),
            dataVencimento: installment.vencimento,
          })),
        },
      },
      select: {
        id: true,
      },
    });

    revalidatePath("/vendas/historico");
    revalidatePath("/");

    return {
      success: true,
      message: "Pedido de venda criado com sucesso.",
      orderId: createdOrder.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.issues[0]?.message || "Dados inválidos para criar o pedido.",
      };
    }

    return {
      success: false,
      message: paraMensagemSegura(error),
    };
  }
}

export async function aprovarPedido(pedidoId: string): Promise<ApprovePedidoVendaResult> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "vendas.aprovar");
    const { prisma } = contexto;

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

        // Fase 4: o livro de movimentacoes e gravado NESTA transacao. O saldo
        // posterior vem de uma leitura e nao do `updateMany`, que devolve so a
        // contagem — e o `updateMany` fica porque a guarda `gte` e o que torna
        // a baixa atomica contra venda sem estoque.
        // `PedidoVendaItem` nao guarda custo, so preco de venda — o custo vem
        // do produto, na mesma leitura do saldo.
        const produtoBaixado = await transaction.produto.findUnique({
          where: { id: item.produtoId },
          select: { quantidadeEstoque: true, custo: true },
        });

        await registrarMovimentacaoEstoque(transaction, {
          produtoId: item.produtoId,
          origem: "PEDIDO_VENDA",
          quantidade: item.quantidade,
          saldoPosterior: produtoBaixado?.quantidadeEstoque ?? null,
          custoUnitario: produtoBaixado ? String(produtoBaixado.custo) : null,
          vendaId: order.vendaId ?? null,
          observacao: `Pedido de venda ${order.id}`,
          registradoPorId: contexto.usuarioOperacional?.id ?? null,
        });
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
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/");

    return {
      success: true,
      message: "Pedido aprovado com sucesso.",
    };
  } catch (error) {
    return {
      success: false,
      message: paraMensagemSegura(error),
    };
  }
}

export async function rejeitarPedido(pedidoId: string): Promise<ApprovePedidoVendaResult> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "vendas.cancelar");
    const { prisma } = contexto;

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
    revalidatePath("/");

    return {
      success: true,
      message: "Pedido rejeitado com sucesso.",
    };
  } catch (error) {
    return {
      success: false,
      message: paraMensagemSegura(error),
    };
  }
}

export async function cancelarPedido(pedidoId: string): Promise<ApprovePedidoVendaResult> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "vendas.cancelar");
    const { prisma } = contexto;

    if (!pedidoId.trim()) {
      return { success: false, message: "Pedido de venda inválido." };
    }

    let valorEstornado: number | null = null;
    let motivoDoDestino = "";

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

      if (!pedidoPodeSerEstornado(order.status)) {
        throw new Error("Este pedido não está elegível para estorno.");
      }

      for (const item of order.itens) {
        if (!item.produtoId) {
          continue;
        }

        const produtoDevolvido = await transaction.produto.update({
          where: {
            id: item.produtoId,
          },
          data: {
            quantidadeEstoque: {
              increment: item.quantidade,
            },
          },
          select: { quantidadeEstoque: true, custo: true },
        });

        await registrarMovimentacaoEstoque(transaction, {
          produtoId: item.produtoId,
          origem: "ESTORNO_VENDA",
          quantidade: item.quantidade,
          saldoPosterior: produtoDevolvido.quantidadeEstoque,
          custoUnitario: String(produtoDevolvido.custo),
          vendaId: order.vendaId ?? null,
          observacao: `Estorno do pedido ${order.id}`,
          registradoPorId: contexto.usuarioOperacional?.id ?? null,
        });
      }

      // Fase 2A-3 (regra de estorno): a conta a receber e MARCADA, nao
      // apagada. O `deleteMany` que estava aqui nao deixava rastro nenhum de
      // que a venda existiu e foi cancelada — e esta action tambem nao
      // gravava log de auditoria, entao nao havia por onde reconstruir.
      const agora = new Date();
      const receivableWhere = [
        { pedidoId: order.id },
        ...(order.vendaId ? [{ vendaId: order.vendaId }] : []),
      ];

      const contasEstornadas = await transaction.contaReceber.updateMany({
        where: {
          OR: receivableWhere,
          estornadaEm: null,
        },
        data: {
          status: "ESTORNADO",
          estornadaEm: agora,
        },
      });

      // A venda nunca sai da sessao de caixa dela: o esperado de fechamento
      // daquela sessao e recalculado ao vivo somando as vendas dela, e mexer
      // nisso mudaria, depois do fato, a diferenca que alguem ja conferiu.
      // O estorno e um movimento separado, e `decidirDestinoDoEstorno` diz em
      // qual sessao ele cai — ver lib/dominio/financeiro/estorno.ts.
      let destino = decidirDestinoDoEstorno(null, null);

      if (order.vendaId) {
        const venda = await transaction.venda.findUnique({
          where: { id: order.vendaId },
          select: {
            valorTotal: true,
            caixaSession: { select: { id: true, status: true } },
          },
        });

        const sessaoAberta = await transaction.caixaSession.findFirst({
          where: { status: "ABERTO" },
          orderBy: { dataAbertura: "desc" },
          select: { id: true, status: true },
        });

        destino = decidirDestinoDoEstorno(venda?.caixaSession ?? null, sessaoAberta ?? null);

        await transaction.venda.update({
          where: { id: order.vendaId },
          data: {
            estornadaEm: agora,
            estornoCaixaSessionId: destino.sessaoDestinoId,
          },
        });

        valorEstornado = venda ? paraMoeda(deDecimal(venda.valorTotal)) : null;
      }

      await transaction.pedidoVenda.update({
        where: { id: order.id },
        data: { status: "CANCELADO" },
      });

      await registrarLogAuditoria(
        transaction,
        contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/vendas.ts:cancelarPedido"),
        {
          acao: ACOES_AUDITORIA.ESTORNAR_VENDA,
          entidade: ENTIDADES_AUDITORIA.VENDA,
          entidadeId: order.vendaId ?? order.id,
          dadosAntes: {
            pedidoId: order.id,
            statusAnterior: order.status,
            valorEstornado,
          },
          dadosDepois: {
            statusNovo: "CANCELADO",
            contasReceberEstornadas: contasEstornadas.count,
            caixaSessionDoEstorno: destino.sessaoDestinoId,
            motivoDoDestino: destino.motivo,
            itensDevolvidosAoEstoque: order.itens.filter((item) => item.produtoId).length,
          },
        }
      );

      motivoDoDestino = destino.motivo;
    });

    revalidatePath("/vendas/historico");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/");

    return {
      success: true,
      // Diz onde o estorno caiu: com caixa de outro dia, quem esta no balcao
      // precisa saber que o dinheiro sai da gaveta de HOJE.
      message: motivoDoDestino
        ? `Pedido estornado com sucesso. ${motivoDoDestino}`
        : "Pedido estornado com sucesso.",
    };
  } catch (error) {
    return {
      success: false,
      message: paraMensagemSegura(error),
    };
  }
}
