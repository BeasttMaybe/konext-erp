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
