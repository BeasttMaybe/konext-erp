"use server";

import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao, temPermissao } from "@/lib/auth/permissoes";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { deDecimal, paraMoeda } from "@/lib/dinheiro";
import { mensagemDeErroConhecido } from "@/lib/erros";
import { calcularNovoPreco, lerRegraDePreco, normalizarIds } from "@/lib/dominio/estoque/operacoes-em-massa";

/**
 * Operacoes em varios produtos de uma vez (regras em
 * lib/dominio/estoque/operacoes-em-massa.ts). Tudo numa transacao: ou muda
 * todos, ou nenhum. Cada produto alterado ganha sua linha no log de
 * auditoria, igual a edicao de um por um.
 */

export type ResultadoEmMassa = { sucesso: true; mensagem: string; alterados: number } | { sucesso: false; mensagem: string };

const ORIGEM = "app/actions/estoque-em-massa.ts";

function revalidarEstoque() {
  revalidatePath("/estoque");
  revalidatePath("/pdv");
  revalidatePath("/");
}

function falha(erro: unknown, padrao: string): ResultadoEmMassa {
  const conhecida = mensagemDeErroConhecido(erro);
  if (conhecida !== null) return { sucesso: false, mensagem: conhecida };
  console.error(`[estoque-em-massa] ${padrao}`, erro instanceof Error ? erro.message : erro);
  return { sucesso: false, mensagem: padrao };
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

export async function alterarPrecosEmMassa(
  ids: string[],
  entrada: { modo: string; valor: string; arredondamento: string }
): Promise<ResultadoEmMassa> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");

    const lidos = normalizarIds(ids);
    if (!lidos.ok) return { sucesso: false, mensagem: lidos.erro };
    const regra = lerRegraDePreco(entrada ?? {});
    if (!regra.ok) return { sucesso: false, mensagem: regra.erro };
    // O preco pela margem revela o custo: so quem ja ve custo pode usar.
    if (regra.regra.modo === "MARGEM_SOBRE_CUSTO" && !temPermissao(contexto, "estoque.ver_custos")) {
      return { sucesso: false, mensagem: "Seu cargo não vê custos, então não pode usar a margem sobre o custo." };
    }

    const resultado = await contexto.prisma.$transaction(async (tx) => {
      const produtos = await tx.produto.findMany({
        where: { id: { in: lidos.ids } },
        select: { id: true, nome: true, precoVenda: true, custo: true },
      });
      let alterados = 0;
      const pulados: string[] = [];
      for (const produto of produtos) {
        const atual = deDecimal(produto.precoVenda);
        const calculo = calcularNovoPreco(atual, deDecimal(produto.custo), regra.regra, regra.arredondamento);
        if (!calculo.ok) {
          pulados.push(produto.nome);
          continue;
        }
        if (calculo.novoCentavos === atual) continue;
        const novo = paraMoeda(calculo.novoCentavos);
        await tx.produto.update({ where: { id: produto.id }, data: { precoVenda: novo }, select: { id: true } });
        await registrarLogAuditoria(tx, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:alterarPrecosEmMassa`), {
          acao: ACOES_AUDITORIA.ATUALIZAR_PRODUTO,
          entidade: ENTIDADES_AUDITORIA.PRODUTO,
          entidadeId: produto.id,
          dadosAntes: { precoVenda: paraMoeda(atual) },
          dadosDepois: { precoVenda: novo, emMassa: true },
        });
        alterados += 1;
      }
      return { alterados, pulados };
    });

    revalidarEstoque();
    const sufixo = resultado.pulados.length
      ? ` ${plural(resultado.pulados.length, "produto ficou", "produtos ficaram")} de fora por não ter custo cadastrado.`
      : "";
    return {
      sucesso: true,
      alterados: resultado.alterados,
      mensagem: `Preço alterado em ${plural(resultado.alterados, "produto", "produtos")}.${sufixo}`,
    };
  } catch (erro) {
    return falha(erro, "Não foi possível alterar os preços.");
  }
}

export async function alterarCategoriaEmMassa(ids: string[], categoriaId: string): Promise<ResultadoEmMassa> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");
    const lidos = normalizarIds(ids);
    if (!lidos.ok) return { sucesso: false, mensagem: lidos.erro };

    const categoria = await contexto.prisma.categoriaProduto.findFirst({
      where: { id: String(categoriaId ?? ""), ativa: true },
      select: { id: true, nome: true },
    });
    if (!categoria) return { sucesso: false, mensagem: "Categoria não encontrada." };

    const alterados = await contexto.prisma.$transaction(async (tx) => {
      const produtos = await tx.produto.findMany({
        where: { id: { in: lidos.ids }, categoriaId: { not: categoria.id } },
        select: { id: true, categoriaId: true },
      });
      for (const produto of produtos) {
        await tx.produto.update({ where: { id: produto.id }, data: { categoriaId: categoria.id }, select: { id: true } });
        await registrarLogAuditoria(tx, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:alterarCategoriaEmMassa`), {
          acao: ACOES_AUDITORIA.ATUALIZAR_PRODUTO,
          entidade: ENTIDADES_AUDITORIA.PRODUTO,
          entidadeId: produto.id,
          dadosAntes: { categoriaId: produto.categoriaId },
          dadosDepois: { categoriaId: categoria.id, emMassa: true },
        });
      }
      return produtos.length;
    });

    revalidarEstoque();
    return { sucesso: true, alterados, mensagem: `${plural(alterados, "produto movido", "produtos movidos")} para "${categoria.nome}".` };
  } catch (erro) {
    return falha(erro, "Não foi possível mudar a categoria.");
  }
}

