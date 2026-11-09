"use server";

import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import type { StatusNotaFiscal } from "@prisma/client";

export type ResultadoAcaoNotaFiscal =
  | { sucesso: true; mensagem: string }
  | { sucesso: false; erro: string };

export type NotaFiscalLista = {
  id: string;
  numero: string;
  serie: string | null;
  chaveAcesso: string | null;
  /**
   * NULO = ainda não lido do Bling.
   *
   * Era `Number(valorTotal ?? 0)`: uma nota sem valor virava R$ 0,00 na tela
   * e somava zero no total, sem ninguém desconfiar. A listagem do Bling não
   * traz o valor — ele chega na sincronização seguinte —, então essa janela
   * existe de verdade e precisa aparecer como travessão.
   */
  valorTotal: number | null;
  status: StatusNotaFiscal;
  situacaoBling: number | null;
  dataEmissao: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  /** Veio do Bling? É a presença do id de lá que diz. */
  doBling: boolean;
  /** Venda deste sistema reconhecida como esta nota. */
  pedidoId: string | null;
  numeroPedido: number | null;
  motivoSemVinculo: string | null;
  linkXml: string | null;
  linkDanfe: string | null;
  descricaoItens: string | null;
  criadoEm: string;
};

export type FiltroNotaFiscal = {
  busca?: string;
  status?: StatusNotaFiscal | "TODAS";
};

export type CriarNotaFiscalInput = {
  numero: string;
  chaveAcesso?: string;
  valorTotal: number;
  status?: StatusNotaFiscal;
  clienteId?: string | null;
};

export type AtualizarNotaFiscalInput = CriarNotaFiscalInput & { id: string };

export type AtualizarStatusNotaFiscalInput = {
  id: string;
  status: StatusNotaFiscal;
};

function normalizarTexto(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.trim();
}

function validarNotaFiscal(input: CriarNotaFiscalInput): string | null {
  const numero = normalizarTexto(input.numero);

  if (!numero) {
    return "Numero da nota fiscal e obrigatorio.";
  }

  if (!Number.isFinite(input.valorTotal) || input.valorTotal < 0) {
    return "Valor total invalido.";
  }

  return null;
}

export async function listarNotasFiscais(
  filtros: FiltroNotaFiscal = {}
): Promise<{ sucesso: true; dados: NotaFiscalLista[] } | { sucesso: false; erro: string }> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.ver");
    const prisma = contexto.prisma;

    const where: {
      status?: StatusNotaFiscal;
      OR?: Array<{ numero?: { contains: string; mode: "insensitive" }; chaveAcesso?: { contains: string; mode: "insensitive" } }>;
    } = {};

    if (filtros.status && filtros.status !== "TODAS") {
      where.status = filtros.status;
    }

    const busca = normalizarTexto(filtros.busca);
    if (busca) {
      where.OR = [
        { numero: { contains: busca, mode: "insensitive" } },
        { chaveAcesso: { contains: busca, mode: "insensitive" } },
      ];
    }

    const notas = await prisma.notaFiscal.findMany({
      where,
      // Pela emissão, que é a data que importa para quem procura uma nota.
      // Nota lançada à mão não tem emissão e cai depois, pela criação.
      orderBy: [{ dataEmissao: "desc" }, { criadoEm: "desc" }],
      select: {
        id: true,
        numero: true,
        serie: true,
        chaveAcesso: true,
        valorTotal: true,
        status: true,
        situacaoBling: true,
        dataEmissao: true,
        blingId: true,
        pedidoId: true,
        motivoSemVinculo: true,
        linkXml: true,
        linkDanfe: true,
        descricaoItens: true,
        clienteNome: true,
        criadoEm: true,
        clienteId: true,
        cliente: {
          select: {
            nomeRazaoSocial: true,
          },
        },
        pedido: {
          select: {
            numeroPedido: true,
          },
        },
      },
    });

    return {
      sucesso: true,
      dados: notas.map((nota) => ({
        id: nota.id,
        numero: nota.numero,
        chaveAcesso: nota.chaveAcesso,
        serie: nota.serie,
        // Sem `?? 0`: nota sem valor lido tem que aparecer como travessão,
        // não como R$ 0,00 somando zero no total.
        valorTotal: nota.valorTotal === null ? null : Number(nota.valorTotal),
        status: nota.status,
        situacaoBling: nota.situacaoBling,
        dataEmissao: nota.dataEmissao?.toISOString() ?? null,
        clienteId: nota.clienteId,
        // O nome do contato do Bling é a reserva: o cadastro de clientes da
        // Konext pode não ter esse cliente, e nota sem nome é pior que nota
        // com o nome que o Bling conhece.
        clienteNome: nota.cliente?.nomeRazaoSocial ?? nota.clienteNome ?? null,
        doBling: nota.blingId !== null,
        pedidoId: nota.pedidoId,
        numeroPedido: nota.pedido?.numeroPedido ?? null,
        motivoSemVinculo: nota.motivoSemVinculo,
        linkXml: nota.linkXml,
        linkDanfe: nota.linkDanfe,
        descricaoItens: nota.descricaoItens,
        criadoEm: nota.criadoEm.toISOString(),
      })),
    };
  } catch (erro) {
    console.error("Erro ao listar notas fiscais:", erro);
    return { sucesso: false, erro: "Nao foi possivel carregar as notas fiscais." };
  }
}

