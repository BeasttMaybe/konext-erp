"use server";

import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { deDecimal, multiplicarPorQuantidade, paraDecimal, somar } from "@/lib/dinheiro";
import { dataDeCalendario } from "@/lib/datas";
import { registrarMovimentacaoEstoque } from "@/lib/estoque-movimentacao";
import { prefixoDaCategoria, proximoSku } from "@/lib/dominio/estoque/sku";
import { lerXmlDeNota } from "@/lib/compras/ler-xml-de-nota";
import { extrairPalavrasDoPdf } from "@/lib/compras/extrair-palavras-pdf";
import { lerNotaDePalavras } from "@/lib/dominio/compras/leitura-pdf";
import { conferirDestinatario, XmlDeNotaInvalido } from "@/lib/dominio/compras/leitura-xml";
import { conferirNota, type ItemLidoDaNota, type NotaLida } from "@/lib/dominio/compras/nota";
import {
  calcularCustos,
  custoAposEntrada,
  type CriterioDeRateio,
  type RegraDeCusto,
} from "@/lib/dominio/compras/custo";
import { casarItem, type Candidato, type ProdutoParaCasar } from "@/lib/dominio/compras/casamento";
import { unidadeDoCadastro } from "@/lib/dominio/compras/unidade";

/**
 * Entrada de nota de compra: o documento do fornecedor virando estoque.
 *
 * Duas actions e uma regra entre elas. `lerNota` INTERPRETA e não grava nada;
 * `lancarNota` grava e não interpreta. A separação é o que permite a tela de
 * conferência existir no meio, e a tela no meio é o que torna seguro aceitar
 * um PDF — formato em que "qual coluna é o preço" é inferência, não leitura.
 *
 * O que o cliente manda de volta no lançamento são DECISÕES (este item é
 * aquele produto; este eu quero criar; este eu ignoro), nunca números. Todo
 * valor é recalculado aqui a partir dos itens do documento: o custo que vai
 * pro cadastro do produto não pode ter passado pelo navegador.
 */

const TAMANHO_MAXIMO_DO_ARQUIVO = 8 * 1024 * 1024;

export type ItemConferido = ItemLidoDaNota & {
  problemas: string[];
  totalCalculadoCentavos: number;
  /** O produto que o sistema achou, ou nulo. */
  sugestao: Candidato | null;
  /** `true` só quando foi identidade (código de barras, SKU, nome igual). */
  certeza: boolean;
  alternativas: Candidato[];
};

export type NotaConferida = {
  origem: "XML" | "PDF";
  chaveAcesso: string | null;
  numero: string | null;
  serie: string | null;
  emitenteNome: string;
  emitenteCnpj: string | null;
  emitidaEm: string | null;
  arquivoNome: string;

  valorProdutosCentavos: number;
  valorFreteCentavos: number;
  valorDescontoCentavos: number;
  valorTotalCentavos: number;

  itens: ItemConferido[];
  linhasIgnoradas: string[];

  /** Problemas da nota inteira (soma não bate, total geral não bate). */
  problemas: string[];
  /** `true` quando todas as contas do documento fecham. */
  contaFecha: boolean;

  /** Preenchido quando esta nota JÁ entrou no estoque antes. */
  jaLancada: { id: string; lancadaEm: string } | null;

  /** "EMITIDA_PELA_LOJA" | "DESTINADA_A_OUTRO_CNPJ", quando for o caso. */
  alertaDeDestinatario: string | null;

  /**
   * O catálogo que serviu pro casamento, devolvido junto.
   *
   * Vai inteiro pro cliente de propósito. O gesto mais comum da conferência
   * é "não é esse produto, é aquele outro", e uma busca com ida ao servidor
   * a cada letra transformaria quinze correções em quinze esperas. Catálogo
   * de assistência técnica é de centenas de linhas, e três campos por linha
   * cabem folgado no que a tela já carrega.
   */
  catalogo: ProdutoParaCasar[];
};

export type ResultadoLeitura =
  | { sucesso: true; nota: NotaConferida }
  | { sucesso: false; mensagem: string };

function ehXml(nome: string, conteudo: string): boolean {
  return nome.toLowerCase().endsWith(".xml") || conteudo.trimStart().startsWith("<");
}

/**
 * Lê o arquivo, casa com o catálogo e devolve tudo pra conferência.
 *
 * Não grava nada. Pode ser chamada quantas vezes for preciso com o mesmo
 * arquivo — o que é importante, porque a reação natural de quem não tem
 * certeza se já importou é importar de novo.
 */
