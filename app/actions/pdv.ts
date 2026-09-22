"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao, temPermissao } from "@/lib/auth/permissoes";
import {
  mensagemIndicaRuntimeLegadoConfiguracao,
  obterDefaultsConfiguracaoOsGarantias,
} from "@/lib/configuracoes-os-garantias";
import {
  normalizarConfiguracaoPdv,
  obterDefaultsConfiguracaoPdv,
  type ConfiguracaoPdvPagamentos,
} from "@/lib/configuracoes-pdv";
import {
  calcularPagamentoPdv,
  ehPagamentoPrazo,
  paraCentavos,
  paraMoeda,
  MENSAGEM_ATUALIZAR_CARRINHO_PDV,
  type EntradaPagamentoPdv,
  type FormaPagamentoPdv,
  type ResultadoPagamentoPdv,
} from "@/lib/pdv/pagamentos";
import {
  calcularVendaPdv,
  type DescontoPdv,
  type ItemEntradaCalculoVenda,
} from "@/lib/dominio/pdv/calcular-venda";
import { registrarLogAuditoria, contextoAuditoriaDoUsuario } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { deDecimal } from "@/lib/dinheiro";
import {
  ID_CLIENTE_CONSUMIDOR_FINAL,
  ehClienteConsumidorFinal,
  exigeClienteRealParaFinalizarVenda,
  resolverClienteEfetivoPdv,
} from "@/lib/dominio/crm/consumidor-final";

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
  categoria: string;
  quantidadeEstoque: number;
  estoqueMinimo: number;
}

/**
 * Entrada real aceita do cliente para compor uma venda (F-04/F-33): apenas o
 * id do produto e a quantidade. Preco, custo e subtotal SEMPRE vem do banco,
 * nunca do navegador — ver `lib/dominio/pdv/calcular-venda.ts`.
 */
export interface ItemCarrinhoPdvInput {
  produtoId: string;
  quantidade: number;
}

export type DescontoPdvInput = DescontoPdv;

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
  /** null quando o usuário logado não tem a permissão os.ver_custos (F-41). */
  unitCost: number | null;
  unitPrice: number;
  totalPrice: number;
}

export type FormaPagamento = FormaPagamentoPdv;

export type PagamentoPdvInput = EntradaPagamentoPdv;

export type ConfiguracaoPagamentosPDV = ConfiguracaoPdvPagamentos;

type ConfiguracaoPdvRaw = Partial<ConfiguracaoPdvPagamentos>;
type PrismaTenant = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];

function obterParametrosCalculoPdv(configuracao: ConfiguracaoPdvPagamentos) {
  return {
    taxaCartaoDebitoPercentual: configuracao.taxaCartaoDebitoPercentual,
    taxaCartaoCreditoPorParcela: {
      1: configuracao.taxaCartaoCredito1xPercentual,
      2: configuracao.taxaCartaoCredito2xPercentual,
      3: configuracao.taxaCartaoCredito3xPercentual,
      4: configuracao.taxaCartaoCredito4xPercentual,
      5: configuracao.taxaCartaoCredito5xPercentual,
      6: configuracao.taxaCartaoCredito6xPercentual,
      7: configuracao.taxaCartaoCredito7xPercentual,
      8: configuracao.taxaCartaoCredito8xPercentual,
      9: configuracao.taxaCartaoCredito9xPercentual,
      10: configuracao.taxaCartaoCredito10xPercentual,
      11: configuracao.taxaCartaoCredito11xPercentual,
      12: configuracao.taxaCartaoCredito12xPercentual,
    },
    maxParcelasCartaoCredito: configuracao.maxParcelasCartaoCredito,
    prazoPadraoBoletoDias: configuracao.prazoPadraoBoletoDias,
    prazoPadraoCrediarioDias: configuracao.prazoPadraoCrediarioDias,
  };
}

