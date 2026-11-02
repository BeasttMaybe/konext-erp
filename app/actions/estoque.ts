"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao, temPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import { formProdutoSchema, type FormProduto } from "@/lib/validations/estoque";
import { deDecimal, multiplicarPorQuantidade, paraMoeda, somar, subtrair } from "@/lib/dinheiro";
import { agoraNaLoja, somarDias } from "@/lib/datas";
import { registrarMovimentacaoEstoque } from "@/lib/estoque-movimentacao";

type ResultadoCriarProduto =
  | { sucesso: true; mensagem: string }
  | { sucesso: false; mensagem: string };

export async function criarProduto(data: FormProduto): Promise<ResultadoCriarProduto> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");
    const prisma = contexto.prisma;
    const dadosValidados = formProdutoSchema.parse(data);

    // Fase 4: produto e saldo inicial nascem na MESMA transacao do movimento
    // que explica esse saldo. Sem isso, o primeiro numero de todo produto
    // apareceria no livro como se tivesse surgido do nada.
    await prisma.$transaction(async (tx) => {
      const criado = await tx.produto.create({
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
        select: { id: true, quantidadeEstoque: true },
      });

      if (criado.quantidadeEstoque > 0) {
        await registrarMovimentacaoEstoque(tx, {
          produtoId: criado.id,
          origem: "CADASTRO",
          quantidade: criado.quantidadeEstoque,
          saldoPosterior: criado.quantidadeEstoque,
          custoUnitario: dadosValidados.custo,
          observacao: "Saldo informado no cadastro do produto",
          registradoPorId: contexto.usuarioOperacional?.id ?? null,
        });
      }
    });

    revalidatePath("/estoque");
    revalidatePath("/");

    return {
      sucesso: true,
      mensagem: "Produto cadastrado com sucesso.",
    };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
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
    custo: podeVerCustos ? paraMoeda(deDecimal(produto.custo)) : null,
    precoVenda: paraMoeda(deDecimal(produto.precoVenda)),
  }));
}

// ── Paginação de Produtos ──────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

/** Situação de saldo, que é por onde o dono filtra pra decidir o que repor. */
export type SituacaoEstoque = "TODAS" | "SEM_ESTOQUE" | "ABAIXO_DO_MINIMO" | "OK";

