"use server";

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

type ClientePrismaAny = typeof prisma & {
  venda?: { create?: (args: unknown) => Promise<unknown> };
  Venda?: { create?: (args: unknown) => Promise<unknown> };
  itemVenda?: { create?: (args: unknown) => Promise<unknown> };
  ItemVenda?: { create?: (args: unknown) => Promise<unknown> };
  contaReceber?: { create?: (args: unknown) => Promise<unknown> };
  ContaReceber?: { create?: (args: unknown) => Promise<unknown> };
};

function obterDelegateComFallback(
  tx: ClientePrismaAny,
  root: ClientePrismaAny,
  chaves: Array<keyof ClientePrismaAny>,
  nomeLogico: string
): { create: (args: unknown) => Promise<unknown> } {
  for (const chave of chaves) {
    const delegateTx = tx[chave] as { create?: (args: unknown) => Promise<unknown> } | undefined;
    if (delegateTx?.create) return delegateTx as { create: (args: unknown) => Promise<unknown> };

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

async function vincularVendaAoCaixa(tx: any, vendaId: string, caixaSessionId: string) {
  const vendaDelegate = tx?.venda ?? tx?.Venda;

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
        throw erro;
      }
    }
  }

  await tx.$executeRaw`
    UPDATE "Venda"
    SET "caixaSessionId" = ${caixaSessionId}
    WHERE id = ${vendaId}
  `;
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

async function obterCaixaSessionAberta(tx: any): Promise<{ id: string }> {
  const caixaDelegate = tx?.caixaSession ?? tx?.CaixaSession;

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
    : (
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "CaixaSession"
          WHERE status::text = 'ABERTO'
          ORDER BY "dataAbertura" DESC
          LIMIT 1
        `
      )?.[0];

  if (!caixa?.id) {
    throw new Error("Nao existe caixa aberto. Abra o caixa para finalizar a venda.");
  }

  return { id: String(caixa.id) };
}

export async function listarClientesPDV(): Promise<ClientePDV[]> {
  const clientes = await prisma.cliente.findMany({
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
  await exigirSessao();

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
          const prismaAny2 = prisma as any;
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

      return { id: vendaId };
    });

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

  const prismaAny = prisma as any;
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;
  const contaReceberDelegate = prismaAny.contaReceber ?? prismaAny.ContaReceber;

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

  const valor = (os.itens ?? []).reduce((acumulado: number, item: any) => {
    const valorItem = typeof item.valorCobrado === "number" ? item.valorCobrado : Number(item.valorCobrado ?? 0);
    return acumulado + (Number.isFinite(valorItem) ? valorItem : 0);
  }, 0);

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
  await exigirSessao();

  const pedido = await obterPedidoOSParaPDV(osId);
  const formaPagamentoBanco = mapearFormaPagamento(formaPagamento);
  const pagamentoAPrazo = ["CREDIARIO", "BOLETO", "EMPENHO_PUBLICO"] as const;
  const totalProdutosCentavos = carrinhoProdutos.reduce((acc, item) => {
    return acc + paraCentavos(item.preco) * item.quantidade;
  }, 0);
  const totalOSCentavos = paraCentavos(pedido.valor);
  const totalVendaCentavos = totalOSCentavos + totalProdutosCentavos;

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

    if (carrinhoProdutos.length > 0) {
      const idsProdutos = Array.from(new Set(carrinhoProdutos.map((item) => item.id)));
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

      const mapaCustoPorProduto = new Map(produtosComCusto.map((produto) => [produto.id, produto.custo]));

      for (const item of carrinhoProdutos) {
        const custoUnitario = mapaCustoPorProduto.get(item.id);
        if (typeof custoUnitario !== "number") {
          throw new Error(`Produto ${item.nome} nao encontrado para composicao de custo.`);
        }

        const precoUnitarioCentavos = paraCentavos(item.preco);
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

      for (const item of carrinhoProdutos) {
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
    }

    const statusConta = (pagamentoAPrazo as readonly string[]).includes(formaPagamentoBanco) ? "PENDENTE" : "RECEBIDO";

    await contaReceberDelegate.create({
      data: {
        descricao: `OS #${pedido.numeroOs} - ${pedido.aparelho} (+itens PDV)` ,
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

    return { vendaId };
  });

  return resultado;
}