function formaPagamentoHabilitada(
  formaPagamento: FormaPagamentoPdv,
  configuracao: ConfiguracaoPdvPagamentos
): boolean {
  if (formaPagamento === "TED" || formaPagamento === "EMPENHO_PUBLICO") {
    return false;
  }

  if (formaPagamento === "PIX") {
    return configuracao.habilitarPix;
  }

  if (formaPagamento === "DINHEIRO") {
    return configuracao.habilitarDinheiro;
  }

  if (
    formaPagamento === "CARTAO_CREDITO" ||
    formaPagamento === "CARTAO_CREDITO_AVISTA" ||
    formaPagamento === "CARTAO_CREDITO_PARCELADO"
  ) {
    return configuracao.habilitarCartaoCredito;
  }

  if (formaPagamento === "CARTAO_DEBITO") {
    return configuracao.habilitarCartaoDebito;
  }

  if (formaPagamento === "BOLETO") {
    return configuracao.habilitarBoleto;
  }

  if (formaPagamento === "CREDIARIO") {
    return configuracao.habilitarCrediario;
  }

  return true;
}

function validarPagamentosConformeConfiguracao(
  pagamentos: PagamentoPdvInput[],
  configuracao: ConfiguracaoPdvPagamentos
) {
  if (!configuracao.permitirPagamentoMisto && pagamentos.length > 1) {
    throw new Error("Pagamento misto desabilitado nas configuracoes do PDV.");
  }

  for (const pagamento of pagamentos) {
    if (!formaPagamentoHabilitada(pagamento.formaPagamento, configuracao)) {
      throw new Error(`Forma de pagamento ${pagamento.formaPagamento} desabilitada nas configuracoes do PDV.`);
    }

    if (
      (pagamento.formaPagamento === "CARTAO_CREDITO" ||
        pagamento.formaPagamento === "CARTAO_CREDITO_PARCELADO") &&
      Number(pagamento.parcelas ?? 1) > configuracao.maxParcelasCartaoCredito
    ) {
      throw new Error(
        `Parcelamento acima do limite configurado (${configuracao.maxParcelasCartaoCredito}x).`
      );
    }
  }

  if (!configuracao.permitirVendaFiado && pagamentos.some((p) => p.formaPagamento === "CREDIARIO")) {
    throw new Error("Crediario desabilitado para vendas fiado nas configuracoes do PDV.");
  }
}

async function obterConfiguracaoPagamentosInterna(prisma: PrismaTenant): Promise<ConfiguracaoPdvPagamentos> {
  const defaults = obterDefaultsConfiguracaoPdv();
  const prismaAny = prisma as typeof prisma & {
    configuracao?: { findFirst?: (args: unknown) => Promise<Record<string, unknown> | null> };
    Configuracao?: { findFirst?: (args: unknown) => Promise<Record<string, unknown> | null> };
  };
  const configuracaoDelegate = prismaAny.configuracao ?? prismaAny.Configuracao;

  try {
    const configuracao = await configuracaoDelegate?.findFirst?.({
      orderBy: { criadoEm: "asc" },
      select: {
        permitirPagamentoMisto: true,
        permitirDescontoPDV: true,
        descontoMaximoPDVPercentual: true,
        permitirVendaSemEstoque: true,
        permitirVendaFiado: true,
        habilitarPix: true,
        habilitarDinheiro: true,
        habilitarCartaoDebito: true,
        habilitarCartaoCredito: true,
        habilitarBoleto: true,
        habilitarCrediario: true,
        taxaCartaoDebitoPercentual: true,
        taxaCartaoCredito1xPercentual: true,
        taxaCartaoCredito2xPercentual: true,
        taxaCartaoCredito3xPercentual: true,
        taxaCartaoCredito4xPercentual: true,
        taxaCartaoCredito5xPercentual: true,
        taxaCartaoCredito6xPercentual: true,
        taxaCartaoCredito7xPercentual: true,
        taxaCartaoCredito8xPercentual: true,
        taxaCartaoCredito9xPercentual: true,
        taxaCartaoCredito10xPercentual: true,
        taxaCartaoCredito11xPercentual: true,
        taxaCartaoCredito12xPercentual: true,
        prazoPadraoBoletoDias: true,
        prazoPadraoCrediarioDias: true,
        maxParcelasCartaoCredito: true,
      },
    });

    return normalizarConfiguracaoPdv((configuracao ?? defaults) as ConfiguracaoPdvRaw);
  } catch (erro) {
    if (!mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
      throw erro;
    }

    try {
      const rows = await prisma.$queryRaw<Array<ConfiguracaoPdvRaw>>`
        SELECT
          "permitirPagamentoMisto",
          "permitirDescontoPDV",
          "descontoMaximoPDVPercentual",
          "permitirVendaSemEstoque",
          "permitirVendaFiado",
          "habilitarPix",
          "habilitarDinheiro",
          "habilitarCartaoDebito",
          "habilitarCartaoCredito",
          "habilitarBoleto",
          "habilitarCrediario",
          "taxaCartaoDebitoPercentual",
          "taxaCartaoCredito1xPercentual",
          "taxaCartaoCredito2xPercentual",
          "taxaCartaoCredito3xPercentual",
          "taxaCartaoCredito4xPercentual",
          "taxaCartaoCredito5xPercentual",
          "taxaCartaoCredito6xPercentual",
          "taxaCartaoCredito7xPercentual",
          "taxaCartaoCredito8xPercentual",
          "taxaCartaoCredito9xPercentual",
          "taxaCartaoCredito10xPercentual",
          "taxaCartaoCredito11xPercentual",
          "taxaCartaoCredito12xPercentual",
          "prazoPadraoBoletoDias",
          "prazoPadraoCrediarioDias",
          "maxParcelasCartaoCredito"
        FROM "Configuracao"
        ORDER BY "criadoEm" ASC
        LIMIT 1
      `;

      return normalizarConfiguracaoPdv((rows[0] ?? defaults) as ConfiguracaoPdvRaw);
    } catch {
      return defaults;
    }
  }
}

