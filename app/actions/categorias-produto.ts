"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { podeDesativarCategoria, validarNomeCategoria } from "@/lib/dominio/estoque/categoria";

/**
 * Cadastro de categorias de produto.
 *
 * Mesmas duas permissões das marcas de peça, pelo mesmo motivo:
 *
 * - **Criar** exige só `estoque.editar`, a mesma de cadastrar produto. Sem isso
 *   o campo obrigatório viraria beco sem saída: quem está cadastrando um
 *   produto de uma categoria nova não necessariamente tem acesso a
 *   `/configuracoes`, e ficaria impedido de concluir o cadastro.
 * - **Renomear e desativar** exigem `configuracoes.sistema`: é vocabulário
 *   controlado, e renomear muda o rótulo de todo o histórico que aponta pra ela.
 *
 * Nenhuma permissão nova foi inventada — criar uma significaria coluna nova na
 * grade de cargos e migrar o conjunto de permissões de todos os cargos
 * existentes, o que não se paga para este cadastro.
 */

export type CategoriaProdutoListada = {
  id: string;
  nome: string;
  ativa: boolean;
  /** Quantos produtos ativos usam a categoria — é o que decide se pode desativar. */
  produtosAtivos: number;
  /** Total, incluindo produtos já desativados. */
  produtosNoTotal: number;
};

export type ResultadoAcaoCategoria =
  | { sucesso: true; mensagem: string; categoria: { id: string; nome: string } }
  | { sucesso: false; mensagem: string };

/** Só as ativas, em ordem alfabética — é o que alimenta o seletor do produto. */
export async function listarCategoriasAtivas(): Promise<Array<{ id: string; nome: string }>> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");

  return contexto.prisma.categoriaProduto.findMany({
    where: { ativa: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

/** Todas, com a contagem de uso — é o que alimenta a tela de gestão. */
export async function listarCategoriasProduto(): Promise<CategoriaProdutoListada[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");

  const categorias = await contexto.prisma.categoriaProduto.findMany({
    select: {
      id: true,
      nome: true,
      ativa: true,
      _count: { select: { produtos: true } },
      // Produtos ATIVOS é a contagem que decide a desativação; o total serve de
      // contexto na tela ("vazia hoje, mas já teve produto").
      produtos: { where: { ativo: true }, select: { id: true } },
    },
    orderBy: [{ ativa: "desc" }, { nome: "asc" }],
  });

  return categorias.map((categoria) => ({
    id: categoria.id,
    nome: categoria.nome,
    ativa: categoria.ativa,
    produtosAtivos: categoria.produtos.length,
    produtosNoTotal: categoria._count.produtos,
  }));
}

export async function criarCategoriaProduto(nomeBruto: string): Promise<ResultadoAcaoCategoria> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");

    const validacao = validarNomeCategoria(nomeBruto);
    if (!validacao.valido) {
      return { sucesso: false, mensagem: validacao.erro };
    }

    const categoria = await contexto.prisma.categoriaProduto.create({
      data: { nome: validacao.nome, nomeNormalizado: validacao.nomeNormalizado },
      select: { id: true, nome: true },
    });

    await registrarLogAuditoria(
      contexto.prisma,
      contextoAuditoriaDoUsuario(
        contexto.usuarioOperacional,
        "app/actions/categorias-produto.ts:criarCategoriaProduto"
      ),
      {
        acao: ACOES_AUDITORIA.CRIAR,
        entidade: ENTIDADES_AUDITORIA.CATEGORIA_PRODUTO,
        entidadeId: categoria.id,
        dadosDepois: { nome: categoria.nome },
      }
    );

    revalidatePath("/estoque");

    return { sucesso: true, mensagem: `Categoria "${categoria.nome}" criada.`, categoria };
  } catch (erro) {
    // A unicidade é o nome normalizado, então conflito aqui quer dizer que a
    // categoria já existe escrita de outro jeito. Dizer isso é mais útil que
    // "registro duplicado": quem digitou "capas" precisa saber que "Capas" já
    // está lá.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { sucesso: false, mensagem: "Esta categoria já existe." };
    }

    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    console.error("Erro ao criar categoria de produto:", erro);
    return { sucesso: false, mensagem: "Não foi possível criar a categoria." };
  }
}

