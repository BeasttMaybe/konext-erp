"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao, temPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import { formProdutoSchema, type FormProdutoEntrada } from "@/lib/validations/estoque";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { prefixoDaCategoria, proximoSku, validarSku } from "@/lib/dominio/estoque/sku";
import { margemPercentual } from "@/lib/dominio/estoque/preco";
import { codigoDaEtiqueta, digitoVerificadorEanConfere } from "@/lib/dominio/estoque/etiqueta";
import { gerarCodigoDeBarrasSvg } from "@/lib/estoque/codigo-de-barras";
import { deDecimal, multiplicarPorQuantidade, paraMoeda, somar, subtrair } from "@/lib/dinheiro";
import { agoraNaLoja, somarDias } from "@/lib/datas";
import { registrarMovimentacaoEstoque } from "@/lib/estoque-movimentacao";

type ResultadoProduto =
  | { sucesso: true; mensagem: string; produtoId: string }
  | { sucesso: false; mensagem: string };

/**
 * SKU sugerido para uma categoria: prefixo dela + o próximo sequencial livre.
 *
 * Fica no servidor porque depende dos SKUs já gravados. A tela chama isto ao
 * escolher a categoria no cadastro de um produto novo, e o dono pode trocar o
 * valor por um código próprio.
 */
export async function sugerirSku(categoriaId: string): Promise<string | null> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");

  const categoria = await contexto.prisma.categoriaProduto.findUnique({
    where: { id: categoriaId },
    select: { nome: true },
  });

  if (!categoria) return null;

  const prefixo = prefixoDaCategoria(categoria.nome);

  // Só os SKUs do prefixo interessam, e eles são poucos por categoria. Buscar
  // todos e achar o maior em memória é mais simples (e mais correto) que um
  // MAX() em SQL, que precisaria desmontar o texto pra achar o número.
  const existentes = await contexto.prisma.produto.findMany({
    where: { sku: { startsWith: `${prefixo}-` } },
    select: { sku: true },
  });

  return proximoSku(
    prefixo,
    existentes.map((produto) => produto.sku ?? "").filter((sku) => sku.length > 0)
  );
}

export type ProdutoParaEdicao = {
  id: string;
  nome: string;
  categoriaId: string;
  sku: string | null;
  unidade: string;
  codigoBarras: string | null;
  compatibilidade: string | null;
  imagemUrl: string | null;
  descricao: string | null;
  /** `null` sem a permissão estoque.ver_custos (F-41). */
  custo: number | null;
  precoVenda: number;
  quantidadeEstoque: number;
  estoqueMinimo: number;
  permiteVendaSemEstoque: boolean;
  ativo: boolean;
};

export async function obterProdutoParaEdicao(id: string): Promise<ProdutoParaEdicao | null> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");
  const podeVerCustos = temPermissao(contexto, "estoque.ver_custos");

  const produto = await contexto.prisma.produto.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      categoriaId: true,
      sku: true,
      unidade: true,
      codigoBarras: true,
      compatibilidade: true,
      imagemUrl: true,
      descricao: true,
      custo: true,
      precoVenda: true,
      quantidadeEstoque: true,
      estoqueMinimo: true,
      permiteVendaSemEstoque: true,
      ativo: true,
    },
  });

  if (!produto) return null;

  return {
    ...produto,
    custo: podeVerCustos ? paraMoeda(deDecimal(produto.custo)) : null,
    precoVenda: paraMoeda(deDecimal(produto.precoVenda)),
  };
}

/**
 * Cria ou atualiza um produto. `id` nulo é cadastro novo.
 *
 * Era duas actions (`criarProduto` e `atualizarProduto`) com o mesmo corpo
 * copiado, e a divergência já tinha começado: só a de atualizar registrava
 * movimentação de ajuste de saldo. Uma função, uma regra.
 *
 * Registra auditoria, que NENHUMA das duas fazia. Mudança de custo e de preço
 * de venda é mudança de dinheiro: sem log, não há como responder depois por que
 * a margem de um produto mudou, nem quem mudou.
 */