export async function obterConfiguracaoPagamentosPDV(): Promise<ConfiguracaoPagamentosPDV> {
  const { prisma } = await exigirContextoTenant();
  return obterConfiguracaoPagamentosInterna(prisma);
}

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

const MENSAGEM_OS_JA_VINCULADA_PDV = "Esta OS já possui uma venda vinculada no PDV.";

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

type ClientePrismaAny = Prisma.TransactionClient & Record<string, unknown> & {
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
  pagamentos: PagamentoPdvInput[],
  configuracaoPdv: ConfiguracaoPdvPagamentos
): ResultadoPagamentoPdv[] {
  if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
    throw new Error("Informe ao menos uma forma de pagamento para concluir a venda.");
  }

  validarPagamentosConformeConfiguracao(pagamentos, configuracaoPdv);

  const parametrosCalculo = obterParametrosCalculoPdv(configuracaoPdv);
  return pagamentos.map((pagamento) => calcularPagamentoPdv(pagamento, parametrosCalculo));
}

function validarTotalPagamentos(
  pagamentos: ResultadoPagamentoPdv[],
  totalVendaCentavos: number
) {
  const totalPagamentosCentavos = pagamentos.reduce((acc, pagamento) => {
    return acc + paraCentavos(pagamento.valorBruto);
  }, 0);

  if (totalPagamentosCentavos !== totalVendaCentavos) {
    throw new Error(
      `A soma dos pagamentos não confere com o total calculado pelo servidor. ${MENSAGEM_ATUALIZAR_CARRINHO_PDV}`
    );
  }
}

function obterFormaPrincipal(pagamentos: ResultadoPagamentoPdv[]): FormaPagamento {
  const ordenados = [...pagamentos].sort((a, b) => b.valorBruto - a.valorBruto);
  return ordenados[0]?.formaPagamento ?? "DINHEIRO";
}

/** Recorte dos pagamentos para o payload de auditoria da venda (Fase 1B-FIX, Parte 2). */
function mapearPagamentosParaAuditoria(pagamentos: ResultadoPagamentoPdv[]) {
  return pagamentos.map((pagamento) => ({
    formaPagamento: pagamento.formaPagamento,
    valorBrutoCentavos: paraCentavos(pagamento.valorBruto),
    parcelas: pagamento.parcelas,
  }));
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
  const { prisma } = await exigirContextoTenant();

  const clientes = await prisma.cliente.findMany({
    where: {
      papel: "CLIENTE",
      // Consumidor Final ja e o destino implicito de deixar o campo vazio
      // (ver processarVenda) — mostra-lo tambem como resultado de busca so
      // duplicaria a mesma acao de duas formas diferentes.
      id: { not: ID_CLIENTE_CONSUMIDOR_FINAL },
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
  const { prisma } = await exigirContextoTenant();

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
      categoria: true,
      quantidadeEstoque: true,
      estoqueMinimo: true,
    },
    orderBy: {
      nome: "asc",
    },
  });

  return produtos.map((produto) => ({
    id: produto.id,
    nome: produto.nome,
    preco: paraMoeda(deDecimal(produto.precoVenda)),
    imagemUrl: produto.imagemUrl,
    categoria: produto.categoria,
    quantidadeEstoque: produto.quantidadeEstoque,
    estoqueMinimo: produto.estoqueMinimo,
  }));
}

