"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterDefaultsConfiguracaoOsGarantias } from "@/lib/configuracoes-os-garantias";
import {
  calcularPagamentoPdv,
  ehPagamentoPrazo,
  type EntradaPagamentoPdv,
  type FormaPagamentoPdv,
  type ResultadoPagamentoPdv,
} from "@/lib/pdv/pagamentos";

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

export type FormaPagamento = FormaPagamentoPdv;

export interface PagamentoPdvInput extends EntradaPagamentoPdv {}

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
    formaPagamento: FormaPagamentoPdv;
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
  vendaPagamento?: { create?: (args: unknown) => Promise<unknown> };
  VendaPagamento?: { create?: (args: unknown) => Promise<unknown> };
  ordemServico?: { update?: (args: unknown) => Promise<unknown> };
  OrdemServico?: { update?: (args: unknown) => Promise<unknown> };
};

type TransacaoPdv = Record<string, unknown> & {
  $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  $queryRaw?: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

type DelegateCreate = { create: (args: unknown) => Promise<unknown> };

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

function obterDelegateComFallbackOpcional(
  tx: ClientePrismaAny,
  root: ClientePrismaAny,
  chaves: Array<keyof ClientePrismaAny>
): DelegateCreate | null {
  for (const chave of chaves) {
    const delegateTx = tx[chave] as { create?: (args: unknown) => Promise<unknown> } | undefined;
    if (delegateTx?.create) return delegateTx as DelegateCreate;
  }

  for (const chave of chaves) {
    const delegateRoot = root[chave] as { create?: (args: unknown) => Promise<unknown> } | undefined;
    if (delegateRoot?.create) return delegateRoot as DelegateCreate;
  }

  return null;
}

async function criarVendaPagamentoComFallback(
  tx: TransacaoPdv,
  vendaPagamentoDelegate: DelegateCreate | null,
  input: {
    vendaId: string;
    formaPagamento:
      | "PIX"
      | "TED"
      | "DINHEIRO"
      | "CARTAO_CREDITO"
      | "CARTAO_CREDITO_AVISTA"
      | "CARTAO_CREDITO_PARCELADO"
      | "CARTAO_DEBITO"
      | "BOLETO"
      | "CREDIARIO"
      | "EMPENHO_PUBLICO";
    valorBruto: number;
    percentualTaxa: number;
    valorTaxa: number;
    valorLiquido: number;
    parcelas: number;
    diasVencimento: number | null;
    dataVencimento: Date | null;
  }
): Promise<string> {
  if (vendaPagamentoDelegate) {
    try {
      const criado = await vendaPagamentoDelegate.create({
        data: {
          venda: {
            connect: {
              id: input.vendaId,
            },
          },
          formaPagamento: input.formaPagamento,
          valorBruto: input.valorBruto,
          percentualTaxa: input.percentualTaxa,
          valorTaxa: input.valorTaxa,
          valorLiquido: input.valorLiquido,
          parcelas: input.parcelas,
          diasVencimento: input.diasVencimento,
          dataVencimento: input.dataVencimento,
        },
      });

      return String((criado as { id: string }).id);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      if (!mensagem.includes("Unknown argument") && !mensagem.includes("delegate")) {
        throw erro;
      }
    }
  }

  if (!tx.$queryRaw) {
    throw new Error("Nao foi possivel registrar os pagamentos da venda.");
  }

  const registro = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "VendaPagamento" (
      id,
      "vendaId",
      "formaPagamento",
      "valorBruto",
      "percentualTaxa",
      "valorTaxa",
      "valorLiquido",
      parcelas,
      "diasVencimento",
      "dataVencimento",
      "criadoEm",
      "atualizadoEm"
    )
    VALUES (
      gen_random_uuid()::text,
      ${input.vendaId},
      ${input.formaPagamento}::"FormaPagamento",
      ${input.valorBruto},
      ${input.percentualTaxa},
      ${input.valorTaxa},
      ${input.valorLiquido},
      ${input.parcelas},
      ${input.diasVencimento},
      ${input.dataVencimento},
      NOW(),
      NOW()
    )
    RETURNING id
  `;

  const id = registro?.[0]?.id;
  if (!id) {
    throw new Error("Nao foi possivel registrar os pagamentos da venda.");
  }

  return String(id);
}

async function criarContaReceberComFallbackVendaPagamento(
  contaReceberDelegate: { create: (args: unknown) => Promise<unknown> },
  dataBase: Record<string, unknown>,
  vendaPagamentoId?: string
) {
  const dataComVinculo = vendaPagamentoId
    ? {
        ...dataBase,
        vendaPagamento: {
          connect: {
            id: vendaPagamentoId,
          },
        },
      }
    : dataBase;

  try {
    return await contaReceberDelegate.create({ data: dataComVinculo });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "";
    if (mensagem.includes("Unknown argument `vendaPagamento`")) {
      return contaReceberDelegate.create({ data: dataBase });
    }

    throw erro;
  }
}

async function criarVendaComFallbackFormaPagamento(
  vendaDelegate: { create?: (args: unknown) => Promise<unknown> },
  dadosBase: Record<string, unknown>,
  formaPagamentoBanco:
    | "PIX"
    | "TED"
    | "DINHEIRO"
    | "CARTAO_CREDITO"
    | "CARTAO_CREDITO_AVISTA"
    | "CARTAO_CREDITO_PARCELADO"
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
  | "TED"
  | "DINHEIRO"
  | "CARTAO_CREDITO"
  | "CARTAO_CREDITO_AVISTA"
  | "CARTAO_CREDITO_PARCELADO"
  | "CARTAO_DEBITO"
  | "BOLETO"
  | "CREDIARIO"
  | "EMPENHO_PUBLICO" => {
  return formaPagamento;
};

function normalizarPagamentosEntrada(
  pagamentos: PagamentoPdvInput[]
): ResultadoPagamentoPdv[] {
  if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
    throw new Error("Informe ao menos uma forma de pagamento para concluir a venda.");
  }

  return pagamentos.map((pagamento) => calcularPagamentoPdv(pagamento));
}

function validarTotalPagamentos(
  pagamentos: ResultadoPagamentoPdv[],
  totalVendaCentavos: number
) {
  const totalPagamentosCentavos = pagamentos.reduce((acc, pagamento) => {
    return acc + paraCentavos(pagamento.valorBruto);
  }, 0);

  if (totalPagamentosCentavos !== totalVendaCentavos) {
    throw new Error("A soma dos pagamentos deve ser igual ao total da venda.");
  }
}

function obterFormaPrincipal(pagamentos: ResultadoPagamentoPdv[]): FormaPagamento {
  const ordenados = [...pagamentos].sort((a, b) => b.valorBruto - a.valorBruto);
  return ordenados[0]?.formaPagamento ?? "DINHEIRO";
}

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
  pagamentos: PagamentoPdvInput[],
  clienteId?: string
) {
  // C1: somente operadores autenticados podem registrar vendas.
  const sessionUser = await exigirSessao();

  if (carrinho.length === 0) {
    throw new Error("Carrinho vazio para processamento da venda.");
  }

  const totalCentavos = paraCentavos(total);
  const pagamentosProcessados = normalizarPagamentosEntrada(pagamentos);
  validarTotalPagamentos(pagamentosProcessados, totalCentavos);
  const formaPagamentoPrincipal = obterFormaPrincipal(pagamentosProcessados);
  const formaPagamentoBanco = mapearFormaPagamento(formaPagamentoPrincipal);

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
      const vendaPagamentoDelegate = obterDelegateComFallbackOpcional(
        txAny,
        prismaAny,
        ["vendaPagamento", "VendaPagamento"]
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
      const contaReceberDelegate = obterDelegateComFallback(
        txAny,
        prismaAny,
        ["contaReceber", "ContaReceber"],
        "contaReceber"
      );

      for (const pagamento of pagamentosProcessados) {
        const formaPagamentoAtual = mapearFormaPagamento(pagamento.formaPagamento);
        const vendaPagamentoId = await criarVendaPagamentoComFallback(tx, vendaPagamentoDelegate, {
          vendaId,
          formaPagamento: formaPagamentoAtual,
          valorBruto: pagamento.valorBruto,
          percentualTaxa: pagamento.percentualTaxa,
          valorTaxa: pagamento.valorTaxa,
          valorLiquido: pagamento.valorLiquido,
          parcelas: pagamento.parcelas,
          diasVencimento: pagamento.diasVencimento,
          dataVencimento: pagamento.dataVencimento,
        });

        if (ehPagamentoPrazo(pagamento.formaPagamento)) {
          await criarContaReceberComFallbackVendaPagamento(
            contaReceberDelegate,
            {
              descricao: `Venda PDV ${vendaId} - ${pagamento.formaPagamento}`,
              valor: pagamento.valorBruto,
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
              dataVencimento: pagamento.dataVencimento ?? new Date(),
              status: "PENDENTE",
              formaRecebimento: formaPagamentoAtual,
              origem: "VENDA_PDV",
              notaFiscalEmitida: false,
            },
            vendaPagamentoId
          );
        }
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

  const configuracao = await prisma.configuracao.findFirst({
    orderBy: { criadoEm: "asc" },
    select: {
      exigirItemParaEnviarPDV: true,
    },
  });
  const exigirItemParaEnviarPDV =
    typeof configuracao?.exigirItemParaEnviarPDV === "boolean"
      ? Boolean(configuracao.exigirItemParaEnviarPDV)
      : obterDefaultsConfiguracaoOsGarantias().exigirItemParaEnviarPDV;

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

  if (exigirItemParaEnviarPDV && (os.itens ?? []).length === 0) {
    throw new Error("Para enviar ao PDV, cadastre pelo menos uma peça ou serviço na OS.");
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

export async function processarVendaOSNoPDV(osId: string, pagamentos: PagamentoPdvInput[]) {
  return processarVendaComOSNoPDV(osId, [], pagamentos);
}

export async function processarVendaComOSNoPDV(
  osId: string,
  carrinhoProdutos: CarrinhoItem[],
  pagamentos: PagamentoPdvInput[]
) {
  // C1: somente operadores autenticados podem faturar OS no PDV.
  const sessionUser = await exigirSessao();

  const pedido = await obterPedidoOSParaPDV(osId);
  const totalProdutosCentavos = carrinhoProdutos.reduce((acc, item) => {
    return acc + paraCentavos(item.preco) * item.quantidade;
  }, 0);
  const totalOSCentavos = paraCentavos(pedido.valor);
  const totalVendaCentavos = totalOSCentavos + totalProdutosCentavos;
  const pagamentosProcessados = normalizarPagamentosEntrada(pagamentos);
  validarTotalPagamentos(pagamentosProcessados, totalVendaCentavos);
  const formaPagamentoPrincipal = obterFormaPrincipal(pagamentosProcessados);
  const formaPagamentoBanco = mapearFormaPagamento(formaPagamentoPrincipal);

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
      const vendaPagamentoDelegate = obterDelegateComFallbackOpcional(
        txAny,
        prismaAny,
        ["vendaPagamento", "VendaPagamento"]
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

      for (const pagamento of pagamentosProcessados) {
        const formaPagamentoAtual = mapearFormaPagamento(pagamento.formaPagamento);
        const vendaPagamentoId = await criarVendaPagamentoComFallback(tx, vendaPagamentoDelegate, {
          vendaId,
          formaPagamento: formaPagamentoAtual,
          valorBruto: pagamento.valorBruto,
          percentualTaxa: pagamento.percentualTaxa,
          valorTaxa: pagamento.valorTaxa,
          valorLiquido: pagamento.valorLiquido,
          parcelas: pagamento.parcelas,
          diasVencimento: pagamento.diasVencimento,
          dataVencimento: pagamento.dataVencimento,
        });

        const statusConta = ehPagamentoPrazo(pagamento.formaPagamento) ? "PENDENTE" : "RECEBIDO";

        await criarContaReceberComFallbackVendaPagamento(
          contaReceberDelegate,
          {
            descricao: `OS #${pedido.numeroOs} - ${pedido.aparelho} (+itens PDV) - ${pagamento.formaPagamento}`,
            valor: pagamento.valorBruto,
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
            dataVencimento: pagamento.dataVencimento ?? new Date(),
            dataRecebimento: statusConta === "RECEBIDO" ? new Date() : null,
            status: statusConta,
            formaRecebimento: formaPagamentoAtual,
            origem: "ORDEM_SERVICO",
            notaFiscalEmitida: false,
          },
          vendaPagamentoId
        );
      }

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
