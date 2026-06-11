"use server";

import { revalidatePath } from "next/cache";
import type { StatusOS, TipoPeca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
// Importação de calcularPrecoVendaPeca removida — preços são definidos manualmente pelo operador.
import { exigirSessao } from "@/lib/auth/sessao";

type ItemEntrada = {
  tipo: TipoPeca;
  descricao: string;
  custoPeca: number;
  valorCobrado?: number;
};

type DadosNovaOS = {
  clienteId: string;
  equipamento: string;
  marca?: string;
  modelo?: string;
  imei?: string;
  senha?: string;
  senhaDesenho?: string;
  relatoCliente: string;
  condicaoFisica?: string;
  acessorios?: string;
  status: StatusOS;
  observacoesInternas?: string;
  itensOrcamento?: ItemEntrada[];
};

export type ClienteBuscaOS = {
  id: string;
  nomeRazaoSocial: string;
  documento: string;
  telefone: string;
};

const statusValidos: StatusOS[] = [
  "AGUARDANDO_ORCAMENTO",
  "AGUARDANDO_APROVACAO",
  "APROVADO",
  "AGUARDANDO_PECA",
  "EM_MANUTENCAO",
  "PRONTO",
  "ENTREGUE",
];

function paraNumero(valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  if (!Number.isFinite(numero)) return 0;
  return numero;
}

export async function buscarClientesOS(termoBusca: string): Promise<ClienteBuscaOS[]> {
  const termo = termoBusca.trim();

  if (termo.length < 2) {
    return [];
  }

  const prismaAny = prisma as typeof prisma & Record<string, unknown>;
  const clienteDelegate = prismaAny.cliente ?? prismaAny.Cliente;

  if (!clienteDelegate?.findMany) {
    throw new Error("Delegate Prisma de Cliente nao disponivel.");
  }

  const clientes = await clienteDelegate.findMany({
    where: {
      papel: "CLIENTE",
      OR: [
        {
          nomeRazaoSocial: {
            contains: termo,
            mode: "insensitive",
          },
        },
        {
          documento: {
            contains: termo,
            mode: "insensitive",
          },
        },
        {
          telefone: {
            contains: termo,
            mode: "insensitive",
          },
        },
      ],
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
    take: 15,
  });

  return clientes.map((cliente: { id: string; nomeRazaoSocial: string; documento: string; telefone: string }) => ({
    id: String(cliente.id),
    nomeRazaoSocial: String(cliente.nomeRazaoSocial),
    documento: String(cliente.documento),
    telefone: String(cliente.telefone),
  }));
}

/**
 * Retorna os dados de um cliente pelo ID.
 * Usado para pré-preencher o seletor de cliente na OS quando o clienteId vem via URL.
 */
export async function buscarClientePorId(clienteId: string): Promise<ClienteBuscaOS | null> {
  if (!clienteId) return null;

  const prismaAny = prisma as typeof prisma & Record<string, unknown>;
  const clienteDelegate = prismaAny.cliente ?? prismaAny.Cliente;

  if (!clienteDelegate?.findFirst) return null;

  const cliente = await clienteDelegate.findFirst({
    where: { id: clienteId, papel: "CLIENTE" },
    select: { id: true, nomeRazaoSocial: true, documento: true, telefone: true },
  });

  if (!cliente) return null;

  return {
    id: String(cliente.id),
    nomeRazaoSocial: String(cliente.nomeRazaoSocial),
    documento: String(cliente.documento),
    telefone: String(cliente.telefone),
  };
}

export async function criarOrdemServico(dados: DadosNovaOS) {
  // C1: rejeita chamadas nao autenticadas diretamente no backend.
  await exigirSessao();

  if (!dados?.clienteId) {
    throw new Error("Selecione um cliente para criar a ordem de servico.");
  }

  if (!dados?.equipamento?.trim()) {
    throw new Error("Informe o equipamento da ordem de servico.");
  }

  if (!dados?.relatoCliente?.trim()) {
    throw new Error("Informe o relato do cliente para criar a ordem de servico.");
  }

  if (!statusValidos.includes(dados.status)) {
    throw new Error("Status da ordem de servico invalido.");
  }

  const itensTratados = (dados.itensOrcamento ?? [])
    .map((item) => {
      const descricao = String(item.descricao ?? "").trim();
      const custoPeca = paraNumero(item.custoPeca);
      const valorCobradoEntrada = paraNumero(item.valorCobrado);

      if (!descricao) return null;
      if (custoPeca < 0) return null;

      // Valor cobrado ao cliente: sempre o informado manualmente, sem markup automático.
      const valorCobrado = valorCobradoEntrada;

      if (valorCobrado <= 0) return null;

      return {
        descricao,
        tipoPeca: item.tipo,
        custoPeca,
        valorCobrado,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const prismaAny = prisma as any;
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!ordemServicoDelegate?.create) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  const novaOS = await prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const txOrdemServico = txAny.ordemServico ?? txAny.OrdemServico;
    const txItemOS = txAny.itemOS ?? txAny.ItemOS;

    const ordemCriada = await txOrdemServico.create({
      data: {
        clienteId: dados.clienteId,
        equipamento: dados.equipamento.trim(),
        marca: dados.marca?.trim() || null,
        modelo: dados.modelo?.trim() || null,
        imei: dados.imei?.trim() || null,
        senha: dados.senha?.trim() || null,
        senhaDesenho: dados.senhaDesenho?.trim() || null,
        relatoCliente: dados.relatoCliente.trim(),
        condicaoFisica: dados.condicaoFisica?.trim() || null,
        acessorios: dados.acessorios?.trim() || null,
        status: dados.status,
        observacoes: dados.observacoesInternas?.trim() || null,
      },
      select: {
        id: true,
      },
    });

    if (itensTratados.length > 0 && txItemOS?.createMany) {
      await txItemOS.createMany({
        data: itensTratados.map((item) => ({
          osId: ordemCriada.id,
          descricao: item.descricao,
          tipoPeca: item.tipoPeca,
          custoPeca: item.custoPeca,
          valorCobrado: item.valorCobrado,
        })),
      });
    }

    return ordemCriada;
  });

  revalidatePath("/os");
  revalidatePath(`/os/${novaOS.id}`);

  return novaOS;
}

export async function atualizarStatusOrdemServico(osId: string, status: StatusOS) {
  // C1: exige sessao valida antes de alterar dados.
  await exigirSessao();

  if (!osId) {
    throw new Error("ID da ordem de servico nao informado.");
  }

  if (!statusValidos.includes(status)) {
    throw new Error("Status da ordem de servico invalido.");
  }

  const prismaAny = prisma as any;
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!ordemServicoDelegate?.update) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  await ordemServicoDelegate.update({
    where: {
      id: osId,
    },
    data: {
      status,
    },
  });

  // Cria notificação para status relevantes — falha silenciosa para não bloquear a operação principal.
  const statusComNotificacao: Record<string, { titulo: string; mensagem: (n: number) => string }> = {
    APROVADO:         { titulo: "OS Aprovada",             mensagem: (n) => `A OS #${n} foi aprovada pelo cliente e pode seguir para a manutenção.` },
    AGUARDANDO_PECA:  { titulo: "OS Aguardando Peça",      mensagem: (n) => `A OS #${n} está aguardando chegada de peça para prosseguir.` },
    EM_MANUTENCAO:    { titulo: "OS em Manutenção",        mensagem: (n) => `A OS #${n} está em manutenção pelo técnico.` },
    PRONTO:           { titulo: "OS Pronta para Retirada", mensagem: (n) => `A OS #${n} foi concluída e está pronta para retirada pelo cliente.` },
    ENTREGUE:         { titulo: "OS Entregue",             mensagem: (n) => `A OS #${n} foi entregue ao cliente com sucesso.` },
  };

  const config = statusComNotificacao[status];
  if (config) {
    try {
      const os = await ordemServicoDelegate.findUnique({
        where: { id: osId },
        select: { numeroOs: true },
      });
      const numeroOs = os?.numeroOs ?? osId;

      const notifDelegate = (prismaAny as any).notificacao ?? (prismaAny as any).Notificacao;
      if (notifDelegate?.create) {
        await notifDelegate.create({
          data: {
            titulo: config.titulo,
            mensagem: config.mensagem(Number(numeroOs)),
          },
        });
      }
    } catch {
      // Notificação opcional — não bloqueia a atualização de status em caso de falha.
    }
  }

  revalidatePath("/os");
  revalidatePath(`/os/${osId}`);
}

export async function gerarPedidoVendaPorOS(osId: string) {
  // C1: exige sessao valida antes de gerar pedido/venda.
  await exigirSessao();

  if (!osId) {
    throw new Error("ID da ordem de servico nao informado.");
  }

  const prismaAny = prisma as any;
  const ordemServicoDelegate = prismaAny.ordemServico ?? prismaAny.OrdemServico;
  const contaReceberDelegate = prismaAny.contaReceber ?? prismaAny.ContaReceber;

  if (!ordemServicoDelegate?.findUnique || !contaReceberDelegate?.findFirst) {
    throw new Error("Delegates Prisma necessarios para gerar pedido de venda nao disponiveis.");
  }

  const os = await ordemServicoDelegate.findUnique({
    where: { id: osId },
    select: {
      id: true,
      clienteId: true,
      status: true,
      numeroOs: true,
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
    throw new Error("A OS precisa estar com status PRONTO para gerar pedido de venda.");
  }

  const pedidoExistente = await contaReceberDelegate.findFirst({
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

  if (pedidoExistente?.vendaId) {
    return {
      vendaId: String(pedidoExistente.vendaId),
      pedidoJaExistia: true,
    };
  }

  const totalPedido = (os.itens ?? []).reduce((acumulado: number, item: any) => {
    const valor = typeof item.valorCobrado === "number" ? item.valorCobrado : Number(item.valorCobrado ?? 0);
    return acumulado + (Number.isFinite(valor) ? valor : 0);
  }, 0);

  if (totalPedido <= 0) {
    throw new Error("Nao foi possivel gerar o pedido: a OS nao possui valor de itens maior que zero.");
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const txAny = tx as any;
    const txVenda = txAny.venda ?? txAny.Venda;
    const txContaReceber = txAny.contaReceber ?? txAny.ContaReceber;

    if (!txVenda?.create || !txContaReceber?.create) {
      throw new Error("Delegates Prisma de venda/contaReceber nao disponiveis para transacao.");
    }

    const novaVenda = await txVenda.create({
      data: {
        clienteId: String(os.clienteId),
        formaPagamento: "PIX",
        valorTotal: totalPedido,
        desconto: 0,
      },
      select: {
        id: true,
      },
    });

    await txContaReceber.create({
      data: {
        descricao: `OS #${String(os.numeroOs)} - Pedido de venda`,
        valor: totalPedido,
        clienteId: String(os.clienteId),
        ordemServicoId: String(os.id),
        vendaId: String(novaVenda.id),
        dataVencimento: new Date(),
        status: "PENDENTE",
        formaRecebimento: "PIX",
        origem: "ORDEM_SERVICO",
        notaFiscalEmitida: false,
      },
    });

    return {
      vendaId: String(novaVenda.id),
      pedidoJaExistia: false,
    };
  });

  revalidatePath("/os");
  revalidatePath(`/os/${osId}`);
  revalidatePath("/");
  revalidatePath("/financeiro");

  return resultado;
}