type ProdutoVendaCarregado = {
  id: string;
  nome: string;
  precoVenda: number;
  custo: number;
  ativo: boolean;
};

/**
 * Carrega do banco (dentro da transacao) os produtos pedidos pelo cliente,
 * rejeitando ids inexistentes ou inativos. Preco e custo daqui em diante
 * SEMPRE vem deste mapa — nunca do payload do cliente (F-04/F-33).
 */
async function carregarProdutosParaVenda(
  tx: Prisma.TransactionClient,
  itens: ItemCarrinhoPdvInput[]
): Promise<Map<string, ProdutoVendaCarregado>> {
  const idsProdutos = Array.from(new Set(itens.map((item) => item.produtoId)));

  const produtos = await tx.produto.findMany({
    where: {
      id: {
        in: idsProdutos,
      },
    },
    select: {
      id: true,
      nome: true,
      precoVenda: true,
      custo: true,
      ativo: true,
    },
  });

  const mapa = new Map(
    produtos.map((produto) => [
      produto.id,
      {
        ...produto,
        precoVenda: paraMoeda(deDecimal(produto.precoVenda)),
        custo: paraMoeda(deDecimal(produto.custo)),
      },
    ])
  );

  for (const id of idsProdutos) {
    const produto = mapa.get(id);
    if (!produto) {
      throw new Error(
        `Um dos produtos do carrinho não foi encontrado. ${MENSAGEM_ATUALIZAR_CARRINHO_PDV}`
      );
    }
    if (!produto.ativo) {
      throw new Error(`O produto "${produto.nome}" está inativo e não pode ser vendido.`);
    }
  }

  return mapa;
}

function montarItensCalculoVenda(
  itens: ItemCarrinhoPdvInput[],
  produtos: Map<string, ProdutoVendaCarregado>
): ItemEntradaCalculoVenda[] {
  return itens.map((item) => {
    const produto = produtos.get(item.produtoId);
    if (!produto) {
      throw new Error(
        `Um dos produtos do carrinho não foi encontrado. ${MENSAGEM_ATUALIZAR_CARRINHO_PDV}`
      );
    }

    return {
      produto: {
        id: produto.id,
        nome: produto.nome,
        precoVenda: produto.precoVenda,
        custo: produto.custo,
      },
      quantidade: item.quantidade,
    };
  });
}

type ResultadoBaixaEstoqueItem = {
  produtoId: string;
  nome: string;
  quantidadeEstoqueResultante: number;
  ficouNegativo: boolean;
};

/**
 * Da baixa no estoque de cada item e cria a notificacao de "Estoque Baixo"
 * quando aplicavel — tudo dentro da MESMA transacao da venda (antes rodava
 * em um setImmediate desacoplado, fora de qualquer transacao, e podia
 * silenciosamente nao gravar nada — AUDIT_REPORT F-19).
 *
 * Com `permitirVendaSemEstoque` desligado (padrao), a baixa e condicional e
 * atomica via updateMany: se o estoque acabou entre a leitura do preco e
 * este passo, a venda falha com estoque insuficiente. Com a flag ligada, a
 * baixa e incondicional (o estoque pode ficar negativo) e cada produto que
 * ficou negativo e devolvido para entrar na trilha de auditoria da venda.
 */