export async function lerNota(formData: FormData): Promise<ResultadoLeitura> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");

    const arquivo = formData.get("arquivo");

    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return { sucesso: false, mensagem: "Escolha o arquivo da nota (XML ou PDF)." };
    }

    if (arquivo.size > TAMANHO_MAXIMO_DO_ARQUIVO) {
      return {
        sucesso: false,
        mensagem: "O arquivo passa de 8 MB. Nota fiscal não costuma chegar nesse tamanho — confira se não é um PDF digitalizado em alta resolução.",
      };
    }

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const nome = arquivo.name;

    let lida: NotaLida;
    let alertaDeDestinatario: string | null = null;

    if (ehXml(nome, new TextDecoder().decode(bytes.slice(0, 200)))) {
      const nota = lerXmlDeNota(new TextDecoder("utf-8").decode(bytes));

      const configuracao = await contexto.prisma.configuracao.findFirst({
        select: { cnpj: true },
      });

      alertaDeDestinatario = conferirDestinatario(nota, configuracao?.cnpj);
      lida = nota;
    } else {
      const { palavras, paginas } = await extrairPalavrasDoPdf(bytes);

      if (palavras.length === 0) {
        return {
          sucesso: false,
          mensagem:
            paginas > 0
              ? "Este PDF não tem texto, só imagem — foi digitalizado ou fotografado. Peça o arquivo original ao fornecedor, ou lance os itens à mão."
              : "Não consegui abrir este PDF.",
        };
      }

      lida = lerNotaDePalavras(palavras);
    }

    if (lida.itens.length === 0) {
      return {
        sucesso: false,
        mensagem: "Não encontrei nenhum item neste arquivo. Se for um PDF, pode ser que o layout do fornecedor seja diferente do que eu sei ler — me mande o arquivo que eu ensino o sistema.",
      };
    }

    const conferencia = conferirNota(lida);

    const catalogo: ProdutoParaCasar[] = await contexto.prisma.produto.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, sku: true, codigoBarras: true },
    });

    const jaLancada = lida.chaveAcesso
      ? await contexto.prisma.notaDeCompra.findUnique({
          where: { chaveAcesso: lida.chaveAcesso },
          select: { id: true, criadoEm: true },
        })
      : null;

    const itens: ItemConferido[] = lida.itens.map((item, indice) => {
      const casamento = casarItem(item, catalogo);
      const conferido = conferencia.itens[indice];

      return {
        ...item,
        problemas: conferido?.problemas ?? [],
        totalCalculadoCentavos: conferido?.totalCalculadoCentavos ?? 0,
        sugestao: casamento.escolhido,
        certeza: casamento.certeza,
        alternativas: casamento.alternativas,
      };
    });

    return {
      sucesso: true,
      nota: {
        origem: lida.origem,
        chaveAcesso: lida.chaveAcesso,
        numero: lida.numero,
        serie: lida.serie,
        emitenteNome: lida.emitenteNome ?? "",
        emitenteCnpj: lida.emitenteCnpj,
        emitidaEm: lida.emitidaEm,
        arquivoNome: nome,
        // Sem total de mercadoria declarado (acontece em orçamento simples),
        // a soma das linhas é a melhor informação que existe.
        valorProdutosCentavos: lida.valorProdutosCentavos ?? conferencia.somaDosItensCentavos,
        valorFreteCentavos: lida.valorFreteCentavos,
        valorDescontoCentavos: lida.valorDescontoCentavos,
        valorTotalCentavos:
          lida.valorTotalCentavos ??
          somar(conferencia.somaDosItensCentavos, lida.valorFreteCentavos) -
            lida.valorDescontoCentavos,
        itens,
        linhasIgnoradas: lida.linhasIgnoradas,
        problemas: conferencia.problemas,
        contaFecha: conferencia.fecha,
        jaLancada: jaLancada
          ? { id: jaLancada.id, lancadaEm: jaLancada.criadoEm.toISOString() }
          : null,
        alertaDeDestinatario,
        catalogo,
      },
    };
  } catch (erro) {
    if (erro instanceof XmlDeNotaInvalido) {
      return { sucesso: false, mensagem: erro.message };
    }

    const conhecida = mensagemDeErroConhecido(erro);
    return { sucesso: false, mensagem: conhecida ?? "Não consegui ler este arquivo." };
  }
}

