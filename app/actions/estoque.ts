"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao, temPermissao } from "@/lib/auth/permissoes";
import { formProdutoSchema, type FormProduto } from "@/lib/validations/estoque";

type ResultadoCriarProduto =
  | { sucesso: true; mensagem: string }
  | { sucesso: false; mensagem: string };

export async function criarProduto(data: FormProduto): Promise<ResultadoCriarProduto> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");
    const prisma = contexto.prisma;
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

    if (erro instanceof Error && erro.name === "ErroPermissao") {
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

/**
 * Lista completa de produtos ativos (sem paginacao).
 *
 * NENHUM chamador atual usa esta funcao — a tela de estoque usa
 * `listarProdutosPaginado`. Mantida e corrigida por seguranca (F-41): se
 * algo voltar a chama-la, o custo continua protegido pela mesma regra.
 */
export async function listarProdutos() {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");
  const prisma = contexto.prisma;
  const podeVerCustos = temPermissao(contexto, "estoque.ver_custos");

  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
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
      ativo: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });

  return produtos.map((produto) => ({
    ...produto,
    custo: podeVerCustos ? produto.custo : null,
  }));
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
  /** null quando o usuario logado nao tem a permissao estoque.ver_custos (F-41). */
  custo: number | null;
  precoVenda: number;
  quantidadeEstoque: number;
  estoqueMinimo: number;
}>> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");
  const prisma = contexto.prisma;
  const podeVerCustos = temPermissao(contexto, "estoque.ver_custos");
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
    // Custo/margem só vai para o cliente com estoque.ver_custos (F-41).
    // Omitido no mapeamento do servidor — nunca filtrado na UI.
    data: produtos.map((produto) => ({
      ...produto,
      custo: podeVerCustos ? produto.custo : null,
    })),
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
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");
    const prisma = contexto.prisma;
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

    if (erro instanceof Error && erro.name === "ErroPermissao") {
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
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.excluir");
    const prisma = contexto.prisma;

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

    if (erro instanceof Error && erro.name === "ErroPermissao") {
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