export async function salvarProduto(
  id: string | null,
  dados: FormProdutoEntrada
): Promise<ResultadoProduto> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");
    const prisma = contexto.prisma;

    const validados = formProdutoSchema.parse(dados);

    const categoria = await prisma.categoriaProduto.findUnique({
      where: { id: validados.categoriaId },
      select: { id: true, nome: true, ativa: true },
    });

    if (!categoria) {
      return { sucesso: false, mensagem: "Categoria não encontrada." };
    }

    // Categoria desativada só continua valendo para o produto que já estava
    // nela: bloquear a edição de um produto por causa disso prenderia o dono
    // num beco — ele não conseguiria nem trocar a categoria, que é a saída.
    if (!categoria.ativa && id === null) {
      return { sucesso: false, mensagem: "Esta categoria está desativada. Escolha outra." };
    }

    let sku: string | null = null;

    if (validados.sku && validados.sku.trim().length > 0) {
      const validacao = validarSku(validados.sku);
      if (!validacao.valido) {
        return { sucesso: false, mensagem: validacao.erro };
      }
      sku = validacao.sku;
    } else if (id === null) {
      // Só gera no cadastro. Num produto antigo sem SKU, gerar aqui criaria um
      // código em silêncio para um item que já está na prateleira sem etiqueta.
      sku = await sugerirSku(categoria.id);
    }

    const camposDoCadastro = {
      nome: validados.nome,
      categoriaId: categoria.id,
      unidade: validados.unidade,
      codigoBarras: validados.codigoBarras || null,
      compatibilidade: validados.compatibilidade || null,
      imagemUrl: validados.imagemUrl || null,
      descricao: validados.descricao || null,
      custo: validados.custo,
      precoVenda: validados.precoVenda,
      estoqueMinimo: validados.estoqueMinimo,
      permiteVendaSemEstoque: validados.permiteVendaSemEstoque,
      ativo: validados.ativo,
    };

    const produtoId = await prisma.$transaction(async (tx) => {
      if (id === null) {
        // Produto e saldo inicial nascem na MESMA transação do movimento que
        // explica esse saldo. Sem isso, o primeiro número de todo produto
        // apareceria no livro como se tivesse surgido do nada.
        const criado = await tx.produto.create({
          data: {
            ...camposDoCadastro,
            sku,
            quantidadeEstoque: validados.quantidadeEstoque,
          },
          select: { id: true, quantidadeEstoque: true },
        });

        if (criado.quantidadeEstoque > 0) {
          await registrarMovimentacaoEstoque(tx, {
            produtoId: criado.id,
            origem: "CADASTRO",
            quantidade: criado.quantidadeEstoque,
            saldoPosterior: criado.quantidadeEstoque,
            custoUnitario: validados.custo,
            observacao: "Saldo informado no cadastro do produto",
            registradoPorId: contexto.usuarioOperacional?.id ?? null,
          });
        }

        await registrarLogAuditoria(
          tx,
          contextoAuditoriaDoUsuario(
            contexto.usuarioOperacional,
            "app/actions/estoque.ts:salvarProduto"
          ),
          {
            acao: ACOES_AUDITORIA.CRIAR,
            entidade: ENTIDADES_AUDITORIA.PRODUTO,
            entidadeId: criado.id,
            dadosDepois: {
              nome: validados.nome,
              sku,
              categoria: categoria.nome,
              custo: validados.custo,
              precoVenda: validados.precoVenda,
              saldoInicial: criado.quantidadeEstoque,
            },
          }
        );

        return criado.id;
      }

      // Lê ANTES de escrever: é a única forma de saber se a edição mexeu no
      // saldo, de quanto foi a diferença, e o que mudou de dinheiro.
      const antes = await tx.produto.findUnique({
        where: { id },
        select: {
          quantidadeEstoque: true,
          custo: true,
          precoVenda: true,
          nome: true,
          sku: true,
          categoriaId: true,
          ativo: true,
        },
      });

      if (!antes) {
        throw new Prisma.PrismaClientKnownRequestError("Produto não encontrado", {
          code: "P2025",
          clientVersion: "manual",
        });
      }

      await tx.produto.update({
        where: { id },
        data: {
          ...camposDoCadastro,
          // SKU só é sobrescrito quando veio preenchido: salvar a tela sem
          // tocar no campo não deve apagar o código que já está na etiqueta.
          ...(sku !== null ? { sku } : {}),
          quantidadeEstoque: validados.quantidadeEstoque,
        },
      });

      const saldoNovo = validados.quantidadeEstoque;

      // Edição que não toca no saldo não vira movimento: o livro é de estoque,
      // não de cadastro. Trocar o nome do produto não é entrada nem saída.
      if (saldoNovo !== antes.quantidadeEstoque) {
        const diferenca = saldoNovo - antes.quantidadeEstoque;

        await registrarMovimentacaoEstoque(tx, {
          produtoId: id,
          origem: "AJUSTE_MANUAL",
          tipo: "AJUSTE",
          quantidade: Math.abs(diferenca),
          saldoPosterior: saldoNovo,
          custoUnitario: validados.custo,
          observacao:
            diferenca > 0
              ? `Saldo corrigido à mão de ${antes.quantidadeEstoque} para ${saldoNovo} (+${diferenca})`
              : `Saldo corrigido à mão de ${antes.quantidadeEstoque} para ${saldoNovo} (${diferenca})`,
          registradoPorId: contexto.usuarioOperacional?.id ?? null,
        });
      }

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/estoque.ts:salvarProduto"
        ),
        {
          acao: ACOES_AUDITORIA.ATUALIZAR_PRODUTO,
          entidade: ENTIDADES_AUDITORIA.PRODUTO,
          entidadeId: id,
          dadosAntes: {
            nome: antes.nome,
            sku: antes.sku,
            custo: paraMoeda(deDecimal(antes.custo)),
            precoVenda: paraMoeda(deDecimal(antes.precoVenda)),
            saldo: antes.quantidadeEstoque,
            ativo: antes.ativo,
          },
          dadosDepois: {
            nome: validados.nome,
            sku: sku ?? antes.sku,
            custo: validados.custo,
            precoVenda: validados.precoVenda,
            saldo: saldoNovo,
            ativo: validados.ativo,
          },
        }
      );

      return id;
    });

    revalidatePath("/estoque");
    revalidatePath(`/estoque/produtos/${produtoId}`);
    revalidatePath("/pdv");
    revalidatePath("/");

    return {
      sucesso: true,
      mensagem: id === null ? "Produto cadastrado." : "Produto atualizado.",
      produtoId,
    };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      // O índice único é por campo: dizer QUAL colidiu evita a caça ao erro.
      const alvo = String(erro.meta?.target ?? "");
      if (alvo.includes("sku")) {
        return { sucesso: false, mensagem: "Já existe um produto com este SKU." };
      }
      return { sucesso: false, mensagem: "Já existe um produto com este código de barras." };
    }

    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return { sucesso: false, mensagem: "Produto não encontrado." };
    }

    console.error("Erro ao salvar produto:", erro);
    return { sucesso: false, mensagem: "Não foi possível salvar o produto. Tente novamente." };
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
  /** Id da categoria cadastrada, ou "TODAS". */
  categoriaId?: string,
  situacao: SituacaoEstoque = "TODAS",
  ordem: "nome" | "menor_saldo" | "maior_valor" = "nome"
): Promise<PaginatedResult<{
  id: string;
  nome: string;
  codigoBarras: string | null;
  imagemUrl: string | null;
  descricao: string | null;
  sku: string | null;
  unidade: string;
  categoriaId: string;
  /** Nome da categoria cadastrada, pra tela não precisar de um segundo mapa. */
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

  if (categoriaId && categoriaId !== "TODAS") {
    where.categoriaId = categoriaId;
  }

  if (busca && busca.trim().length > 0) {
    const termo = busca.trim();
    where.OR = [
      { nome: { contains: termo, mode: "insensitive" } },
      { codigoBarras: { contains: termo, mode: "insensitive" } },
      // O SKU é justamente o código curto que se digita pra achar o produto:
      // deixá-lo fora da busca seria criar o campo e esconder o uso dele.
      { sku: { contains: termo, mode: "insensitive" } },
      { compatibilidade: { contains: termo, mode: "insensitive" } },
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
        sku: true,
        unidade: true,
        categoriaId: true,
        categoriaDoProduto: { select: { nome: true } },
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
    data: produtos.map(({ categoriaDoProduto, ...produto }) => ({
      ...produto,
      categoria: categoriaDoProduto.nome,
      custo: podeVerCustos && produto.custo !== null ? paraMoeda(deDecimal(produto.custo)) : null,
      precoVenda: paraMoeda(deDecimal(produto.precoVenda)),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Desativa o produto. NÃO apaga.
 *
 * Era `prisma.produto.delete()`, e isso tinha dois problemas:
 *
 * 1. `MovimentacaoEstoque` tem `onDelete: Cascade` para o produto — ou seja,
 *    apagar o produto APAGAVA o livro de movimentações dele. O livro existe
 *    justamente para que o saldo tenha história; perder a história junto com o
 *    cadastro é o pior resultado possível.
 * 2. `ItemVenda.produtoId` não cascateia, então qualquer produto já vendido
 *    recusava a exclusão com erro de chave estrangeira. Na prática, o botão
 *    "excluir" só funcionava em produto que nunca vendeu — e, nesse caso, era
 *    quando mais destruía (apagava o livro sem nada impedir).
 *
 * `ativo: false` tira o produto da lista, do PDV e dos indicadores, mantendo
 * saldo, histórico e vendas de pé. É o que o negócio quer dizer com "sair de
 * linha", e é o que a referência da página do produto chama de "Desativar".
 */
export async function desativarProduto(
  id: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.excluir");
    const prisma = contexto.prisma;

    const produto = await prisma.produto.update({
      where: { id },
      data: { ativo: false },
      select: { id: true, nome: true, quantidadeEstoque: true },
    });

    await registrarLogAuditoria(
      prisma,
      contextoAuditoriaDoUsuario(
        contexto.usuarioOperacional,
        "app/actions/estoque.ts:desativarProduto"
      ),
      {
        acao: ACOES_AUDITORIA.EXCLUIR_LOGICO,
        entidade: ENTIDADES_AUDITORIA.PRODUTO,
        entidadeId: produto.id,
        dadosDepois: {
          nome: produto.nome,
          ativo: false,
          // Vale registrar: produto desativado com saldo continua contando no
          // valor do estoque de nada, porque sai dos indicadores. Quem lê o log
          // depois precisa saber que havia saldo aqui.
          saldoNoMomento: produto.quantidadeEstoque,
        },
      }
    );

    revalidatePath("/estoque");
    revalidatePath("/pdv");
    revalidatePath("/");

    return {
      sucesso: true,
      mensagem:
        produto.quantidadeEstoque > 0
          ? `"${produto.nome}" foi desativado. Ainda havia ${produto.quantidadeEstoque} em estoque.`
          : `"${produto.nome}" foi desativado.`,
    };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return { sucesso: false, mensagem: "Produto não encontrado." };
    }

    console.error("Erro ao desativar produto:", erro);
    return { sucesso: false, mensagem: "Não foi possível desativar o produto." };
  }
}

/** Volta o produto para a lista e para o PDV. */
export async function reativarProduto(
  id: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");

    const produto = await contexto.prisma.produto.update({
      where: { id },
      data: { ativo: true },
      select: { id: true, nome: true },
    });

    await registrarLogAuditoria(
      contexto.prisma,
      contextoAuditoriaDoUsuario(
        contexto.usuarioOperacional,
        "app/actions/estoque.ts:reativarProduto"
      ),
      {
        acao: ACOES_AUDITORIA.REATIVAR_PRODUTO,
        entidade: ENTIDADES_AUDITORIA.PRODUTO,
        entidadeId: produto.id,
        dadosDepois: { nome: produto.nome, ativo: true },
      }
    );

    revalidatePath("/estoque");
    revalidatePath("/pdv");

    return { sucesso: true, mensagem: `"${produto.nome}" foi reativado.` };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return { sucesso: false, mensagem: "Produto não encontrado." };
    }

    console.error("Erro ao reativar produto:", erro);
    return { sucesso: false, mensagem: "Não foi possível reativar o produto." };
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

// ── Resumo de um produto (painel da página do produto) ────────────────────────

export type ResumoProduto = {
  /** Unidades vendidas nos últimos 30 dias. */
  vendidasNoMes: number;
  /** Unidades que saíram por venda em toda a história registrada. */
  vendidasNoTotal: number;
  /** Última entrada registrada no livro: quando e a que custo. */
  ultimaEntrada: { quando: string; custoUnitario: number | null } | null;
  /** Saldo × custo. `null` sem a permissão estoque.ver_custos. */
  valorParado: number | null;
  /** Margem sobre o preço de venda, em pontos. `null` sem preço ou sem permissão. */
  margem: number | null;
};

/**
 * O painel "Resumo" da página do produto.
 *
 * As vendas saem de `ItemVenda`, e não do livro de movimentações, de propósito:
 * o livro começou na Fase 4 e as saídas anteriores foram reconstruídas sem
 * saldo, então contar por ele daria números menores que a realidade pra
 * qualquer produto com histórico. A ENTRADA, ao contrário, só existe no livro.
 */
export async function obterResumoProduto(produtoId: string): Promise<ResumoProduto | null> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");
  const prisma = contexto.prisma;
  const podeVerCustos = temPermissao(contexto, "estoque.ver_custos");

  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    select: { custo: true, precoVenda: true, quantidadeEstoque: true },
  });

  if (!produto) return null;

  const agora = agoraNaLoja(contexto.fusoHorario);
  const trintaDiasAtras = somarDias(agora, -30, contexto.fusoHorario);

  const [doMes, doTotal, ultimaEntrada] = await Promise.all([
    prisma.itemVenda.aggregate({
      where: { produtoId, venda: { criadoEm: { gte: trintaDiasAtras }, estornadaEm: null } },
      _sum: { quantidade: true },
    }),
    prisma.itemVenda.aggregate({
      where: { produtoId, venda: { estornadaEm: null } },
      _sum: { quantidade: true },
    }),
    prisma.movimentacaoEstoque.findFirst({
      where: { produtoId, tipo: "ENTRADA" },
      orderBy: { criadoEm: "desc" },
      select: { criadoEm: true, custoUnitario: true },
    }),
  ]);

  const custoCentavos = deDecimal(produto.custo);
  const precoCentavos = deDecimal(produto.precoVenda);

  return {
    vendidasNoMes: doMes._sum.quantidade ?? 0,
    vendidasNoTotal: doTotal._sum.quantidade ?? 0,
    ultimaEntrada: ultimaEntrada
      ? {
          quando: ultimaEntrada.criadoEm.toISOString(),
          custoUnitario:
            podeVerCustos && ultimaEntrada.custoUnitario !== null
              ? paraMoeda(deDecimal(ultimaEntrada.custoUnitario))
              : null,
        }
      : null,
    valorParado: podeVerCustos
      ? paraMoeda(multiplicarPorQuantidade(custoCentavos, produto.quantidadeEstoque))
      : null,
    margem: podeVerCustos ? margemPercentual(custoCentavos, precoCentavos) : null,
  };
}

// ── Prévia da etiqueta ────────────────────────────────────────────────────────

export type PreviaEtiqueta =
  | { ok: true; svg: string; legenda: string; origem: "CODIGO_DE_BARRAS" | "SKU" }
  | { ok: false; erro: string };

/**
 * Prévia do código de barras a partir do que está DIGITADO na tela, não do que
 * está salvo.
 *
 * Fica no servidor porque o gerador é Node. Recebe os valores em vez do id do
 * produto para que a prévia acompanhe a edição: trocar o código de barras e só
 * ver o resultado depois de salvar transformaria "confira antes de imprimir" em
 * "salve e descubra".
 */
export async function gerarPreviaEtiqueta(entrada: {
  codigoBarras: string | null;
  sku: string | null;
}): Promise<PreviaEtiqueta> {
  await exigirContextoTenant();

  const codigo = codigoDaEtiqueta(entrada);

  if (!codigo) {
    return {
      ok: false,
      erro: "Sem código de barras e sem SKU não há o que o leitor devolva.",
    };
  }

  if (digitoVerificadorEanConfere(codigo.conteudo) === false) {
    return {
      ok: false,
      erro: "O dígito verificador deste código de barras não fecha — confira o número na embalagem.",
    };
  }

  const resultado = gerarCodigoDeBarrasSvg(codigo.simbologia, codigo.conteudo);

  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro };
  }

  return { ok: true, svg: resultado.svg, legenda: codigo.legenda, origem: codigo.origem };
}
