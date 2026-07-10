"use server";

import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import type { StatusNotaFiscal } from "@prisma/client";

export type ResultadoAcaoNotaFiscal =
  | { sucesso: true; mensagem: string }
  | { sucesso: false; erro: string };

export type NotaFiscalLista = {
  id: string;
  numero: string;
  chaveAcesso: string | null;
  valorTotal: number;
  status: StatusNotaFiscal;
  clienteId: string | null;
  clienteNome: string | null;
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
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        numero: true,
        chaveAcesso: true,
        valorTotal: true,
        status: true,
        criadoEm: true,
        clienteId: true,
        cliente: {
          select: {
            nomeRazaoSocial: true,
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
        valorTotal: Number(nota.valorTotal ?? 0),
        status: nota.status,
        clienteId: nota.clienteId,
        clienteNome: nota.cliente?.nomeRazaoSocial ?? null,
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
    console.error("Erro ao criar nota fiscal:", erro);
    return { sucesso: false, erro: "Nao foi possivel criar a nota fiscal." };
  }
}

export async function atualizarNotaFiscal(input: AtualizarNotaFiscalInput): Promise<ResultadoAcaoNotaFiscal> {
  try {
    const contexto = await exigirContextoTenant();
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
    console.error("Erro ao atualizar nota fiscal:", erro);
    return { sucesso: false, erro: "Nao foi possivel atualizar a nota fiscal." };
  }
}

export async function atualizarStatusNotaFiscal(
  input: AtualizarStatusNotaFiscalInput
): Promise<ResultadoAcaoNotaFiscal> {
  try {
    const contexto = await exigirContextoTenant();
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
    console.error("Erro ao atualizar status da nota fiscal:", erro);
    return { sucesso: false, erro: "Nao foi possivel atualizar o status da nota fiscal." };
  }
}