async function baixarEstoqueVenda(
  tx: Prisma.TransactionClient,
  itens: Array<{ produtoId: string; nome: string; quantidade: number }>,
  permitirVendaSemEstoque: boolean
): Promise<ResultadoBaixaEstoqueItem[]> {
  const resultados: ResultadoBaixaEstoqueItem[] = [];

  for (const item of itens) {
    let produtoAtualizado: { nome: string; quantidadeEstoque: number; estoqueMinimo: number };

    if (!permitirVendaSemEstoque) {
      const atualizacao = await tx.produto.updateMany({
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

      if (atualizacao.count === 0) {
        throw new Error(`Estoque insuficiente para o produto ${item.nome}.`);
      }

      produtoAtualizado = await tx.produto.findUniqueOrThrow({
        where: { id: item.produtoId },
        select: { nome: true, quantidadeEstoque: true, estoqueMinimo: true },
      });
    } else {
      produtoAtualizado = await tx.produto.update({
        where: { id: item.produtoId },
        data: {
          quantidadeEstoque: {
            decrement: item.quantidade,
          },
        },
        select: { nome: true, quantidadeEstoque: true, estoqueMinimo: true },
      });
    }

    resultados.push({
      produtoId: item.produtoId,
      nome: produtoAtualizado.nome,
      quantidadeEstoqueResultante: produtoAtualizado.quantidadeEstoque,
      ficouNegativo: produtoAtualizado.quantidadeEstoque < 0,
    });

    if (produtoAtualizado.quantidadeEstoque <= produtoAtualizado.estoqueMinimo) {
      const notificacaoExistente = await tx.notificacao.findFirst({
        where: {
          lida: false,
          titulo: "Estoque Baixo",
          mensagem: { contains: produtoAtualizado.nome },
        },
      });

      if (!notificacaoExistente) {
        await tx.notificacao.create({
          data: {
            titulo: "Estoque Baixo",
            mensagem: `Atenção: O estoque do item "${produtoAtualizado.nome}" está baixo (Restam: ${produtoAtualizado.quantidadeEstoque} unidades).`,
          },
        });
      }
    }
  }

  return resultados;
}

export async function processarVenda(
  itens: ItemCarrinhoPdvInput[],
  pagamentos: PagamentoPdvInput[],
  opcoes?: {
    clienteId?: string;
    desconto?: DescontoPdvInput | null;
  }
) {
  // C1: somente operadores autenticados podem registrar vendas.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "pdv.vender");
  const prisma = contexto.prisma;
  const sessionUser = contexto.usuarioOperacional;
  const clienteId = opcoes?.clienteId;
  const desconto = opcoes?.desconto ?? null;
  // Venda de balcao sem cliente selecionado vai pro Consumidor Final, nunca
  // fica com clienteId nulo (fase 3-2C — consumidor final). clienteId (o
  // valor cru informado) continua guardado a parte, porque a trava de
  // credidario/boleto abaixo precisa saber se um cliente REAL foi escolhido.
  const clienteIdEfetivo = resolverClienteEfetivoPdv(clienteId);

  if (itens.length === 0) {
    throw new Error("Carrinho vazio para processamento da venda.");
  }

  const configuracaoPdv = await obterConfiguracaoPagamentosInterna(prisma);

  try {
    const venda = await prisma.$transaction(async (tx) => {
      const txAny = tx as unknown as ClientePrismaAny;
      const prismaAny = prisma as unknown as ClientePrismaAny;
      const caixaAberto = await obterCaixaSessionAberta(tx);

      // C2: preco, custo e ativo vem SEMPRE do banco, nunca do payload do
      // cliente — este e o nucleo da correcao F-04/F-33.
      const produtos = await carregarProdutosParaVenda(tx, itens);
      const itensCalculo = montarItensCalculoVenda(itens, produtos);
      const resultadoCalculo = calcularVendaPdv(itensCalculo, desconto, {
        permitirDescontoPDV: configuracaoPdv.permitirDescontoPDV,
        descontoMaximoPDVPercentual: configuracaoPdv.descontoMaximoPDVPercentual,
      });

      if (resultadoCalculo.descontoAcimaDoLimite) {
        exigirPermissao(contexto, "pdv.aplicar_desconto_acima_limite");
      }

      const pagamentosProcessados = normalizarPagamentosEntrada(pagamentos, configuracaoPdv);
      validarTotalPagamentos(pagamentosProcessados, resultadoCalculo.totalCentavos);

      // Boleto/crediario/empenho publico geram uma ContaReceber — uma
      // divida em aberto nao pode ficar em nome do Consumidor Final, nao
      // tem como cobrar dele. Cliente aqui e o valor CRU informado (nao o
      // efetivo): so um cliente de verdade libera essas formas.
      if (!clienteId && exigeClienteRealParaFinalizarVenda(pagamentosProcessados, ehPagamentoPrazo)) {
        throw new Error(
          "Selecione um cliente para continuar: vendas com boleto ou crediário geram uma conta a receber, e não é possível cobrar do Consumidor Final."
        );
      }

      const formaPagamentoPrincipal = obterFormaPrincipal(pagamentosProcessados);
      const formaPagamentoBanco = mapearFormaPagamento(formaPagamentoPrincipal);

      const vendaDelegate = obterDelegateComFallback(
        txAny,
        prismaAny,
        ["venda", "Venda"],
        "venda"
      );
      const vendaPagamentoDelegate = obterDelegateComFallbackOpcional(
        txAny,
        prismaAny,
        ["vendaPagamento", "VendaPagamento"]
      );

      const dadosVendaBase = {
        cliente: {
          connect: {
            id: clienteIdEfetivo,
          },
        },
        valorTotal: paraMoeda(resultadoCalculo.totalCentavos),
        desconto: paraMoeda(resultadoCalculo.descontoCentavos),
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

      await tx.itemVenda.createMany({
        data: resultadoCalculo.itens.map((item) => ({
          vendaId,
          produtoId: item.produtoId,
          descricao: item.nome,
          quantidade: item.quantidade,
          custoUnitario: paraMoeda(item.custoUnitarioCentavos),
          precoUnitario: paraMoeda(item.precoUnitarioCentavos),
          subtotal: paraMoeda(item.subtotalLiquidoCentavos),
        })),
      });

      const baixaEstoque = await baixarEstoqueVenda(
        tx,
        resultadoCalculo.itens.map((item) => ({
          produtoId: item.produtoId,
          nome: item.nome,
          quantidade: item.quantidade,
        })),
        configuracaoPdv.permitirVendaSemEstoque
      );

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
        clienteId: clienteIdEfetivo,
        vendedor: sessionUser.nome,
        total: paraMoeda(resultadoCalculo.totalCentavos),
        formaPagamento: formaPagamentoBanco,
        items: resultadoCalculo.itens.map((item) => ({
          produtoId: item.produtoId,
          nome: item.nome,
          quantidade: item.quantidade,
          precoUnitario: paraMoeda(item.precoUnitarioCentavos),
          subtotal: paraMoeda(item.subtotalLiquidoCentavos),
        })),
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(sessionUser, "app/actions/pdv.ts:processarVenda"),
        {
          acao: ACOES_AUDITORIA.CRIAR,
          entidade: ENTIDADES_AUDITORIA.VENDA,
          entidadeId: vendaId,
          dadosDepois: {
            totalCentavos: resultadoCalculo.totalCentavos,
            descontoCentavos: resultadoCalculo.descontoCentavos,
            clienteId: clienteIdEfetivo,
            clienteConsumidorFinal: ehClienteConsumidorFinal(clienteIdEfetivo),
            caixaSessionId: caixaAberto.id,
            itens: resultadoCalculo.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitarioCentavos: item.precoUnitarioCentavos,
              descontoCentavos: item.descontoCentavos,
              subtotalCentavos: item.subtotalLiquidoCentavos,
            })),
            pagamentos: mapearPagamentosParaAuditoria(pagamentosProcessados),
            estoqueNegativo: baixaEstoque.filter((item) => item.ficouNegativo),
          },
        }
      );

      return { id: vendaId };
    });

    revalidatePath("/");
    revalidatePath("/pdv");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/vendas/historico");

    return {
      vendaId: venda.id,
    };
  } catch (erro) {
    console.error("Erro ao processar venda no PDV:", erro);
    throw erro;
  }
}