export async function listarProdutosPaginado(
  page: number = 1,
  limit: number = 20,
  busca?: string,
  categoria?: FormProduto["categoria"] | "TODAS",
  situacao: SituacaoEstoque = "TODAS",
  ordem: "nome" | "menor_saldo" | "maior_valor" = "nome"
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

  // "abaixo do mínimo" é saldo entre 1 e o mínimo DAQUELE produto — cada um
  // tem o seu. Isso compara duas colunas da mesma linha
  // (`quantidadeEstoque <= estoqueMinimo`), e o Prisma não expressa isso num
  // `where`: ele só compara coluna com valor. Então os ids saem de uma query
  // crua e entram como `id in (...)`.
  //
  // Duas idas ao banco em vez de uma, e a lista de ids cresce com o catálogo.
  // Aceitável no tamanho de um estoque de revenda de assistência (dezenas a
  // centenas de itens); se um dia passar de alguns milhares, a paginação toda
  // desta tela vira query crua.
  if (situacao === "SEM_ESTOQUE") {
    where.quantidadeEstoque = { lte: 0 };
  } else if (situacao === "ABAIXO_DO_MINIMO" || situacao === "OK") {
    const comparador = situacao === "ABAIXO_DO_MINIMO" ? Prisma.sql`<=` : Prisma.sql`>`;

    const linhas = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Produto"
      WHERE ativo = true
        AND "quantidadeEstoque" > 0
        AND "quantidadeEstoque" ${comparador} "estoqueMinimo"
    `;

    where.id = { in: linhas.map((linha) => String(linha.id)) };
  }

  const [total, produtos] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      orderBy: ordem === "menor_saldo" ? { quantidadeEstoque: "asc" } : { nome: "asc" },
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
      custo: podeVerCustos && produto.custo !== null ? paraMoeda(deDecimal(produto.custo)) : null,
      precoVenda: paraMoeda(deDecimal(produto.precoVenda)),
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

    await prisma.$transaction(async (tx) => {
      // Le o saldo ANTES de escrever: e a unica forma de saber se a edicao
      // mexeu no estoque, e de quanto foi a diferenca.
      const antes = await tx.produto.findUnique({
        where: { id },
        select: { quantidadeEstoque: true },
      });

      await tx.produto.update({
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

      const saldoNovo = dadosValidados.quantidadeEstoque;
      const saldoVelho = antes?.quantidadeEstoque ?? null;

      // Edicao que nao toca no saldo nao vira movimento: o livro e de estoque,
      // nao de cadastro. Trocar o nome do produto nao e entrada nem saida.
      if (saldoVelho !== null && saldoNovo !== saldoVelho) {
        const diferenca = saldoNovo - saldoVelho;

        await registrarMovimentacaoEstoque(tx, {
          produtoId: id,
          origem: "AJUSTE_MANUAL",
          tipo: "AJUSTE",
          quantidade: Math.abs(diferenca),
          saldoPosterior: saldoNovo,
          custoUnitario: dadosValidados.custo,
          observacao:
            diferenca > 0
              ? `Saldo corrigido a mao de ${saldoVelho} para ${saldoNovo} (+${diferenca})`
              : `Saldo corrigido a mao de ${saldoVelho} para ${saldoNovo} (${diferenca})`,
          registradoPorId: contexto.usuarioOperacional?.id ?? null,
        });
      }
    });

    revalidatePath("/estoque");
    revalidatePath("/");

    return {
      sucesso: true,
      mensagem: "Produto atualizado com sucesso.",
    };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
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
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
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

// ── Indicadores e relatórios (Fase 4) ─────────────────────────────────────────

export interface IndicadoresEstoque {
  totalItens: number;
  /** Soma de quantidade × custo. `null` sem a permissão estoque.ver_custos. */
  valorACusto: number | null;
  /** Soma de quantidade × preço de venda. */
  valorAVenda: number | null;
  /** Lucro que o estoque parado renderia se vendesse inteiro. `null` sem custos. */
  margemPotencial: number | null;
  /** Produtos com saldo entre 1 e o mínimo: ainda vende, mas precisa repor. */
  abaixoDoMinimo: number;
  /** Produtos com saldo zero: deixou de vender. */
  semEstoque: number;
  /** Unidades somadas de tudo. */
  unidadesTotais: number;
}

/**
 * KPIs do topo da tela de Estoque.
 *
 * Tudo somado em CENTAVOS INTEIROS e convertido uma vez no retorno — o valor
 * de estoque é soma de centenas de linhas, e é onde erro de ponto flutuante
 * aparece primeiro.
 */
export async function obterIndicadoresEstoque(): Promise<IndicadoresEstoque> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");
  const prisma = contexto.prisma;
  const podeVerCustos = temPermissao(contexto, "estoque.ver_custos");

  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    select: { custo: true, precoVenda: true, quantidadeEstoque: true, estoqueMinimo: true },
  });

  let custoCentavos = 0;
  let vendaCentavos = 0;
  let abaixoDoMinimo = 0;
  let semEstoque = 0;
  let unidadesTotais = 0;

  for (const produto of produtos) {
    const quantidade = produto.quantidadeEstoque;
    unidadesTotais += quantidade;

    if (quantidade <= 0) {
      semEstoque += 1;
    } else if (quantidade <= produto.estoqueMinimo) {
      // Entre 1 e o mínimo: separado de "sem estoque" porque a ação é
      // diferente — um precisa repor, o outro já está deixando de vender.
      abaixoDoMinimo += 1;
    }

    if (quantidade > 0) {
      custoCentavos = somar(
        custoCentavos,
        multiplicarPorQuantidade(deDecimal(produto.custo), quantidade)
      );
      vendaCentavos = somar(
        vendaCentavos,
        multiplicarPorQuantidade(deDecimal(produto.precoVenda), quantidade)
      );
    }
  }

  return {
    totalItens: produtos.length,
    valorACusto: podeVerCustos ? paraMoeda(custoCentavos) : null,
    valorAVenda: paraMoeda(vendaCentavos),
    margemPotencial: podeVerCustos ? paraMoeda(subtrair(vendaCentavos, custoCentavos)) : null,
    abaixoDoMinimo,
    semEstoque,
    unidadesTotais,
  };
}

export interface LinhaCurvaABC {
  produtoId: string;
  nome: string;
  unidadesVendidas: number;
  receita: number;
  /** Fatia da receita total do período, em pontos percentuais. */
  participacao: number;
  /** Fatia acumulada até esta linha — é o que separa A de B e de C. */
  acumulado: number;
  classe: "A" | "B" | "C";
}

/**
 * Curva ABC: quais produtos puxam o faturamento.
 *
 * Lê de `ItemVenda`, não do livro de movimentações, de propósito: o histórico
 * de vendas sempre existiu ali, e o livro só passou a registrar a partir de
 * 02/11/2026. Ler o livro faria a curva ignorar todo o passado da loja. As
 * duas fontes nunca são somadas — aqui a venda é contada uma vez, pela tabela
 * que a representa.
 *
 * A = até 80% da receita acumulada, B = até 95%, C = o resto. É o corte
 * clássico de Pareto, e o que ele responde é "quais poucos produtos pagam a
 * loja".
 */
export async function obterCurvaABC(
  diasAtras: number = 90,
  limite: number = 30
): Promise<LinhaCurvaABC[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");
  const prisma = contexto.prisma;

  const desde = somarDias(agoraNaLoja(contexto.fusoHorario), -diasAtras);

  const linhas = await prisma.$queryRaw<
    Array<{ produtoId: string; nome: string; unidades: bigint | number; receita: string | null }>
  >`
    SELECT
      p.id AS "produtoId",
      p.nome AS nome,
      COALESCE(SUM(iv.quantidade), 0) AS unidades,
      COALESCE(SUM(iv.subtotal), 0)::text AS receita
    FROM "ItemVenda" iv
    INNER JOIN "Produto" p ON p.id = iv."produtoId"
    INNER JOIN "Venda" v ON v.id = iv."vendaId"
    WHERE v."estornadaEm" IS NULL
      AND v."criadoEm" >= ${desde}
    GROUP BY p.id, p.nome
    HAVING COALESCE(SUM(iv.subtotal), 0) > 0
    ORDER BY COALESCE(SUM(iv.subtotal), 0) DESC
    LIMIT ${limite}
  `;

  const receitas = linhas.map((linha) => deDecimal(linha.receita ?? 0));
  const totalCentavos = somar(...receitas);

  if (totalCentavos <= 0) return [];

  let acumuladoCentavos = 0;

  return linhas.map((linha, indice) => {
    const receitaCentavos = receitas[indice];
    acumuladoCentavos = somar(acumuladoCentavos, receitaCentavos);

    const acumulado = (acumuladoCentavos / totalCentavos) * 100;

    return {
      produtoId: String(linha.produtoId),
      nome: String(linha.nome),
      unidadesVendidas: Number(linha.unidades),
      receita: paraMoeda(receitaCentavos),
      participacao: (receitaCentavos / totalCentavos) * 100,
      acumulado,
      classe: acumulado <= 80 ? "A" : acumulado <= 95 ? "B" : "C",
    };
  });
}

export interface ProdutoParado {
  produtoId: string;
  nome: string;
  quantidadeEstoque: number;
  /** Dinheiro imobilizado nesse produto. `null` sem a permissão de custos. */
  capitalParado: number | null;
  /** Dias desde a última venda. `null` quando nunca vendeu. */
  diasSemVender: number | null;
}

/**
 * Produtos com estoque que não vendem há muito tempo — capital parado na
 * prateleira.
 *
 * Inclui os que NUNCA venderam (`diasSemVender` nulo). São o caso mais
 * relevante, e um filtro por data de última venda os deixaria de fora
 * justamente por não terem data nenhuma.
 */
export async function obterProdutosParados(diasSemVenda: number = 60): Promise<ProdutoParado[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");
  const prisma = contexto.prisma;
  const podeVerCustos = temPermissao(contexto, "estoque.ver_custos");

  const agora = agoraNaLoja(contexto.fusoHorario);
  const limite = somarDias(agora, -diasSemVenda);

  const linhas = await prisma.$queryRaw<
    Array<{
      produtoId: string;
      nome: string;
      quantidadeEstoque: number;
      custo: string;
      ultimaVenda: Date | null;
    }>
  >`
    SELECT
      p.id AS "produtoId",
      p.nome AS nome,
      p."quantidadeEstoque" AS "quantidadeEstoque",
      p.custo::text AS custo,
      MAX(v."criadoEm") AS "ultimaVenda"
    FROM "Produto" p
    LEFT JOIN "ItemVenda" iv ON iv."produtoId" = p.id
    LEFT JOIN "Venda" v ON v.id = iv."vendaId" AND v."estornadaEm" IS NULL
    WHERE p.ativo = true
      AND p."quantidadeEstoque" > 0
    GROUP BY p.id, p.nome, p."quantidadeEstoque", p.custo
    HAVING MAX(v."criadoEm") IS NULL OR MAX(v."criadoEm") < ${limite}
    ORDER BY p."quantidadeEstoque" * p.custo DESC
  `;

  return linhas.map((linha) => {
    const ultimaVenda = linha.ultimaVenda ? new Date(linha.ultimaVenda) : null;

    return {
      produtoId: String(linha.produtoId),
      nome: String(linha.nome),
      quantidadeEstoque: Number(linha.quantidadeEstoque),
      capitalParado: podeVerCustos
        ? paraMoeda(multiplicarPorQuantidade(deDecimal(linha.custo), Number(linha.quantidadeEstoque)))
        : null,
      diasSemVender: ultimaVenda
        ? Math.floor((agora.getTime() - ultimaVenda.getTime()) / 86_400_000)
        : null,
    };
  });
}

export interface LinhaMovimentacaoProduto {
  id: string;
  tipo: string;
  origem: string;
  quantidade: number;
  saldoAnterior: number | null;
  saldoPosterior: number | null;
  observacao: string | null;
  criadoEm: string;
}

/**
 * Movimentações de um produto — o que o dono pediu como "movimentações dentro
 * de cada produto".
 *
 * Só mostra o que o livro registrou, ou seja, a partir de 02/11/2026. Venda
 * anterior a isso não aparece aqui, e a tela diz isso em vez de dar a
 * impressão de que o produto nunca se moveu.
 */
export async function listarMovimentacoesProduto(
  produtoId: string,
  limite: number = 50
): Promise<LinhaMovimentacaoProduto[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");
  const prisma = contexto.prisma;

  const movimentacoes = await prisma.movimentacaoEstoque.findMany({
    where: { produtoId },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: {
      id: true,
      tipo: true,
      origem: true,
      quantidade: true,
      saldoAnterior: true,
      saldoPosterior: true,
      observacao: true,
      criadoEm: true,
    },
  });

  return movimentacoes.map((movimentacao) => ({
    id: movimentacao.id,
    tipo: String(movimentacao.tipo),
    origem: String(movimentacao.origem),
    quantidade: movimentacao.quantidade,
    saldoAnterior: movimentacao.saldoAnterior,
    saldoPosterior: movimentacao.saldoPosterior,
    observacao: movimentacao.observacao,
    criadoEm: movimentacao.criadoEm.toISOString(),
  }));
}
