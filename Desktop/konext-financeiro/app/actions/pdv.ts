"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";

export interface ClientePDV {
  id: string;
  nomeRazaoSocial: string;
  documento: string;
  telefone: string;
}

export interface ProdutoPDVBanco {
  id: string;
  nome: string;
  preco: number;
  imagemUrl: string | null;
}

export interface CarrinhoItem {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  subtotal: number;
}

export interface PedidoOSPDV {
  osId: string;
  numeroOs: number;
  clienteId: string;
  nomeCliente: string;
  aparelho: string;
  defeito: string;
  valor: number;
  items: OrderServicePdvItem[];
}

export interface OrderServicePdvItem {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  totalPrice: number;
}

export type FormaPagamento =
  | "PIX"
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "BOLETO"
  | "CREDIARIO"
  | "EMPENHO_PUBLICO";

const paraCentavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
const paraMoeda = (centavos: number) => centavos / 100;

function normalizeMonetaryValue(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numericValue) || numericValue < 0) return 0;
  return numericValue;
}

function buildOrderServiceItemDescription(description: unknown, lineNumber: number): string {
  const normalizedDescription = String(description ?? "").trim();
  return normalizedDescription || `Item da OS ${lineNumber}`;
}

function normalizeOrderServiceError(error: unknown): Error {
  if (error instanceof Error && error.message.trim()) {
    return error;
  }

  return new Error("Erro ao gerar venda no PDV.");
}

type SalesHistoryMirrorItem = {
  produtoId?: string | null;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
};

async function createSalesHistoryMirror(
  transaction: Prisma.TransactionClient,
  input: {
    vendaId: string;
    clienteId?: string;
    vendedor: string;
    total: number;
    formaPagamento: FormaPagamento;
    dataCriacao?: Date;
    items: SalesHistoryMirrorItem[];
  }
) {
  await transaction.pedidoVenda.create({
    data: {
      venda: {
        connect: {
          id: input.vendaId,
        },
      },
      ...(input.clienteId
        ? {
            cliente: {
              connect: {
                id: input.clienteId,
              },
            },
          }
        : {}),
      vendedor: input.vendedor,
      total: input.total,
      status: "APROVADO",
      origem: "PDV",
      formaPagamento: input.formaPagamento,
      dataCriacao: input.dataCriacao ?? new Date(),
      itens: {
        create: input.items.map((item) => ({
          produtoId: item.produtoId ?? null,
          nome: item.nome,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          descontoPorcentagem: 0,
          subtotal: item.subtotal,
        })),
      },
    },
  });
}

type ClientePrismaAny = typeof prisma & {
  venda?: { create?: (args: unknown) => Promise<unknown> };
  Venda?: { create?: (args: unknown) => Promise<unknown> };
  itemVenda?: { create?: (args: unknown) => Promise<unknown> };
  ItemVenda?: { create?: (args: unknown) => Promise<unknown> };
  contaReceber?: { create?: (args: unknown) => Promise<unknown> };
  ContaReceber?: { create?: (args: unknown) => Promise<unknown> };
  ordemServico?: { update?: (args: unknown) => Promise<unknown> };
  OrdemServico?: { update?: (args: unknown) => Promise<unknown> };
};

