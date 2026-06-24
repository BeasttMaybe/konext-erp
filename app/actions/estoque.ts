"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formProdutoSchema, type FormProduto } from "@/lib/validations/estoque";
import { exigirSessao } from "@/lib/auth/sessao";

type ResultadoCriarProduto =
  | { sucesso: true; mensagem: string }
  | { sucesso: false; mensagem: string };

export async function criarProduto(data: FormProduto): Promise<ResultadoCriarProduto> {
  try {
    await exigirSessao();
    const dadosValidados = formProdutoSchema.parse(data);

    await prisma.produto.create({
      data: {
        nome: dadosValidados.nome.trim(),
        codigoBarras: dadosValidados.codigoBarras?.trim() || null,
        imagemUrl: dadosValidados.imagemUrl?.trim() || null,
        descricao: dadosValidados.descricao?.trim() || null,
        categoria: dadosValidados.categoria,
        custo: dadosValidados.custo,
        precoVenda: dadosValidados.precoVenda,
        quantidadeEstoque: dadosValidados.quantidadeEstoque,
        estoqueMinimo: dadosValidados.estoqueMinimo,
      },
    });

    revalidatePath("/estoque");
    revalidatePath("/");

    return {
      sucesso: true,
      mensagem: "Produto cadastrado com sucesso.",
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("Sessão")) {
      return { sucesso: false, mensagem: erro.message };
    }

    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      return {
        sucesso: false,
        mensagem: "Ja existe um produto com este codigo de barras.",
      };
    }

    console.error("Erro ao criar produto:", erro);

    return {
      sucesso: false,
      mensagem: "Nao foi possivel cadastrar o produto. Tente novamente.",
    };
  }
}

export async function listarProdutos() {
  return prisma.produto.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });
}

// ── Paginação de Produtos ──────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listarProdutosPaginado(
  page: number = 1,
  limit: number = 20,
  busca?: string,
  categoria?: FormProduto["categoria"] | "TODAS"
): Promise<PaginatedResult<{
  id: string;
  nome: string;
  codigoBarras: string | null;
  imagemUrl: string | null;
  descricao: string | null;
  categoria: string;
  custo: number;
  precoVenda: number;
  quantidadeEstoque: number;
  estoqueMinimo: number;
}>> {
  const skip = (page - 1) * limit;

  const where: Prisma.ProdutoWhereInput = { ativo: true };

  if (categoria && categoria !== "TODAS") {
    where.categoria = categoria;
  }

  if (busca && busca.trim().length > 0) {
    const termo = busca.trim();
    where.OR = [
      { nome:          { contains: termo, mode: "insensitive" } },
      { codigoBarras:  { contains: termo, mode: "insensitive" } },
    ];
  }

  const [total, produtos] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      orderBy: { nome: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        nome: true,
        codigoBarras: true,
        imagemUrl: true,
        descricao: true,
        categoria: true,
        custo: true,
        precoVenda: true,
        quantidadeEstoque: true,
        estoqueMinimo: true,
      },
    }),
  ]);

  return {
    data: produtos,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function atualizarProduto(
  id: string,
  data: FormProduto
): Promise<ResultadoCriarProduto> {
  try {
    await exigirSessao();
    const dadosValidados = formProdutoSchema.parse(data);

    await prisma.produto.update({
      where: { id },
      data: {
        nome: dadosValidados.nome.trim(),
        codigoBarras: dadosValidados.codigoBarras?.trim() || null,
        imagemUrl: dadosValidados.imagemUrl?.trim() || null,
        descricao: dadosValidados.descricao?.trim() || null,
        categoria: dadosValidados.categoria,
        custo: dadosValidados.custo,
        precoVenda: dadosValidados.precoVenda,
        quantidadeEstoque: dadosValidados.quantidadeEstoque,
        estoqueMinimo: dadosValidados.estoqueMinimo,
      },
    });

    revalidatePath("/estoque");
    revalidatePath("/");

    return {
      sucesso: true,
      mensagem: "Produto atualizado com sucesso.",
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("Sessão")) {
      return { sucesso: false, mensagem: erro.message };
    }

    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      return {
        sucesso: false,
        mensagem: "Ja existe um produto com este codigo de barras.",
      };
    }

    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2025"
    ) {
      return {
        sucesso: false,
        mensagem: "Produto nao encontrado para atualizacao.",
      };
    }

    console.error("Erro ao atualizar produto:", erro);

    return {
      sucesso: false,
      mensagem: "Nao foi possivel atualizar o produto. Tente novamente.",
    };
  }
}

export async function excluirProduto(
  id: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    await exigirSessao();
    await prisma.produto.delete({
      where: { id },
    });

    revalidatePath("/estoque");
    revalidatePath("/");

    return {
      sucesso: true,
      mensagem: "Produto excluido com sucesso.",
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("Sessão")) {
      return { sucesso: false, mensagem: erro.message };
    }

    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2025"
    ) {
      return {
        sucesso: false,
        mensagem: "Produto nao encontrado para exclusao.",
      };
    }

    console.error("Erro ao excluir produto:", erro);

    return {
      sucesso: false,
      mensagem: "Nao foi possivel excluir o produto. Tente novamente.",
    };
  }
}
