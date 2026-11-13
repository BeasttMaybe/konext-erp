"use server";

import { revalidatePath } from "next/cache";

import { criarCliente } from "@/app/actions/crm";
import { criarCategoriaProduto } from "@/app/actions/categorias-produto";
import { salvarProduto } from "@/app/actions/estoque";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { normalizarNome } from "@/lib/dominio/texto/chave-de-nome";
import { paraMensagemSegura } from "@/lib/erros";
import {
  TAMANHO_DO_LOTE_CLIENTES,
  TAMANHO_DO_LOTE_PRODUTOS,
  type ClienteImportado,
  type ProdutoImportado,
} from "@/lib/importacao/planilha";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * Importacao por planilha (lib/importacao/planilha.ts). A tela manda em lotes;
 * cada linha passa pelas MESMAS actions do cadastro manual (criarCliente,
 * salvarProduto), entao vale toda regra de la: validacao, SKU gerado,
 * movimento de estoque do saldo inicial.
 *
 * Repetidos sao pulados, nao duplicados:
 * - cliente com o mesmo CPF/CNPJ, ou sem documento e com mesmo nome + telefone;
 * - produto com o mesmo codigo de barras, SKU ou nome.
 */

export type ResultadoDoLote = {
  criados: number;
  repetidos: number[];
  erros: Array<{ indice: number; mensagem: string }>;
};

export async function importarClientes(lote: ClienteImportado[]): Promise<ResultadoDoLote> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "crm.editar");
  if (!Array.isArray(lote) || lote.length > TAMANHO_DO_LOTE_CLIENTES) throw new Error("Lote inválido.");
  const prisma = contexto.prisma;

  const documentos = lote.map((c) => c.documento).filter((d): d is string => Boolean(d));
  const telefones = lote.map((c) => String(c.telefone ?? ""));
  const [porDocumento, porTelefone] = await Promise.all([
    documentos.length ? prisma.cliente.findMany({ where: { documento: { in: documentos } }, select: { documento: true } }) : [],
    prisma.cliente.findMany({ where: { telefone: { in: telefones } }, select: { telefone: true, nomeRazaoSocial: true } }),
  ]);
  const documentosExistentes = new Set(porDocumento.map((c) => c.documento));
  const nomeTelefone = (nome: string, telefone: string) => `${normalizarNome(nome)}|${telefone}`;
  const pares = new Set(porTelefone.map((c) => nomeTelefone(c.nomeRazaoSocial, c.telefone)));

  const resultado: ResultadoDoLote = { criados: 0, repetidos: [], erros: [] };
  for (const [indice, cliente] of lote.entries()) {
    const par = nomeTelefone(String(cliente.nomeRazaoSocial ?? ""), String(cliente.telefone ?? ""));
    if ((cliente.documento && documentosExistentes.has(cliente.documento)) || (!cliente.documento && pares.has(par))) {
      resultado.repetidos.push(indice);
      continue;
    }
    try {
      const criado = await criarCliente({
        ...cliente,
        papel: "CLIENTE",
        isWhatsapp: true,
        categoria: cliente.tipoPessoa === "JURIDICA" ? "EMPRESA" : "CLIENTE_FINAL",
      });
      if (criado.sucesso) {
        resultado.criados++;
        if (cliente.documento) documentosExistentes.add(cliente.documento);
        pares.add(par);
      } else if (criado.mensagem.includes("Já existe")) {
        resultado.repetidos.push(indice);
      } else {
        resultado.erros.push({ indice, mensagem: criado.mensagem });
      }
    } catch (erro) {
      resultado.erros.push({ indice, mensagem: paraMensagemSegura(erro) });
    }
  }
  revalidatePath("/crm");
  return resultado;
}

export async function importarProdutos(lote: ProdutoImportado[]): Promise<ResultadoDoLote> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.editar");
  if (!Array.isArray(lote) || lote.length > TAMANHO_DO_LOTE_PRODUTOS) throw new Error("Lote inválido.");
  const prisma = contexto.prisma;

  const [categorias, existentes] = await Promise.all([
    prisma.categoriaProduto.findMany({ select: { id: true, nomeNormalizado: true, ativa: true } }),
    prisma.produto.findMany({
      where: {
        OR: [
          { codigoBarras: { in: lote.map((p) => p.codigoBarras).filter((c): c is string => Boolean(c)) } },
          { sku: { in: lote.map((p) => p.sku).filter((s): s is string => Boolean(s)) } },
          { nome: { in: lote.map((p) => String(p.nome ?? "")), mode: "insensitive" } },
        ],
      },
      select: { nome: true, codigoBarras: true, sku: true },
    }),
  ]);
  const categoriaPorNome = new Map(categorias.map((c) => [c.nomeNormalizado, c]));
  const nomes = new Set(existentes.map((p) => normalizarNome(p.nome)));
  const codigos = new Set(existentes.map((p) => p.codigoBarras).filter(Boolean));
  const skus = new Set(existentes.map((p) => p.sku).filter(Boolean));

  const resultado: ResultadoDoLote = { criados: 0, repetidos: [], erros: [] };
  for (const [indice, produto] of lote.entries()) {
    if (
      nomes.has(normalizarNome(String(produto.nome ?? ""))) ||
      (produto.codigoBarras && codigos.has(produto.codigoBarras)) ||
      (produto.sku && skus.has(produto.sku))
    ) {
      resultado.repetidos.push(indice);
      continue;
    }
    try {
      const chaveCategoria = normalizarNome(String(produto.categoria ?? ""));
      let categoria = categoriaPorNome.get(chaveCategoria);
      if (!categoria) {
        const criada = await criarCategoriaProduto(String(produto.categoria ?? ""));
        if (!criada.sucesso) {
          resultado.erros.push({ indice, mensagem: `Categoria: ${criada.mensagem}` });
          continue;
        }
        categoria = { id: criada.categoria.id, nomeNormalizado: chaveCategoria, ativa: true };
        categoriaPorNome.set(chaveCategoria, categoria);
      }
      if (!categoria.ativa) {
        resultado.erros.push({ indice, mensagem: "A categoria está desativada." });
        continue;
      }

      const salvo = await salvarProduto(null, {
        nome: produto.nome,
        categoriaId: categoria.id,
        sku: produto.sku,
        unidade: produto.unidade,
        codigoBarras: produto.codigoBarras,
        compatibilidade: produto.compatibilidade,
        descricao: produto.descricao,
        custo: produto.custo,
        precoVenda: produto.precoVenda,
        quantidadeEstoque: produto.quantidadeEstoque,
        estoqueMinimo: produto.estoqueMinimo,
        permiteVendaSemEstoque: false,
        ativo: true,
      });
      if (salvo.sucesso) {
        resultado.criados++;
        nomes.add(normalizarNome(produto.nome));
        if (produto.codigoBarras) codigos.add(produto.codigoBarras);
        if (produto.sku) skus.add(produto.sku);
      } else {
        resultado.erros.push({ indice, mensagem: salvo.mensagem });
      }
    } catch (erro) {
      resultado.erros.push({ indice, mensagem: paraMensagemSegura(erro) });
    }
  }
  revalidatePath("/estoque");
  return resultado;
}