type TransacaoPdv = Record<string, unknown> & {
  $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  $queryRaw?: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

function obterDelegateComFallback(
  tx: ClientePrismaAny,
  root: ClientePrismaAny,
  chaves: Array<keyof ClientePrismaAny>,
  nomeLogico: string
): { create: (args: unknown) => Promise<unknown> } {
  // Sempre prioriza delegates do contexto transacional para evitar inconsistência
  // entre create/update dentro da mesma transação.
  for (const chave of chaves) {
    const delegateTx = tx[chave] as { create?: (args: unknown) => Promise<unknown> } | undefined;
    if (delegateTx?.create) return delegateTx as { create: (args: unknown) => Promise<unknown> };
  }

  for (const chave of chaves) {
    const delegateRoot = root[chave] as
      | { create?: (args: unknown) => Promise<unknown> }
      | undefined;
    if (delegateRoot?.create)
      return delegateRoot as { create: (args: unknown) => Promise<unknown> };
  }

  throw new Error(`Delegate Prisma '${nomeLogico}' nao disponivel para operacao de create.`);
}

async function criarVendaComFallbackFormaPagamento(
  vendaDelegate: { create?: (args: unknown) => Promise<unknown> },
  dadosBase: Record<string, unknown>,
  formaPagamentoBanco:
    | "PIX"
    | "DINHEIRO"
    | "CARTAO_CREDITO"
    | "CARTAO_DEBITO"
    | "BOLETO"
    | "CREDIARIO"
    | "EMPENHO_PUBLICO"
) {
  try {
    return await vendaDelegate.create?.({
      data: {
        ...dadosBase,
        formaPagamento: formaPagamentoBanco,
      },
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "";

    // Fallback defensivo para runtime desatualizado do Prisma Client.
    if (mensagem.includes("Unknown argument `formaPagamento`")) {
      return vendaDelegate.create?.({
        data: dadosBase,
      });
    }

    throw erro;
  }
}

async function vincularVendaAoCaixa(tx: TransacaoPdv, vendaId: string, caixaSessionId: string) {
  const vendaDelegate = (tx?.venda ?? tx?.Venda) as
    | { update?: (args: unknown) => Promise<unknown> }
    | undefined;

  const ehRegistroNaoEncontrado = (erro: unknown): boolean => {
    if (!erro || typeof erro !== "object") return false;

    const erroComCodigo = erro as { code?: string; message?: string };
    if (erroComCodigo.code === "P2025") return true;

    const mensagem = erroComCodigo.message ?? "";
    return mensagem.includes("No record was found for an update");
  };

  const vincularViaSql = async () => {
    if (!tx.$executeRaw) {
      throw new Error("Nao foi possivel vincular a venda ao caixa aberto.");
    }

    const linhasAfetadas = await tx.$executeRaw`
      UPDATE "Venda"
      SET "caixaSessionId" = ${caixaSessionId}
      WHERE id = ${vendaId}
    `;

    if (!linhasAfetadas || Number(linhasAfetadas) === 0) {
      throw new Error("Nao foi possivel vincular a venda ao caixa aberto.");
    }
  };

  if (vendaDelegate?.update) {
    try {
      await vendaDelegate.update({
        where: {
          id: vendaId,
        },
        data: {
          caixaSession: {
            connect: {
              id: caixaSessionId,
            },
          },
        },
      });
      return;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      if (!mensagem.includes("Unknown argument `caixaSession`")) {
        if (ehRegistroNaoEncontrado(erro)) {
          await vincularViaSql();
          return;
        }
        throw erro;
      }
    }

    try {
      await vendaDelegate.update({
        where: {
          id: vendaId,
        },
        data: {
          caixaSessionId,
        },
      });
      return;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      if (!mensagem.includes("Unknown argument `caixaSessionId`")) {
        if (ehRegistroNaoEncontrado(erro)) {
          await vincularViaSql();
          return;
        }
        throw erro;
      }
    }
  }

  await vincularViaSql();
}

const mapearFormaPagamento = (
  formaPagamento: FormaPagamento
):
  | "PIX"
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "BOLETO"
  | "CREDIARIO"
  | "EMPENHO_PUBLICO" => {
  return formaPagamento;
};

async function obterCaixaSessionAberta(tx: TransacaoPdv): Promise<{ id: string }> {
  const caixaDelegate = (tx?.caixaSession ?? tx?.CaixaSession) as
    | { findFirst?: (args: unknown) => Promise<{ id?: string | number } | null> }
    | undefined;

  const caixa = caixaDelegate?.findFirst
    ? await caixaDelegate.findFirst({
        where: {
          status: "ABERTO",
        },
        orderBy: {
          dataAbertura: "desc",
        },
        select: {
          id: true,
        },
      })
    : tx.$queryRaw
      ? (
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "CaixaSession"
          WHERE status::text = 'ABERTO'
          ORDER BY "dataAbertura" DESC
          LIMIT 1
        `
      )?.[0]
      : null;

  if (!caixa?.id) {
    throw new Error("Nao existe caixa aberto. Abra o caixa para finalizar a venda.");
  }

  return { id: String(caixa.id) };
}

export async function listarClientesPDV(): Promise<ClientePDV[]> {
  const clientes = await prisma.cliente.findMany({
    where: {
      papel: "CLIENTE",
    },
    select: {
      id: true,
      nomeRazaoSocial: true,
      documento: true,
      telefone: true,
    },
    orderBy: {
      nomeRazaoSocial: "asc",
    },
  });

  return clientes;
}

export async function listarProdutosPDV(): Promise<ProdutoPDVBanco[]> {
  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      quantidadeEstoque: {
        gt: 0,
      },
    },
    select: {
      id: true,
      nome: true,
      precoVenda: true,
      imagemUrl: true,
    },
    orderBy: {
      nome: "asc",
    },
  });

  return produtos.map((produto) => ({
    id: produto.id,
    nome: produto.nome,
    preco: produto.precoVenda,
    imagemUrl: produto.imagemUrl,
  }));
}

export async function processarVenda(
  carrinho: CarrinhoItem[],
  total: number,
  formaPagamento: FormaPagamento,
  clienteId?: string
) {
  // C1: somente operadores autenticados podem registrar vendas.
  const sessionUser = await exigirSessao();

  if (carrinho.length === 0) {
    throw new Error("Carrinho vazio para processamento da venda.");
  }

  const totalCentavos = paraCentavos(total);
  const formaPagamentoBanco = mapearFormaPagamento(formaPagamento);
  const deferredPayments = ["CREDIARIO", "BOLETO", "EMPENHO_PUBLICO"] as const;

  try {
    const venda = await prisma.$transaction(async (tx) => {
      const txAny = tx as unknown as ClientePrismaAny;
      const prismaAny = prisma as unknown as ClientePrismaAny;
      const caixaAberto = await obterCaixaSessionAberta(tx);
      const idsProdutos = Array.from(new Set(carrinho.map((item) => item.id)));

      const produtosComCusto = await tx.produto.findMany({
        where: {
          id: {
            in: idsProdutos,
          },
        },
        select: {
          id: true,
          custo: true,
        },
      });

      const mapaCustoPorProduto = new Map(
        produtosComCusto.map((produto) => [produto.id, produto.custo])
      );

      const vendaDelegate = obterDelegateComFallback(
        txAny,
        prismaAny,
        ["venda", "Venda"],
        "venda"
      );
      const itemVendaDelegate = obterDelegateComFallback(
        txAny,
        prismaAny,
        ["itemVenda", "ItemVenda"],
        "itemVenda"
      );

      const dadosVendaBase = {
        ...(clienteId
          ? {
              cliente: {
                connect: {
                  id: clienteId,
                },
              },
            }
          : {}),
        valorTotal: paraMoeda(totalCentavos),
        desconto: 0,
      };

      const novaVenda = await criarVendaComFallbackFormaPagamento(
        vendaDelegate,
        dadosVendaBase,
        formaPagamentoBanco
      );

      if (!novaVenda) {
        throw new Error("Falha ao criar a venda no banco de dados.");
      }

      const vendaId = (novaVenda as { id: string }).id;

      await vincularVendaAoCaixa(tx, vendaId, caixaAberto.id);

      for (const item of carrinho) {
        const precoUnitarioCentavos = paraCentavos(item.preco);
        const custoUnitario = mapaCustoPorProduto.get(item.id);

        if (typeof custoUnitario !== "number") {
          throw new Error(`Produto ${item.nome} nao encontrado para composicao de custo.`);
        }

        const custoUnitarioCentavos = paraCentavos(custoUnitario);
        const subtotalCentavos = precoUnitarioCentavos * item.quantidade;

        await itemVendaDelegate.create({
          data: {
            venda: {
              connect: {
                id: vendaId,
              },
            },
            produto: {
              connect: {
                id: item.id,
              },
            },
            quantidade: item.quantidade,
            custoUnitario: paraMoeda(custoUnitarioCentavos),
            precoUnitario: paraMoeda(precoUnitarioCentavos),
            subtotal: paraMoeda(subtotalCentavos),
          },
        });
      }

      for (const item of carrinho) {
        const resultadoAtualizacao = await tx.produto.updateMany({
          where: {
            id: item.id,
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

        if (resultadoAtualizacao.count === 0) {
          throw new Error(`Estoque insuficiente para o produto ${item.nome}.`);
        }
      }

      // Verifica estoque baixo após decrementar e cria notificações de forma assíncrona e silenciosa.
      setImmediate(async () => {
        try {
          const prismaAny2 = prisma as typeof prisma & Record<string, unknown>;
          const produtoDelegate = prismaAny2.produto ?? prismaAny2.Produto;
          const notifDelegate = prismaAny2.notificacao ?? prismaAny2.Notificacao;
          if (!produtoDelegate?.findUnique || !notifDelegate?.create) return;

          for (const item of carrinho) {
            const produto = await produtoDelegate.findUnique({
              where: { id: item.id },
              select: { nome: true, quantidadeEstoque: true, estoqueMinimo: true },
            });
            if (!produto) continue;

            const limite = produto.estoqueMinimo ?? 3;
            if (produto.quantidadeEstoque <= limite) {
              const notifExistente = await notifDelegate.findFirst({
                where: {
                  lida: false,
                  titulo: "Estoque Baixo",
                  mensagem: { contains: produto.nome },
                },
              });
              if (!notifExistente) {
                await notifDelegate.create({
                  data: {
                    titulo: "Estoque Baixo",
                    mensagem: `Atenção: O estoque do item "${produto.nome}" está baixo (Restam: ${produto.quantidadeEstoque} unidades).`,
                  },
                });
              }
            }
          }
        } catch {
          // Notificação de estoque é opcional — falha silenciosa para não impactar a venda.
        }
      });
      if ((deferredPayments as readonly string[]).includes(formaPagamentoBanco)) {
        const contaReceberDelegate = obterDelegateComFallback(
          txAny,
          prismaAny,
          ["contaReceber", "ContaReceber"],
          "contaReceber"
        );

        await contaReceberDelegate.create({
          data: {
            descricao: `Venda PDV ${vendaId}`,
            valor: paraMoeda(totalCentavos),
            ...(clienteId
              ? {
                  cliente: {
                    connect: {
                      id: clienteId,
                    },
                  },
                }
              : {}),
            venda: {
              connect: {
                id: vendaId,
              },
            },
            dataVencimento: new Date(),
            status: "PENDENTE",
            formaRecebimento: formaPagamentoBanco,
            origem: "VENDA_PDV",
            notaFiscalEmitida: false,
          },
        });
      }

      await createSalesHistoryMirror(tx, {
        vendaId,
        clienteId,
        vendedor: sessionUser.nome,
        total: paraMoeda(totalCentavos),
        formaPagamento: formaPagamentoBanco,
        items: carrinho.map((item) => ({
          produtoId: item.id,
          nome: item.nome,
          quantidade: item.quantidade,
          precoUnitario: item.preco,
          subtotal: item.preco * item.quantidade,
        })),
      });

      return { id: vendaId };
    });

    revalidatePath("/");
    revalidatePath("/pdv");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/inteligencia");
    revalidatePath("/vendas/historico");

    return {
      vendaId: venda.id,
    };
  } catch (erro) {
    console.error("Erro ao processar venda no PDV:", erro);
    throw erro;
  }
}

export async function obterPedidoOSParaPDV(osId: string): Promise<PedidoOSPDV> {
  if (!osId) {
    throw new Error("ID da OS nao informado para envio ao PDV.");
  }

  const prismaAny = prisma as typeof prisma & Record<string, unknown>;
  type OrdemServicoPdv = {
    id: string | number;
    numeroOs?: string | number | null;
    clienteId: string;
    status?: string | null;
    equipamento?: string | null;
    relatoCliente?: string | null;
    cliente?: { nomeRazaoSocial?: string | null } | null;
    itens?: Array<{
      id?: string | number | null;
      descricao?: string | null;
      custoPeca?: number | null;
      valorCobrado?: number | null;
    }>;
  };

  const ordemServicoDelegate = (prismaAny.ordemServico ?? prismaAny.OrdemServico) as
    | { findUnique: (args: unknown) => Promise<OrdemServicoPdv | null>; findFirst?: (args: unknown) => Promise<unknown> }
    | undefined;
  const contaReceberDelegate = (prismaAny.contaReceber ?? prismaAny.ContaReceber) as
    | { findFirst: (args: unknown) => Promise<{ vendaId?: string | null } | null> }
    | undefined;

  if (!ordemServicoDelegate?.findUnique || !contaReceberDelegate?.findFirst) {
    throw new Error("Delegates Prisma de OS/ContaReceber nao disponiveis para o PDV.");
  }

  const os = await ordemServicoDelegate.findUnique({
    where: { id: osId },
    select: {
      id: true,
      numeroOs: true,
      clienteId: true,
      status: true,
      equipamento: true,
      relatoCliente: true,
      cliente: {
        select: {
          nomeRazaoSocial: true,
        },
      },
      itens: {
        select: {
          id: true,
          descricao: true,
          custoPeca: true,
          valorCobrado: true,
        },
      },
    },
  });

  if (!os) {
    throw new Error("Ordem de servico nao encontrada.");
  }

  if (String(os.status) !== "PRONTO") {
    throw new Error("A OS precisa estar com status PRONTO para envio ao PDV.");
  }

  const vendaExistente = await contaReceberDelegate.findFirst({
    where: {
      ordemServicoId: osId,
      origem: "ORDEM_SERVICO",
      vendaId: {
        not: null,
      },
    },
    select: {
      vendaId: true,
    },
  });

  if (vendaExistente?.vendaId) {
    throw new Error("Esta OS ja possui venda gerada.");
  }

  const items = (os.itens ?? []).map((item, index) => {
    const unitPrice = normalizeMonetaryValue(item.valorCobrado);
    const unitCost = normalizeMonetaryValue(item.custoPeca);
    const quantity = 1;

    return {
      id: String(item.id ?? `${os.id}-${index}`),
      description: buildOrderServiceItemDescription(item.descricao, index + 1),
      quantity,
      unitCost,
      unitPrice,
      totalPrice: unitPrice * quantity,
    };
  }).filter((item) => item.totalPrice > 0);

  const valor = items.reduce((accumulator, item) => accumulator + item.totalPrice, 0);

  if (valor <= 0) {
    throw new Error("A OS nao possui valor para faturamento. Adicione itens antes de enviar ao PDV.");
  }

  return {
    osId: String(os.id),
    numeroOs: Number(os.numeroOs ?? 0),
    clienteId: String(os.clienteId),
    nomeCliente: String(os.cliente?.nomeRazaoSocial ?? "Cliente nao informado"),
    aparelho: String(os.equipamento ?? "Equipamento nao informado"),
    defeito: String(os.relatoCliente ?? "Defeito nao informado"),
    valor,
    items,
  };
}

export async function processarVendaOSNoPDV(osId: string, formaPagamento: FormaPagamento) {
  return processarVendaComOSNoPDV(osId, [], formaPagamento);
}

export async function processarVendaComOSNoPDV(
  osId: string,
  carrinhoProdutos: CarrinhoItem[],
  formaPagamento: FormaPagamento
) {
  // C1: somente operadores autenticados podem faturar OS no PDV.
  const sessionUser = await exigirSessao();

  const pedido = await obterPedidoOSParaPDV(osId);
  const formaPagamentoBanco = mapearFormaPagamento(formaPagamento);
  const pagamentoAPrazo = ["CREDIARIO", "BOLETO", "EMPENHO_PUBLICO"] as const;
  const totalProdutosCentavos = carrinhoProdutos.reduce((acc, item) => {
    return acc + paraCentavos(item.preco) * item.quantidade;
  }, 0);
  const totalOSCentavos = paraCentavos(pedido.valor);
  const totalVendaCentavos = totalOSCentavos + totalProdutosCentavos;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const txAny = tx as unknown as ClientePrismaAny;
      const prismaAny = prisma as unknown as ClientePrismaAny;
      const caixaAberto = await obterCaixaSessionAberta(tx);

      const vendaDelegate = obterDelegateComFallback(txAny, prismaAny, ["venda", "Venda"], "venda");
      const contaReceberDelegate = obterDelegateComFallback(
        txAny,
        prismaAny,
        ["contaReceber", "ContaReceber"],
        "contaReceber"
      );
      const itemVendaDelegate = obterDelegateComFallback(
        txAny,
        prismaAny,
        ["itemVenda", "ItemVenda"],
        "itemVenda"
      );
      const ordemServicoDelegate = (txAny.ordemServico ?? txAny.OrdemServico) as
        | { update?: (args: unknown) => Promise<unknown> }
        | undefined;

      const contaExistente = await tx.contaReceber.findFirst({
        where: {
          ordemServicoId: pedido.osId,
          origem: "ORDEM_SERVICO",
          vendaId: {
            not: null,
          },
        },
        select: { id: true },
      });

      if (contaExistente) {
        throw new Error("Esta OS ja foi faturada anteriormente.");
      }

      const novaVenda = await criarVendaComFallbackFormaPagamento(
        vendaDelegate,
        {
          cliente: {
            connect: {
              id: pedido.clienteId,
            },
          },
          valorTotal: paraMoeda(totalVendaCentavos),
          desconto: 0,
        },
        formaPagamentoBanco
      );

      if (!novaVenda) {
        throw new Error("Falha ao gerar venda da OS no PDV.");
      }

      const vendaId = String((novaVenda as { id: string }).id);

      await vincularVendaAoCaixa(tx, vendaId, caixaAberto.id);

      for (const item of pedido.items) {
        const unitPriceInCents = paraCentavos(item.unitPrice);
        const unitCostInCents = paraCentavos(item.unitCost);
        const subtotalInCents = paraCentavos(item.totalPrice);

        await itemVendaDelegate.create({
          data: {
            venda: {
              connect: {
                id: vendaId,
              },
            },
            descricao: item.description,
            quantidade: item.quantity,
            custoUnitario: paraMoeda(unitCostInCents),
            precoUnitario: paraMoeda(unitPriceInCents),
            subtotal: paraMoeda(subtotalInCents),
          },
        });
      }

      if (carrinhoProdutos.length > 0) {
        const productIds = Array.from(new Set(carrinhoProdutos.map((item) => item.id)));
        const productsWithCost = await tx.produto.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
          select: {
            id: true,
            custo: true,
          },
        });

        const costByProductId = new Map(productsWithCost.map((product) => [product.id, product.custo]));

        for (const item of carrinhoProdutos) {
          const unitCost = costByProductId.get(item.id);
          if (typeof unitCost !== "number") {
            throw new Error(`Produto ${item.nome} nao encontrado para composicao de custo.`);
          }

          const unitPriceInCents = paraCentavos(item.preco);
          const unitCostInCents = paraCentavos(unitCost);
          const subtotalInCents = unitPriceInCents * item.quantidade;

          await itemVendaDelegate.create({
            data: {
              venda: {
                connect: {
                  id: vendaId,
                },
              },
              produto: {
                connect: {
                  id: item.id,
                },
              },
              descricao: item.nome,
              quantidade: item.quantidade,
              custoUnitario: paraMoeda(unitCostInCents),
              precoUnitario: paraMoeda(unitPriceInCents),
              subtotal: paraMoeda(subtotalInCents),
            },
          });
        }

        for (const item of carrinhoProdutos) {
          const updateResult = await tx.produto.updateMany({
            where: {
              id: item.id,
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

          if (updateResult.count === 0) {
            throw new Error(`Estoque insuficiente para o produto ${item.nome}.`);
          }
        }
      }

      const statusConta = (pagamentoAPrazo as readonly string[]).includes(formaPagamentoBanco)
        ? "PENDENTE"
        : "RECEBIDO";

      await contaReceberDelegate.create({
        data: {
          descricao: `OS #${pedido.numeroOs} - ${pedido.aparelho} (+itens PDV)`,
          valor: paraMoeda(totalVendaCentavos),
          cliente: {
            connect: {
              id: pedido.clienteId,
            },
          },
          ordemServico: {
            connect: {
              id: pedido.osId,
            },
          },
          venda: {
            connect: {
              id: vendaId,
            },
          },
          dataVencimento: new Date(),
          dataRecebimento: statusConta === "RECEBIDO" ? new Date() : null,
          status: statusConta,
          formaRecebimento: formaPagamentoBanco,
          origem: "ORDEM_SERVICO",
          notaFiscalEmitida: false,
        },
      });

      await createSalesHistoryMirror(tx, {
        vendaId,
        clienteId: pedido.clienteId,
        vendedor: sessionUser.nome,
        total: paraMoeda(totalVendaCentavos),
        formaPagamento: formaPagamentoBanco,
        items: [
          ...pedido.items.map((item) => ({
            produtoId: null,
            nome: item.description,
            quantidade: item.quantity,
            precoUnitario: item.unitPrice,
            subtotal: item.totalPrice,
          })),
          ...carrinhoProdutos.map((item) => ({
            produtoId: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
            precoUnitario: item.preco,
            subtotal: item.preco * item.quantidade,
          })),
        ],
      });

      return { vendaId };
    });

    revalidatePath("/pdv");
    revalidatePath("/os");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/inteligencia");
    revalidatePath("/vendas/historico");
    revalidatePath("/");

    return resultado;
  } catch (error) {
    throw normalizeOrderServiceError(error);
  }
}
