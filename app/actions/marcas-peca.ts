"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { validarNomeMarca } from "@/lib/dominio/os/marcas-peca";

/**
 * Cadastro de marcas de peça (Fase 4).
 *
 * Duas permissões diferentes, de propósito:
 *
 * - **Gestão** (renomear, desativar, reativar) exige `configuracoes.sistema`: é
 *   vocabulário controlado, e quem renomeia uma marca mexe em todo o histórico
 *   que já aponta pra ela.
 * - **Criar** exige só `os.editar`, a mesma permissão de lançar o item. Sem isso
 *   o campo obrigatório viraria beco sem saída: o técnico com uma marca nova na
 *   mão não tem acesso a `/configuracoes` (bloqueado pra GESTOR e USUARIO) e
 *   ficaria impedido de concluir o lançamento. O risco de alguém cadastrar
 *   bobagem é real, mas é menor que travar o balcão — e a chave normalizada
 *   impede o pior caso, que é a mesma marca entrar escrita de três jeitos.
 *
 * Nenhuma permissão nova foi inventada: criar `pecas.marcas.criar` significaria
 * uma coluna nova na grade de cargos e migrar o conjunto de permissões de todos
 * os cargos existentes, o que não se paga para este cadastro.
 */

export type MarcaPecaListada = {
  id: string;
  nome: string;
  ativa: boolean;
  /** Quantos itens de OS já usam esta marca — decide se ela pode ser apagada. */
  totalItens: number;
};

export type ResultadoAcaoMarca =
  | { sucesso: true; mensagem: string; marca: { id: string; nome: string } }
  | { sucesso: false; mensagem: string };

/** Só as ativas, em ordem alfabética — é o que alimenta o seletor da OS. */
export async function listarMarcasPecaAtivas(): Promise<Array<{ id: string; nome: string }>> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "os.ver");

  return contexto.prisma.marcaPeca.findMany({
    where: { ativa: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

/** Todas, com a contagem de uso — é o que alimenta a tela de Configurações. */
export async function listarMarcasPeca(): Promise<MarcaPecaListada[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "configuracoes.sistema");

  const marcas = await contexto.prisma.marcaPeca.findMany({
    select: {
      id: true,
      nome: true,
      ativa: true,
      _count: { select: { itens: true } },
    },
    orderBy: [{ ativa: "desc" }, { nome: "asc" }],
  });

  return marcas.map((marca) => ({
    id: marca.id,
    nome: marca.nome,
    ativa: marca.ativa,
    totalItens: marca._count.itens,
  }));
}

export async function criarMarcaPeca(nomeBruto: string): Promise<ResultadoAcaoMarca> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");

    const validacao = validarNomeMarca(nomeBruto);
    if (!validacao.valido) {
      return { sucesso: false, mensagem: validacao.erro };
    }

    const marca = await contexto.prisma.marcaPeca.create({
      data: { nome: validacao.nome, nomeNormalizado: validacao.nomeNormalizado },
      select: { id: true, nome: true },
    });

    await registrarLogAuditoria(
      contexto.prisma,
      contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/marcas-peca.ts:criarMarcaPeca"),
      {
        acao: ACOES_AUDITORIA.CRIAR,
        entidade: ENTIDADES_AUDITORIA.MARCA_PECA,
        entidadeId: marca.id,
        dadosDepois: { nome: marca.nome },
      }
    );

    revalidatePath("/configuracoes");

    return { sucesso: true, mensagem: `Marca "${marca.nome}" cadastrada.`, marca };
  } catch (erro) {
    // A unicidade é o nome normalizado, então o conflito aqui significa que a
    // marca já existe escrita de outro jeito. Dizer isso é mais útil que
    // "registro duplicado": quem digitou "original" precisa saber que
    // "Original" já está lá.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { sucesso: false, mensagem: "Esta marca já está cadastrada." };
    }

    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    return { sucesso: false, mensagem: "Não foi possível cadastrar a marca." };
  }
}

export async function renomearMarcaPeca(id: string, nomeBruto: string): Promise<ResultadoAcaoMarca> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");

    const validacao = validarNomeMarca(nomeBruto);
    if (!validacao.valido) {
      return { sucesso: false, mensagem: validacao.erro };
    }

    const anterior = await contexto.prisma.marcaPeca.findUnique({
      where: { id },
      select: { nome: true },
    });

    if (!anterior) {
      return { sucesso: false, mensagem: "Marca não encontrada." };
    }

    const marca = await contexto.prisma.marcaPeca.update({
      where: { id },
      data: { nome: validacao.nome, nomeNormalizado: validacao.nomeNormalizado },
      select: { id: true, nome: true },
    });

    await registrarLogAuditoria(
      contexto.prisma,
      contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/marcas-peca.ts:renomearMarcaPeca"),
      {
        acao: ACOES_AUDITORIA.RENOMEAR_MARCA_PECA,
        entidade: ENTIDADES_AUDITORIA.MARCA_PECA,
        entidadeId: marca.id,
        dadosAntes: { nome: anterior.nome },
        dadosDepois: { nome: marca.nome },
      }
    );

    revalidatePath("/configuracoes");
    revalidatePath("/os");

    return { sucesso: true, mensagem: `Marca renomeada para "${marca.nome}".`, marca };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { sucesso: false, mensagem: "Já existe outra marca com este nome." };
    }

    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    return { sucesso: false, mensagem: "Não foi possível renomear a marca." };
  }
}

/**
 * Liga e desliga a marca. Não existe "excluir": a marca que já apareceu em OS é
 * referência de histórico, e apagá-la faria o relatório de dois anos mentir. O
 * banco recusaria de qualquer forma (onDelete: Restrict); desativar é a operação
 * que o negócio realmente quer quando uma marca sai de linha.
 */
export async function definirSituacaoMarcaPeca(id: string, ativa: boolean): Promise<ResultadoAcaoMarca> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");

    const marca = await contexto.prisma.marcaPeca.update({
      where: { id },
      data: { ativa },
      select: { id: true, nome: true },
    });

    await registrarLogAuditoria(
      contexto.prisma,
      contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/marcas-peca.ts:definirSituacaoMarcaPeca"),
      {
        acao: ativa ? ACOES_AUDITORIA.REATIVAR_MARCA_PECA : ACOES_AUDITORIA.DESATIVAR_MARCA_PECA,
        entidade: ENTIDADES_AUDITORIA.MARCA_PECA,
        entidadeId: marca.id,
        dadosDepois: { nome: marca.nome, ativa },
      }
    );

    revalidatePath("/configuracoes");
    revalidatePath("/os");

    return {
      sucesso: true,
      mensagem: ativa ? `Marca "${marca.nome}" reativada.` : `Marca "${marca.nome}" desativada.`,
      marca,
    };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return { sucesso: false, mensagem: "Marca não encontrada." };
    }

    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    return { sucesso: false, mensagem: "Não foi possível alterar a situação da marca." };
  }
}