export async function alterarEstoqueMinimoEmMassa(ids: string[], minimo: number): Promise<ResultadoEmMassa> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");
    const lidos = normalizarIds(ids);
    if (!lidos.ok) return { sucesso: false, mensagem: lidos.erro };
    const valor = Number(minimo);
    if (!Number.isInteger(valor) || valor < 0 || valor > 100_000) {
      return { sucesso: false, mensagem: "O estoque mínimo precisa ser um número inteiro, zero ou mais." };
    }

    const alterados = await contexto.prisma.$transaction(async (tx) => {
      const produtos = await tx.produto.findMany({
        where: { id: { in: lidos.ids }, estoqueMinimo: { not: valor } },
        select: { id: true, estoqueMinimo: true },
      });
      for (const produto of produtos) {
        await tx.produto.update({ where: { id: produto.id }, data: { estoqueMinimo: valor }, select: { id: true } });
        await registrarLogAuditoria(tx, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:alterarEstoqueMinimoEmMassa`), {
          acao: ACOES_AUDITORIA.ATUALIZAR_PRODUTO,
          entidade: ENTIDADES_AUDITORIA.PRODUTO,
          entidadeId: produto.id,
          dadosAntes: { estoqueMinimo: produto.estoqueMinimo },
          dadosDepois: { estoqueMinimo: valor, emMassa: true },
        });
      }
      return produtos.length;
    });

    revalidarEstoque();
    return { sucesso: true, alterados, mensagem: `Estoque mínimo atualizado em ${plural(alterados, "produto", "produtos")}.` };
  } catch (erro) {
    return falha(erro, "Não foi possível alterar o estoque mínimo.");
  }
}

export async function desativarProdutosEmMassa(ids: string[]): Promise<ResultadoEmMassa> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.excluir");
    const lidos = normalizarIds(ids);
    if (!lidos.ok) return { sucesso: false, mensagem: lidos.erro };

    const alterados = await contexto.prisma.$transaction(async (tx) => {
      const produtos = await tx.produto.findMany({
        where: { id: { in: lidos.ids }, ativo: true },
        select: { id: true, nome: true, quantidadeEstoque: true },
      });
      for (const produto of produtos) {
        await tx.produto.update({ where: { id: produto.id }, data: { ativo: false }, select: { id: true } });
        await registrarLogAuditoria(tx, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:desativarProdutosEmMassa`), {
          acao: ACOES_AUDITORIA.EXCLUIR_LOGICO,
          entidade: ENTIDADES_AUDITORIA.PRODUTO,
          entidadeId: produto.id,
          dadosDepois: { nome: produto.nome, ativo: false, saldoNoMomento: produto.quantidadeEstoque, emMassa: true },
        });
      }
      return produtos.length;
    });

    revalidarEstoque();
    return { sucesso: true, alterados, mensagem: `${plural(alterados, "produto desativado", "produtos desativados")}. Dá para reativar na página de cada um.` };
  } catch (erro) {
    return falha(erro, "Não foi possível desativar os produtos.");
  }
}