export async function renomearCategoriaProduto(
  id: string,
  nomeBruto: string
): Promise<ResultadoAcaoCategoria> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");

    const validacao = validarNomeCategoria(nomeBruto);
    if (!validacao.valido) {
      return { sucesso: false, mensagem: validacao.erro };
    }

    const anterior = await contexto.prisma.categoriaProduto.findUnique({
      where: { id },
      select: { nome: true },
    });

    if (!anterior) {
      return { sucesso: false, mensagem: "Categoria não encontrada." };
    }

    const categoria = await contexto.prisma.categoriaProduto.update({
      where: { id },
      data: { nome: validacao.nome, nomeNormalizado: validacao.nomeNormalizado },
      select: { id: true, nome: true },
    });

    await registrarLogAuditoria(
      contexto.prisma,
      contextoAuditoriaDoUsuario(
        contexto.usuarioOperacional,
        "app/actions/categorias-produto.ts:renomearCategoriaProduto"
      ),
      {
        acao: ACOES_AUDITORIA.RENOMEAR_CATEGORIA_PRODUTO,
        entidade: ENTIDADES_AUDITORIA.CATEGORIA_PRODUTO,
        entidadeId: categoria.id,
        dadosAntes: { nome: anterior.nome },
        dadosDepois: { nome: categoria.nome },
      }
    );

    revalidatePath("/estoque");
    revalidatePath("/pdv");

    return {
      sucesso: true,
      mensagem: `Categoria renomeada para "${categoria.nome}".`,
      categoria,
    };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { sucesso: false, mensagem: "Já existe outra categoria com este nome." };
    }

    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    console.error("Erro ao renomear categoria de produto:", erro);
    return { sucesso: false, mensagem: "Não foi possível renomear a categoria." };
  }
}

/**
 * Liga e desliga a categoria. Não existe "excluir": a categoria que já
 * classificou produto é referência de histórico, e o banco recusaria de
 * qualquer forma (onDelete: Restrict). As duas recusas — categoria com produto
 * ativo e última categoria ativa — vêm de
 * `lib/dominio/estoque/categoria.ts`.
 */
export async function definirSituacaoCategoriaProduto(
  id: string,
  ativa: boolean
): Promise<ResultadoAcaoCategoria> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");
    const prisma = contexto.prisma;

    if (!ativa) {
      const [produtosAtivosNaCategoria, categoriasAtivasNoTotal] = await Promise.all([
        prisma.produto.count({ where: { categoriaId: id, ativo: true } }),
        prisma.categoriaProduto.count({ where: { ativa: true } }),
      ]);

      const decisao = podeDesativarCategoria({
        produtosAtivosNaCategoria,
        categoriasAtivasNoTotal,
      });

      if (!decisao.permitido) {
        return { sucesso: false, mensagem: decisao.erro };
      }
    }

    const categoria = await prisma.categoriaProduto.update({
      where: { id },
      data: { ativa },
      select: { id: true, nome: true },
    });

    await registrarLogAuditoria(
      prisma,
      contextoAuditoriaDoUsuario(
        contexto.usuarioOperacional,
        "app/actions/categorias-produto.ts:definirSituacaoCategoriaProduto"
      ),
      {
        acao: ativa
          ? ACOES_AUDITORIA.REATIVAR_CATEGORIA_PRODUTO
          : ACOES_AUDITORIA.DESATIVAR_CATEGORIA_PRODUTO,
        entidade: ENTIDADES_AUDITORIA.CATEGORIA_PRODUTO,
        entidadeId: categoria.id,
        dadosDepois: { nome: categoria.nome, ativa },
      }
    );

    revalidatePath("/estoque");
    revalidatePath("/pdv");

    return {
      sucesso: true,
      mensagem: ativa
        ? `Categoria "${categoria.nome}" reativada.`
        : `Categoria "${categoria.nome}" desativada.`,
      categoria,
    };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return { sucesso: false, mensagem: "Categoria não encontrada." };
    }

    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    console.error("Erro ao alterar situação da categoria:", erro);
    return { sucesso: false, mensagem: "Não foi possível alterar a situação da categoria." };
  }
}