export async function listarClientesParaNotaFiscal(): Promise<Array<{ id: string; nome: string }>> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");
  const prisma = contexto.prisma;

  const clientes = await prisma.cliente.findMany({
    orderBy: { nomeRazaoSocial: "asc" },
    select: {
      id: true,
      nomeRazaoSocial: true,
    },
  });

  return clientes.map((cliente) => ({
    id: cliente.id,
    nome: cliente.nomeRazaoSocial,
  }));
}

export async function criarNotaFiscal(input: CriarNotaFiscalInput): Promise<ResultadoAcaoNotaFiscal> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.lancar");
    const prisma = contexto.prisma;

    const erroValidacao = validarNotaFiscal(input);
    if (erroValidacao) {
      return { sucesso: false, erro: erroValidacao };
    }

    await prisma.notaFiscal.create({
      data: {
        numero: normalizarTexto(input.numero),
        chaveAcesso: normalizarTexto(input.chaveAcesso) || null,
        valorTotal: Number(input.valorTotal),
        status: input.status ?? "PENDENTE",
        clienteId: input.clienteId ?? null,
      },
    });

    revalidatePath("/financeiro/notas-fiscais");

    return { sucesso: true, mensagem: "Nota fiscal criada com sucesso." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao criar nota fiscal:", erro);
    return { sucesso: false, erro: "Nao foi possivel criar a nota fiscal." };
  }
}

export async function atualizarNotaFiscal(input: AtualizarNotaFiscalInput): Promise<ResultadoAcaoNotaFiscal> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.editar");
    const prisma = contexto.prisma;

    const erroValidacao = validarNotaFiscal(input);
    if (erroValidacao) {
      return { sucesso: false, erro: erroValidacao };
    }

    await prisma.notaFiscal.update({
      where: { id: input.id },
      data: {
        numero: normalizarTexto(input.numero),
        chaveAcesso: normalizarTexto(input.chaveAcesso) || null,
        valorTotal: Number(input.valorTotal),
        status: input.status ?? "PENDENTE",
        clienteId: input.clienteId ?? null,
      },
    });

    revalidatePath("/financeiro/notas-fiscais");

    return { sucesso: true, mensagem: "Nota fiscal atualizada com sucesso." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao atualizar nota fiscal:", erro);
    return { sucesso: false, erro: "Nao foi possivel atualizar a nota fiscal." };
  }
}

export async function atualizarStatusNotaFiscal(
  input: AtualizarStatusNotaFiscalInput
): Promise<ResultadoAcaoNotaFiscal> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.editar");
    const prisma = contexto.prisma;

    await prisma.notaFiscal.update({
      where: { id: input.id },
      data: {
        status: input.status,
      },
    });

    revalidatePath("/financeiro/notas-fiscais");

    return { sucesso: true, mensagem: "Status da nota fiscal atualizado." };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, erro: mensagemConhecida };
    }
    console.error("Erro ao atualizar status da nota fiscal:", erro);
    return { sucesso: false, erro: "Nao foi possivel atualizar o status da nota fiscal." };
  }
}