/** O que a conferência decidiu pra cada linha da nota. */
export type DecisaoDoItem =
  | { acao: "IGNORAR"; ordem: number }
  | { acao: "VINCULAR"; ordem: number; produtoId: string }
  | {
      acao: "CRIAR";
      ordem: number;
      nome: string;
      categoriaId: string;
      precoVendaCentavos: number;
      unidade: string;
      codigoBarras: string | null;
    };

export type LancamentoDeNota = {
  /** Os itens exatamente como foram lidos — a fonte dos valores. */
  itens: Array<Pick<ItemLidoDaNota, "ordem" | "descricao" | "codigoFornecedor" | "ean" | "ncm" | "unidade" | "quantidade" | "valorUnitarioCentavos" | "valorTotalCentavos">>;
  decisoes: DecisaoDoItem[];

  origem: "XML" | "PDF";
  chaveAcesso: string | null;
  numero: string | null;
  serie: string | null;
  emitenteNome: string;
  emitenteCnpj: string | null;
  emitidaEm: string | null;
  arquivoNome: string | null;
  observacao: string | null;

  freteCentavos: number;
  descontoCentavos: number;
  criterioRateio: CriterioDeRateio;
  regraDeCusto: RegraDeCusto;
};

export type ResultadoLancamento =
  | { sucesso: true; notaId: string; mensagem: string; criados: number; atualizados: number }
  | { sucesso: false; mensagem: string };

/**
 * Grava a nota e mexe no estoque, tudo numa transação só.
 *
 * Nenhum custo vem do cliente. O rateio de frete e o custo final de cada
 * item são recalculados aqui, a partir dos valores do documento e do
 * critério escolhido — o número que vai pro cadastro do produto e pro livro
 * de movimentação não pode ter passado pelo navegador.
 */
