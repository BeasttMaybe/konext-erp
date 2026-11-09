"use server";

import { revalidatePath } from "next/cache";

import { exigirPermissao } from "@/lib/auth/permissoes";
import { chamarBling, ErroDoBling, esperarPelaVazao } from "@/lib/bling/api";
import { obterAccessTokenValido, registrarSincronizacao } from "@/lib/bling/conexao";
import { hojeComoDataDeCalendario, somarDiasEmDataDeCalendario, FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { deDecimal, paraDecimal } from "@/lib/dinheiro";
import {
  casarNotaComVenda,
  explicarNaoCasamento,
  type VendaCandidata,
} from "@/lib/dominio/bling/casamento-de-venda";
import {
  lerDetalheDaNota,
  lerPaginaDeNotas,
  TIPO_SAIDA_NO_BLING,
  type NotaDeSaidaLida,
} from "@/lib/dominio/bling/nota-de-saida";
import { paraMensagemSegura } from "@/lib/erros";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * Traz para o Konext as notas de saída emitidas no Bling.
 *
 * O desenho é o que o dono escolheu: ele emite no Bling, aqui só se lê. Nada
 * nesta função escreve no Bling.
 *
 * ELA É LIMITADA DE PROPÓSITO, EM DOIS EIXOS
 *
 * - **O Bling aceita 3 requisições por segundo**, e a listagem não traz o
 *   valor da nota: o valor vem no detalhe, uma requisição por nota. Então uma
 *   sincronização de cem notas são cem requisições, que não cabem no tempo de
 *   uma função.
 * - **Por isso o trabalho é dividido em duas fases.** A primeira é barata:
 *   lista as notas e grava o cabeçalho (número, chave, data, situação,
 *   cliente), com o valor em branco. A segunda é cara: busca o detalhe só das
 *   notas cujo valor ainda não foi lido, e para quando atinge o teto.
 *
 * O resultado é que a lista aparece inteira na primeira passada, e os valores
 * vão preenchendo nas seguintes. Isso é melhor que o contrário — uma tela
 * vazia por dois minutos — e é por isso que `valorTotal` aceita nulo: nota
 * sem valor lido mostra travessão, nunca R$ 0,00.
 */

/**
 * Quanto tempo a fase de detalhes pode gastar.
 *
 * Orçamento de relógio, não contagem fixa de notas: o limite real é o tempo
 * da função, e ele muda com o plano da hospedagem. Oito segundos cabem até
 * no menor deles, e a execução para sozinha quando o tempo acaba — a
 * seguinte continua de onde parou, porque o que decide quem falta é o banco
 * (`valorTotal` nulo), não um contador em memória.
 */
const ORCAMENTO_DE_DETALHES_EM_MS = 8_000;

/** Teto duro, para o caso de a rede estar muito rápida. */
const TETO_DE_DETALHES_POR_EXECUCAO = 40;

/**
 * Até quantos anos para trás buscar.
 *
 * A primeira versão olhava 90 dias, e foi assim que 79 notas do dono viraram
 * 19 aqui: as outras 60 eram mais antigas que a janela e nunca foram
 * procuradas. Nada no sistema dizia isso — a tela mostrava 19 notas com a
 * mesma cara de quem mostra todas.
 *
 * O histórico é varrido em janelas de um ano, do mais recente para o mais
 * antigo. Cinco anos cobre a vida de qualquer loja que vá adotar este
 * sistema, e a varredura é barata: uma requisição por ano, por execução.
 */
const ANOS_DE_HISTORICO = 5;

/** Páginas por janela de um ano. Cada uma traz até 100 notas. */
const TETO_DE_PAGINAS_POR_ANO = 10;

export type ResumoDaSincronizacao = {
  sucesso: boolean;
  mensagem: string;
  notasLidas: number;
  notasNovas: number;
  detalhesBuscados: number;
  vinculadasAVenda: number;
  contasCriadas: number;
  /** Quantas ainda esperam o valor. A próxima execução continua de onde parou. */
  faltamDetalhes: number;
  /**
   * O erro cru, quando houve. Só a tela do dono mostra, e só quando falha.
   *
   * Sem isto, uma falha de validação do Prisma vira "tente novamente em
   * instantes" — uma frase que manda tentar para sempre e não ajuda ninguém
   * a consertar.
   */
  detalhe?: string;
};

type DelegateGenerico = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findFirst?: (args?: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  count: (args?: unknown) => Promise<number>;
};

function delegado(prisma: unknown, nome: string, alternativo: string): DelegateGenerico {
  const raiz = prisma as Record<string, DelegateGenerico | undefined>;
  const encontrado = raiz[nome] ?? raiz[alternativo];

  if (!encontrado?.findMany) {
    throw new ErroDoBling(`Delegate Prisma de ${nome} nao disponivel.`, null);
  }

  return encontrado;
}

type NotaGravada = {
  id: string;
  blingId: string | null;
  numero: string;
  valorTotal: unknown;
  pedidoId: string | null;
  clienteDocumento: string | null;
  dataEmissao: Date | null;
};

/**
 * Grava o cabeçalho das notas lidas da listagem.
 *
 * Atualiza em vez de duplicar porque `blingId` é único — e atualizar importa:
 * uma nota cancelada no Bling depois de emitida precisa chegar cancelada
 * aqui, senão a tela continuaria mostrando como válida uma nota que não é.
 */
async function gravarCabecalhos(
  notaFiscal: DelegateGenerico,
  lidas: NotaDeSaidaLida[]
): Promise<{ novas: number }> {
  let novas = 0;

  for (const lida of lidas) {
    const existente = (await notaFiscal.findFirst?.({
      where: { blingId: lida.blingId },
      select: { id: true },
    })) as { id: string } | null;

    const dados = {
      numero: lida.numero,
      serie: lida.serie,
      chaveAcesso: lida.chaveAcesso,
      status: lida.status,
      situacaoBling: lida.situacaoBling,
      dataEmissao: lida.dataEmissao,
      clienteNome: lida.clienteNome,
      clienteDocumento: lida.clienteDocumento,
    };

    if (existente) {
      await notaFiscal.update({ where: { id: existente.id }, data: dados });
    } else {
      await notaFiscal.create({ data: { ...dados, blingId: lida.blingId } });
      novas += 1;
    }
  }

  return { novas };
}

/**
 * Tenta reconhecer a venda do Konext que esta nota documenta.
 *
 * As candidatas são buscadas por CLIENTE, não por valor: a comparação de
 * valor é feita em centavos inteiros, e filtrar `Decimal` no banco por
 * igualdade de dinheiro é o tipo de coisa que funciona até o dia em que o
 * arredondamento difere. Buscar por cliente traz poucas linhas e deixa a
 * decisão inteira com a regra testada.
 */
async function tentarVincular({
  pedidoVenda,
  notaFiscal,
  nota,
  valorCentavos,
}: {
  pedidoVenda: DelegateGenerico;
  notaFiscal: DelegateGenerico;
  nota: NotaGravada;
  valorCentavos: number;
}): Promise<boolean> {
  const documento = (nota.clienteDocumento ?? "").replace(/\D/g, "");

  if (documento.length !== 11 && documento.length !== 14) {
    await notaFiscal.update({
      where: { id: nota.id },
      data: { motivoSemVinculo: explicarNaoCasamento("NOTA_SEM_DOCUMENTO") },
    });
    return false;
  }

  const brutas = (await pedidoVenda.findMany({
    where: { cliente: { documento: { contains: documento.slice(0, 11) } } },
    select: {
      id: true,
      total: true,
      dataCriacao: true,
      cliente: { select: { documento: true } },
    },
    take: 50,
  })) as Array<{
    id: string;
    total: unknown;
    dataCriacao: Date;
    cliente: { documento: string | null } | null;
  }>;

  const candidatas: VendaCandidata[] = brutas.map((bruta) => ({
    id: bruta.id,
    clienteDocumento: bruta.cliente?.documento ?? null,
    valorCentavos: deDecimal(String(bruta.total)),
    data: bruta.dataCriacao,
  }));

  const resultado = casarNotaComVenda({
    nota: {
      clienteDocumento: nota.clienteDocumento,
      valorCentavos,
      dataEmissao: nota.dataEmissao,
    },
    candidatas,
  });

  await notaFiscal.update({
    where: { id: nota.id },
    data: resultado.casou
      ? { pedidoId: resultado.vendaId, motivoSemVinculo: null }
      : { pedidoId: null, motivoSemVinculo: explicarNaoCasamento(resultado.motivo) },
  });

  return resultado.casou;
}

export async function sincronizarNotasDoBling(): Promise<ResumoDaSincronizacao> {
  const vazio = {
    notasLidas: 0,
    notasNovas: 0,
    detalhesBuscados: 0,
    vinculadasAVenda: 0,
    contasCriadas: 0,
    faltamDetalhes: 0,
  };

  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "financeiro.editar");

    const { prisma } = contexto;
    const notaFiscal = delegado(prisma, "notaFiscal", "NotaFiscal");
    const contaReceber = delegado(prisma, "contaReceber", "ContaReceber");
    const pedidoVenda = delegado(prisma, "pedidoVenda", "PedidoVenda");

    const accessToken = await obterAccessTokenValido(prisma);

    const hoje = hojeComoDataDeCalendario(contexto.fusoHorario ?? FUSO_HORARIO_PADRAO);
    const comoData = (data: Date) => data.toISOString().slice(0, 10);

    // ── Fase barata: a listagem, ano a ano para trás ───────────────────────
    //
    // A varredura é sempre do histórico inteiro, não só do que mudou. Isso é
    // de propósito: nota muda de situação DEPOIS de emitida (uma cancelada em
    // janeiro continua cancelada e precisa chegar assim aqui), e `blingId`
    // único faz cada leitura atualizar em vez de duplicar. O custo é uma
    // requisição por ano.
    let lidas = 0;
    let novas = 0;

    for (let ano = 0; ano < ANOS_DE_HISTORICO; ano += 1) {
      const fimDaJanela = somarDiasEmDataDeCalendario(hoje, -365 * ano);
      const inicioDaJanela = somarDiasEmDataDeCalendario(hoje, -365 * (ano + 1) + 1);

      for (let pagina = 1; pagina <= TETO_DE_PAGINAS_POR_ANO; pagina += 1) {
        await esperarPelaVazao();

        const resposta = await chamarBling({
          accessToken,
          caminho: "/nfe",
          parametros: {
            tipo: TIPO_SAIDA_NO_BLING,
            dataEmissaoInicial: `${comoData(inicioDaJanela)} 00:00:00`,
            dataEmissaoFinal: `${comoData(fimDaJanela)} 23:59:59`,
            limite: 100,
            pagina,
          },
        });

        const daPagina = lerPaginaDeNotas(resposta);
        if (daPagina.length === 0) break;

        const resultado = await gravarCabecalhos(notaFiscal, daPagina);
        lidas += daPagina.length;
        novas += resultado.novas;

        // Página incompleta é a última: não existe próxima para buscar.
        if (daPagina.length < 100) break;
      }

      // Repare que um ano VAZIO não interrompe o laço de fora: uma loja pode
      // ter parado de emitir por um período e voltado. Parar no primeiro ano
      // sem notas deixaria todo o histórico anterior invisível para sempre.
    }

    // ── Fase cara: o detalhe, só de quem ainda não tem valor ───────────────
    const semValor = (await notaFiscal.findMany({
      where: { blingId: { not: null }, valorTotal: null },
      select: {
        id: true,
        blingId: true,
        numero: true,
        valorTotal: true,
        pedidoId: true,
        clienteDocumento: true,
        dataEmissao: true,
      },
      orderBy: { dataEmissao: "desc" },
      take: TETO_DE_DETALHES_POR_EXECUCAO,
    })) as NotaGravada[];

    let detalhesBuscados = 0;
    let vinculadas = 0;
    let contasCriadas = 0;

    const comecouEm = Date.now();

    for (const nota of semValor) {
      if (!nota.blingId) continue;

      // Para quando o tempo acaba, não quando a lista acaba. A próxima
      // execução recomeça pelas que ainda estão sem valor.
      if (Date.now() - comecouEm > ORCAMENTO_DE_DETALHES_EM_MS) break;

      await esperarPelaVazao();

      const detalhe = lerDetalheDaNota(
        await chamarBling({ accessToken, caminho: `/nfe/${nota.blingId}` })
      );

      detalhesBuscados += 1;
      if (!detalhe || detalhe.valorNotaReais === null) continue;

      const valorCentavos = deDecimal(detalhe.valorNotaReais);

      await notaFiscal.update({
        where: { id: nota.id },
        data: {
          valorTotal: paraDecimal(valorCentavos),
          serie: detalhe.serie,
          linkXml: detalhe.linkXml,
          linkDanfe: detalhe.linkDanfe,
          descricaoItens: detalhe.descricaoDosItens,
        },
      });

      const casou = await tentarVincular({ pedidoVenda, notaFiscal, nota, valorCentavos });
      if (casou) vinculadas += 1;

      // A conta a receber nasce SÓ quando a nota não corresponde a uma venda
      // daqui. Criar nos dois casos faria o total a receber contar a mesma
      // venda duas vezes — e um total que só cresce é o defeito que ninguém
      // desconfia.
      if (casou) continue;

      for (const [indice, parcela] of detalhe.parcelas.entries()) {
        const referencia = `${nota.blingId}:${indice}`;

        const jaExiste = await contaReceber.count({ where: { blingParcelaRef: referencia } });
        if (jaExiste > 0) continue;

        await contaReceber.create({
          data: {
            // "(Bling)" no nome foi pedido pelo dono: é o que deixa claro, na
            // lista, de onde a conta veio, sem precisar abrir nada.
            // "(Bling)" no nome foi pedido pelo dono: deixa claro na lista
            // de onde a conta veio, sem precisar abrir nada. O número da
            // nota vem junto porque é por ele que se acha a nota no Bling.
            descricao: `(Bling) NF ${nota.numero}${
              detalhe.descricaoDosItens ? ` — ${detalhe.descricaoDosItens}` : ""
            }`.slice(0, 180),
            valor: paraDecimal(deDecimal(parcela.valorReais)),
            dataVencimento: parcela.vencimento,
            origem: "BLING",
            status: "PENDENTE",
            // Obrigatória e sem default. A nota do Bling traz um id de forma
            // de pagamento que não corresponde a nenhum valor deste enum, e
            // gravar um chute poria dado falso no gráfico de entradas por
            // forma. Era a ausência deste campo que fazia a sincronização
            // falhar — com a mensagem genérica escondendo o motivo.
            formaRecebimento: "NAO_INFORMADO",
            blingParcelaRef: referencia,
            numeroParcela: indice + 1,
            totalParcelas: detalhe.parcelas.length,
          },
        });

        contasCriadas += 1;
      }
    }

    const [faltamDetalhes, totalNoKonext] = await Promise.all([
      notaFiscal.count({ where: { blingId: { not: null }, valorTotal: null } }),
      notaFiscal.count({ where: { blingId: { not: null } } }),
    ]);

    await registrarSincronizacao({ prisma, erro: null });

    revalidatePath("/financeiro/notas-fiscais");
    revalidatePath("/financeiro/receber");

    return {
      sucesso: true,
      // A mensagem diz quantas EXISTEM aqui, não quantas foram lidas agora:
      // é o número que o dono compara com o Bling. Dizer só "lidas" escondeu
      // que 60 notas nunca tinham sido procuradas.
      mensagem:
        faltamDetalhes > 0
          ? `${totalNoKonext} notas no Konext (${novas} novas agora). Faltam ${faltamDetalhes} valores — clique de novo para continuar.`
          : `${totalNoKonext} notas no Konext, tudo em dia (${novas} novas agora).`,
      notasLidas: lidas,
      notasNovas: novas,
      detalhesBuscados,
      vinculadasAVenda: vinculadas,
      contasCriadas,
      faltamDetalhes,
    };
  } catch (erro) {
    const mensagem = erro instanceof ErroDoBling ? erro.message : paraMensagemSegura(erro);

    // O DETALHE CRU vai para `ultimoErro`, que só a tela do dono mostra.
    //
    // A mascara de `paraMensagemSegura` existe para não vazar interno para o
    // cliente, e está certa. Mas ela transformou um erro de validação do
    // Prisma — campo obrigatório faltando — em "Não foi possível concluir a
    // operação. Tente novamente em instantes.", que mandava o dono tentar de
    // novo para sempre, e não dizia nada a quem fosse consertar.
    //
    // Guardar o texto real num campo que só o dono vê não vaza nada e é a
    // diferença entre diagnosticar em um minuto ou em uma hora.
    const detalhe = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
    console.error("[bling] falha na sincronizacao:", erro);

    try {
      const contexto = await exigirContextoTenant();
      await registrarSincronizacao({ prisma: contexto.prisma, erro: detalhe });
    } catch {
      // Se nem o contexto abre, não há onde registrar — a mensagem volta na tela.
    }

    return { sucesso: false, mensagem, detalhe, ...vazio };
  }
}