/**
 * Nucleo de `obterPedidoOSParaPDV`, com o custo REAL de cada item (`unitCost`).
 * Uso interno apenas: `processarVendaComOSNoPDV` precisa do valor verdadeiro
 * para gravar `custoUnitario` em ItemVenda, independente de quem esta vendendo
 * ter a permissao os.ver_custos.
 */
async function obterPedidoOSParaPDVInterno(osId: string): Promise<PedidoOSPDV> {
  const { prisma } = await exigirContextoTenant();

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

  let configuracao: { exigirItemParaEnviarPDV?: boolean | null } | null = null;

  try {
    configuracao = await prisma.configuracao.findFirst({
      orderBy: { criadoEm: "asc" },
      select: {
        exigirItemParaEnviarPDV: true,
      },
    });
  } catch (erro) {
    if (!mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
      throw erro;
    }
    try {
      const rows = await prisma.$queryRaw<Array<{ exigirItemParaEnviarPDV: boolean | null }>>`
        SELECT "exigirItemParaEnviarPDV" FROM "Configuracao" ORDER BY "criadoEm" ASC LIMIT 1
      `;
      configuracao = rows[0] ?? null;
    } catch {
      // mantém null → defaults
    }
  }

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
    throw new Error(MENSAGEM_OS_JA_VINCULADA_PDV);
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

/**
 * Versao exposta ao cliente: mesma leitura, mas `unitCost` só chega ao
 * navegador com a permissão os.ver_custos (F-41). O core interno
 * (`obterPedidoOSParaPDVInterno`) continua vendo o custo real para a venda.
 */
export async function obterPedidoOSParaPDV(osId: string): Promise<PedidoOSPDV> {
  const contexto = await exigirContextoTenant();
  const podeVerCustos = temPermissao(contexto, "os.ver_custos");
  const pedido = await obterPedidoOSParaPDVInterno(osId);

  return {
    ...pedido,
    items: pedido.items.map((item) => ({
      ...item,
      unitCost: podeVerCustos ? item.unitCost : null,
    })),
  };
}

export async function processarVendaOSNoPDV(osId: string, pagamentos: PagamentoPdvInput[]) {
  return processarVendaComOSNoPDV(osId, [], pagamentos);
}

export async function processarVendaComOSNoPDV(
  osId: string,
  itensProdutos: ItemCarrinhoPdvInput[],
  pagamentos: PagamentoPdvInput[],
  opcoes?: {
    desconto?: DescontoPdvInput | null;
  }
) {
  // C1: somente operadores autenticados podem faturar OS no PDV.
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "pdv.vender");
  const prisma = contexto.prisma;
  const sessionUser = contexto.usuarioOperacional;
  const desconto = opcoes?.desconto ?? null;

  // Interno, nao a versao exportada: a venda precisa do custo REAL de cada
  // item para gravar custoUnitario, mesmo quando quem vende nao tem
  // os.ver_custos.
  const pedido = await obterPedidoOSParaPDVInterno(osId);
  const totalOSCentavos = paraCentavos(pedido.valor);
  const configuracaoPdv = await obterConfiguracaoPagamentosInterna(prisma);

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
      const vendaPagamentoDelegate = obterDelegateComFallbackOpcional(
        txAny,
        prismaAny,
        ["vendaPagamento", "VendaPagamento"]
      );

      // C2: preco, custo e ativo dos produtos extras vem SEMPRE do banco,
      // nunca do payload do cliente (F-04/F-33). Os itens da propria OS ja
      // vem confiaveis de `obterPedidoOSParaPDVInterno`.
      const resultadoProdutos =
        itensProdutos.length > 0
          ? calcularVendaPdv(
              montarItensCalculoVenda(itensProdutos, await carregarProdutosParaVenda(tx, itensProdutos)),
              desconto,
              {
                permitirDescontoPDV: configuracaoPdv.permitirDescontoPDV,
                descontoMaximoPDVPercentual: configuracaoPdv.descontoMaximoPDVPercentual,
              }
            )
          : null;

      if (resultadoProdutos?.descontoAcimaDoLimite) {
        exigirPermissao(contexto, "pdv.aplicar_desconto_acima_limite");
      }

      const totalProdutosCentavos = resultadoProdutos?.totalCentavos ?? 0;
      const descontoProdutosCentavos = resultadoProdutos?.descontoCentavos ?? 0;
      const totalVendaCentavos = totalOSCentavos + totalProdutosCentavos;

      const pagamentosProcessados = normalizarPagamentosEntrada(pagamentos, configuracaoPdv);
      validarTotalPagamentos(pagamentosProcessados, totalVendaCentavos);
      const formaPagamentoPrincipal = obterFormaPrincipal(pagamentosProcessados);
      const formaPagamentoBanco = mapearFormaPagamento(formaPagamentoPrincipal);

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
        throw new Error(MENSAGEM_OS_JA_VINCULADA_PDV);
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
          desconto: paraMoeda(descontoProdutosCentavos),
        },
        formaPagamentoBanco
      );

      if (!novaVenda) {
        throw new Error("Falha ao gerar venda da OS no PDV.");
      }

      const vendaId = String((novaVenda as { id: string }).id);

      await vincularVendaAoCaixa(tx, vendaId, caixaAberto.id);

      await tx.itemVenda.createMany({
        data: [
          ...pedido.items.map((item) => ({
            vendaId,
            produtoId: null as string | null,
            descricao: item.description,
            quantidade: item.quantity,
            // `pedido` vem de obterPedidoOSParaPDVInterno: unitCost aqui e
            // sempre o custo real (nunca null); o `?? 0` e so blindagem de tipo.
            custoUnitario: paraMoeda(paraCentavos(item.unitCost ?? 0)),
            precoUnitario: paraMoeda(paraCentavos(item.unitPrice)),
            subtotal: paraMoeda(paraCentavos(item.totalPrice)),
          })),
          ...(resultadoProdutos?.itens ?? []).map((item) => ({
            vendaId,
            produtoId: item.produtoId as string | null,
            descricao: item.nome,
            quantidade: item.quantidade,
            custoUnitario: paraMoeda(item.custoUnitarioCentavos),
            precoUnitario: paraMoeda(item.precoUnitarioCentavos),
            subtotal: paraMoeda(item.subtotalLiquidoCentavos),
          })),
        ],
      });

      const baixaEstoque = await baixarEstoqueVenda(
        tx,
        (resultadoProdutos?.itens ?? []).map((item) => ({
          produtoId: item.produtoId,
          nome: item.nome,
          quantidade: item.quantidade,
        })),
        configuracaoPdv.permitirVendaSemEstoque
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

        const pagamentoPrazo = ehPagamentoPrazo(pagamento.formaPagamento);
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
            ...(pagamentoPrazo
              ? {
                  status: "PENDENTE",
                }
              : {
                  status: "RECEBIDO",
                  dataRecebimento: new Date(),
                }),
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
          ...(resultadoProdutos?.itens ?? []).map((item) => ({
            produtoId: item.produtoId,
            nome: item.nome,
            quantidade: item.quantidade,
            precoUnitario: paraMoeda(item.precoUnitarioCentavos),
            subtotal: paraMoeda(item.subtotalLiquidoCentavos),
          })),
        ],
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(sessionUser, "app/actions/pdv.ts:processarVendaComOSNoPDV"),
        {
          acao: ACOES_AUDITORIA.CRIAR,
          entidade: ENTIDADES_AUDITORIA.VENDA,
          entidadeId: vendaId,
          dadosDepois: {
            osId: pedido.osId,
            totalCentavos: totalVendaCentavos,
            descontoCentavos: descontoProdutosCentavos,
            clienteId: pedido.clienteId,
            caixaSessionId: caixaAberto.id,
            itensOS: pedido.items.map((item) => ({
              descricao: item.description,
              quantidade: item.quantity,
              precoUnitarioCentavos: paraCentavos(item.unitPrice),
            })),
            itensProdutos: (resultadoProdutos?.itens ?? []).map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitarioCentavos: item.precoUnitarioCentavos,
              descontoCentavos: item.descontoCentavos,
              subtotalCentavos: item.subtotalLiquidoCentavos,
            })),
            pagamentos: mapearPagamentosParaAuditoria(pagamentosProcessados),
            estoqueNegativo: baixaEstoque.filter((item) => item.ficouNegativo),
          },
        }
      );

      return { vendaId };
    });

    revalidatePath("/pdv");
    revalidatePath("/os");
    revalidatePath(`/os/${pedido.osId}`);
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/receber");
    revalidatePath("/financeiro/fluxo");
    revalidatePath("/vendas");
    revalidatePath("/vendas/historico");
    revalidatePath("/");

    return resultado;
  } catch (error) {
    throw normalizeOrderServiceError(error);
  }
}