export async function lancarNota(entrada: LancamentoDeNota): Promise<ResultadoLancamento> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "estoque.editar");
    const prisma = contexto.prisma;

    if (entrada.itens.length === 0) {
      return { sucesso: false, mensagem: "A nota não tem itens." };
    }

    const emitenteNome = entrada.emitenteNome.trim();
    if (emitenteNome === "") {
      return { sucesso: false, mensagem: "Informe o nome do fornecedor." };
    }

    const decisaoPorOrdem = new Map(entrada.decisoes.map((decisao) => [decisao.ordem, decisao]));
    const entrando = entrada.itens.filter(
      (item) => (decisaoPorOrdem.get(item.ordem)?.acao ?? "IGNORAR") !== "IGNORAR"
    );

    if (entrando.length === 0) {
      return {
        sucesso: false,
        mensagem: "Nenhum item foi marcado pra entrar. Vincule ou crie pelo menos um produto.",
      };
    }

    for (const decisao of entrada.decisoes) {
      if (decisao.acao === "CRIAR") {
        if (decisao.nome.trim() === "") {
          return { sucesso: false, mensagem: `Item ${decisao.ordem}: dê um nome ao produto novo.` };
        }
        if (decisao.precoVendaCentavos <= 0) {
          return {
            sucesso: false,
            mensagem: `Item ${decisao.ordem}: informe o preço de venda. Produto criado sem preço aparece no PDV valendo zero.`,
          };
        }
      }
    }

    // A trava de idempotência é o índice único de `chaveAcesso`, mas conferir
    // antes dá a mensagem certa em vez de um erro de banco.
    if (entrada.chaveAcesso) {
      const existente = await prisma.notaDeCompra.findUnique({
        where: { chaveAcesso: entrada.chaveAcesso },
        select: { id: true, criadoEm: true },
      });

      if (existente) {
        return {
          sucesso: false,
          mensagem: `Esta nota já entrou no estoque em ${existente.criadoEm.toLocaleDateString("pt-BR")}. Lançar de novo dobraria o saldo.`,
        };
      }
    }

    // O rateio considera a nota INTEIRA, inclusive os itens ignorados: o
    // frete foi pago pela carga toda, e tirar uma linha da conta jogaria a
    // fatia dela por cima das outras, inflando o custo delas.
    const custos = calcularCustos({
      itens: entrada.itens as ItemLidoDaNota[],
      freteCentavos: entrada.freteCentavos,
      descontoCentavos: entrada.descontoCentavos,
      criterio: entrada.criterioRateio,
    });

    const custoPorOrdem = new Map(custos.map((custo) => [custo.ordem, custo]));

    let criados = 0;
    let atualizados = 0;

    const notaId = await prisma.$transaction(async (tx) => {
      const nota = await tx.notaDeCompra.create({
        data: {
          origem: entrada.origem,
          chaveAcesso: entrada.chaveAcesso,
          numero: entrada.numero,
          serie: entrada.serie,
          emitenteNome,
          emitenteCnpj: entrada.emitenteCnpj,
          emitidaEm: entrada.emitidaEm ? dataDeCalendario(entrada.emitidaEm) : null,
          valorProdutos: paraDecimal(
            somar(...entrada.itens.map((item) => item.valorTotalCentavos))
          ),
          valorFrete: paraDecimal(entrada.freteCentavos),
          valorDesconto: paraDecimal(entrada.descontoCentavos),
          valorTotal: paraDecimal(
            somar(
              ...entrada.itens.map((item) => item.valorTotalCentavos),
              entrada.freteCentavos
            ) - entrada.descontoCentavos
          ),
          criterioRateio: entrada.criterioRateio,
          arquivoNome: entrada.arquivoNome,
          observacao: entrada.observacao,
          lancadaPorId: contexto.usuarioOperacional?.id ?? null,
        },
        select: { id: true },
      });

      for (const item of entrada.itens) {
        const decisao = decisaoPorOrdem.get(item.ordem) ?? { acao: "IGNORAR" as const, ordem: item.ordem };
        const custo = custoPorOrdem.get(item.ordem);

        // O saldo do estoque é inteiro. Nota fracionária (peso, metro) é
        // arredondada PRA CIMA, pra nunca registrar entrada menor do que a
        // que chegou de verdade na prateleira.
        const quantidadeEmUnidades = Math.max(1, Math.ceil(item.quantidade));

        // E o custo é dividido pelas unidades que REALMENTE entram, não pela
        // quantidade fracionária do documento: `Produto.custo` é o custo da
        // unidade que vai ser vendida, e é contra ele que a margem é
        // calculada no balcão. Dividir por 1,5 e dar entrada em 2 deixaria o
        // valor do estoque diferente do valor da nota.
        const custoUnitarioCentavos = custo
          ? multiplicarPorQuantidade(custo.custoTotalCentavos, 1 / quantidadeEmUnidades)
          : item.valorUnitarioCentavos;

        const dadosDaLinha = {
          notaId: nota.id,
          ordem: item.ordem,
          descricao: item.descricao,
          codigoFornecedor: item.codigoFornecedor,
          ean: item.ean,
          ncm: item.ncm,
          unidade: item.unidade,
          quantidade: String(item.quantidade),
          valorUnitario: paraDecimal(item.valorUnitarioCentavos),
          valorTotal: paraDecimal(item.valorTotalCentavos),
          rateioFrete: paraDecimal(custo?.rateioDeFreteCentavos ?? 0),
          rateioDesconto: paraDecimal(custo?.rateioDeDescontoCentavos ?? 0),
          custoUnitario: paraDecimal(custoUnitarioCentavos),
        };

        if (decisao.acao === "IGNORAR") {
          // Fica gravada sem produto: "por que isso não entrou?" precisa ter
          // resposta, e a resposta é que foi lida e deixada de fora.
          await tx.notaDeCompraItem.create({ data: dadosDaLinha });
          continue;
        }

        let produtoId: string;
        let criouProduto = false;

        if (decisao.acao === "CRIAR") {
          const prefixo = prefixoDaCategoria(
            (
              await tx.categoriaProduto.findUnique({
                where: { id: decisao.categoriaId },
                select: { nome: true },
              })
            )?.nome ?? ""
          );

          const existentes = await tx.produto.findMany({
            where: { sku: { startsWith: `${prefixo}-` } },
            select: { sku: true },
          });

          const criado = await tx.produto.create({
            data: {
              nome: decisao.nome.trim(),
              categoriaId: decisao.categoriaId,
              // Validada de novo aqui: o cliente pode mandar qualquer texto,
              // e unidade fora da lista estraga o cadastro em silêncio.
              unidade: unidadeDoCadastro(decisao.unidade),
              codigoBarras: decisao.codigoBarras,
              sku: proximoSku(
                prefixo,
                existentes.map((produto) => produto.sku ?? "").filter((sku) => sku.length > 0)
              ),
              custo: paraDecimal(custoUnitarioCentavos),
              precoVenda: paraDecimal(decisao.precoVendaCentavos),
              quantidadeEstoque: quantidadeEmUnidades,
            },
            select: { id: true, quantidadeEstoque: true },
          });

          produtoId = criado.id;
          criouProduto = true;
          criados += 1;

          await registrarMovimentacaoEstoque(tx, {
            produtoId: criado.id,
            origem: "COMPRA_NOTA",
            quantidade: quantidadeEmUnidades,
            saldoPosterior: criado.quantidadeEstoque,
            custoUnitario: paraDecimal(custoUnitarioCentavos),
            notaDeCompraId: nota.id,
            observacao: `Entrada por nota de ${emitenteNome}`,
            registradoPorId: contexto.usuarioOperacional?.id ?? null,
          });
        } else {
          const atual = await tx.produto.findUnique({
            where: { id: decisao.produtoId },
            select: { id: true, quantidadeEstoque: true, custo: true },
          });

          if (!atual) {
            throw new Error(
              `O produto do item ${item.ordem} não existe mais. Recarregue a página e confira de novo.`
            );
          }

          const novoCustoCentavos = custoAposEntrada({
            regra: entrada.regraDeCusto,
            saldoAtual: atual.quantidadeEstoque,
            custoAtualCentavos: deDecimal(atual.custo),
            quantidadeComprada: quantidadeEmUnidades,
            custoDaCompraCentavos: custoUnitarioCentavos,
          });

          const atualizado = await tx.produto.update({
            where: { id: atual.id },
            data: {
              quantidadeEstoque: { increment: quantidadeEmUnidades },
              custo: paraDecimal(novoCustoCentavos),
            },
            select: { id: true, quantidadeEstoque: true },
          });

          produtoId = atualizado.id;
          atualizados += 1;

          await registrarMovimentacaoEstoque(tx, {
            produtoId: atualizado.id,
            origem: "COMPRA_NOTA",
            quantidade: quantidadeEmUnidades,
            saldoPosterior: atualizado.quantidadeEstoque,
            custoUnitario: paraDecimal(custoUnitarioCentavos),
            notaDeCompraId: nota.id,
            observacao: `Entrada por nota de ${emitenteNome}`,
            registradoPorId: contexto.usuarioOperacional?.id ?? null,
          });
        }

        await tx.notaDeCompraItem.create({
          data: { ...dadosDaLinha, produtoId, criouProduto },
        });
      }

      // O log vai na MESMA transação que mexeu no estoque. Uma nota lançada
      // sem registro de quem lançou é pior que nenhuma nota: é saldo que
      // mudou sem dono.
      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/compras.ts:lancarNota"
        ),
        {
          acao: ACOES_AUDITORIA.LANCAR_NOTA_DE_COMPRA,
          entidade: ENTIDADES_AUDITORIA.NOTA_DE_COMPRA,
          entidadeId: nota.id,
          dadosDepois: {
            fornecedor: emitenteNome,
            origem: entrada.origem,
            chaveAcesso: entrada.chaveAcesso,
            criterioRateio: entrada.criterioRateio,
            regraDeCusto: entrada.regraDeCusto,
            itensCriados: criados,
            itensAtualizados: atualizados,
          },
        }
      );

      return nota.id;
    });

    revalidatePath("/estoque");

    return {
      sucesso: true,
      notaId,
      criados,
      atualizados,
      mensagem:
        criados > 0 && atualizados > 0
          ? `Nota lançada: ${criados} produto(s) criado(s) e ${atualizados} atualizado(s).`
          : criados > 0
            ? `Nota lançada: ${criados} produto(s) criado(s).`
            : `Nota lançada: ${atualizados} produto(s) atualizado(s).`,
    };
  } catch (erro) {
    const conhecida = mensagemDeErroConhecido(erro);

    return {
      sucesso: false,
      // A transação inteira foi desfeita: nenhum saldo mudou, nenhum produto
      // foi criado. Dizer isso importa, porque quem vê "não consegui lançar"
      // sem essa frase vai conferir produto por produto antes de tentar de novo.
      mensagem: `${conhecida ?? "Não consegui lançar a nota."} Nada foi gravado — nenhum saldo mudou.`,
    };
  }
}

/** As categorias ativas, pra tela oferecer onde criar os produtos novos. */
export async function listarCategoriasParaEntrada(): Promise<
  Array<{ id: string; nome: string }>
> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "estoque.ver");

  return contexto.prisma.categoriaProduto.findMany({
    where: { ativa: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}
